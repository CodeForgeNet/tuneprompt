import { Command } from 'commander';
import { CloudService, RunData } from '../services/cloud.service';
import chalk from 'chalk';
import { execSync } from 'child_process';
import ora from 'ora';
import { loadConfig } from '../utils/config';
import { TestLoader } from '../engine/loader';
import { TestRunner } from '../engine/runner';
import { TestReporter } from '../engine/reporter';
import { TestDatabase } from '../storage/database';

export interface RunOptions {
  config?: string;
  watch?: boolean;
  ci?: boolean;
  cloud?: boolean;
}



// Extract the core run functionality to a separate function
export async function runTests(options: RunOptions = {}) {
  const startTime = Date.now();
  const spinner = ora('Loading...').start();

  try {
    const config = await loadConfig(options.config);
    spinner.succeed('Configuration loaded');

    spinner.start('Loading tests...');
    const loader = new TestLoader();
    const testCases = loader.loadTestDir(config.testDir || './tests');

    if (testCases.length === 0) {
      spinner.fail('No test cases found');
      process.exit(1);
    }

    spinner.succeed(`Loaded ${testCases.length} test(s)`);

    spinner.start('Running tests...');
    const runner = new TestRunner(config);
    const results = await runner.runTests(testCases);
    spinner.stop();

    const db = new TestDatabase();
    db.saveRun(results);

    // Calculate results for cloud upload
    const currentRunId = results.id;

    const reporter = new TestReporter();
    reporter.printResults(results, config.outputFormat);

    const isCI = options.ci ||
      process.env.CI === 'true' ||
      !!process.env.GITHUB_ACTIONS ||
      !!process.env.GITLAB_CI;

    const shouldUpload = options.cloud || isCI;

    if (shouldUpload) {
      await syncPendingRuns(db, options);
    }

    db.close();

    // Exit with error code if tests failed
    if (results.failed > 0) {
      process.exit(1);
    }

  } catch (error: any) {
    spinner.fail('Test run failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

export const runCommand = new Command('run')
  .description('Run prompt tests')
  .option('--cloud', 'Upload results to Tuneprompt Cloud')
  .option('--ci', 'Run in CI mode (auto-enables --cloud)')
  .action(async (options) => {
    await runTests(options);
  });

async function syncPendingRuns(db: TestDatabase, options: any) {
  const pendingRuns = db.getPendingUploads();
  if (pendingRuns.length === 0) return;

  const syncSpinner = ora(`Syncing ${pendingRuns.length} run(s) to Cloud...`).start();

  const cloudService = new CloudService();
  await cloudService.init();

  if (!(await cloudService.isAuthenticated())) {
    syncSpinner.warn('Not authenticated. Run `tuneprompt activate` first.');
    return;
  }

  // Get project ID once
  let projectId: string;
  try {
    const projects = await cloudService.getProjects();
    if (projects.length === 0) {
      const project = await cloudService.createProject('Default Project');
      projectId = project.id;
    } else {
      projectId = projects[0].id;
    }
  } catch (err) {
    syncSpinner.warn('Failed to get project info');
    return;
  }

  // Common Git/Env context
  let gitContext = {};
  try {
    gitContext = {
      commit_hash: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      branch_name: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      commit_message: execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim(),
    };
  } catch { }

  let ciProvider;
  if (process.env.GITHUB_ACTIONS) ciProvider = 'github';
  else if (process.env.GITLAB_CI) ciProvider = 'gitlab';
  else if (process.env.JENKINS_HOME) ciProvider = 'jenkins';
  else if (process.env.CIRCLECI) ciProvider = 'circleci';

  // Upload each run
  for (const run of pendingRuns) {
    const runData: import('../services/cloud.service').RunData = {
      project_id: projectId,
      environment: options.ci ? 'ci' : 'local',
      ci_provider: ciProvider,
      total_tests: run.totalTests,
      passed_tests: run.passed,
      failed_tests: run.failed,
      duration_ms: run.duration,
      cost_usd: run.results.reduce((sum, r) => sum + (r.metadata.cost || 0), 0) || 0.05, // fallback
      started_at: new Date(run.timestamp.getTime() - run.duration).toISOString(),
      completed_at: run.timestamp.toISOString(),
      test_results: run.results.map(r => ({
        test_name: r.testCase.description,
        test_description: r.testCase.description,
        prompt: typeof r.testCase.prompt === 'string' ? r.testCase.prompt : JSON.stringify(r.testCase.prompt),
        input_data: r.testCase.variables,
        expected_output: r.expectedOutput,
        actual_output: r.actualOutput,
        score: r.score,
        method: r.testCase.config?.method || 'exact',
        status: r.status,
        model: r.metadata.provider || '',
        tokens_used: r.metadata.tokens,
        latency_ms: r.metadata.duration,
        cost_usd: r.metadata.cost,
      })),
      ...gitContext // Applying current git context to old runs slightly inaccurate but acceptable
    };

    const uploadResult = await cloudService.uploadRun(runData);

    if (uploadResult.success) {
      db.markAsUploaded(run.id);
    }
  }

  syncSpinner.succeed(`Synced ${pendingRuns.length} run(s) to Cloud`);
}