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
import { LicenseManager, getLicenseInfo } from '../utils/license';
import { TestResult } from '../types';

export interface RunOptions {
    config?: string;
    watch?: boolean;
    ci?: boolean;
    cloud?: boolean;
}

// At the end of your test run reporter
function displayRunSummary(results: TestResult[]): void {
    const failed = results.filter(r => r.status === 'fail');
    const passed = results.filter(r => r.status === 'pass');

    console.log(chalk.bold.white('\n' + '='.repeat(60)));
    console.log(chalk.bold.white('Test Summary'));
    console.log(chalk.bold.white('='.repeat(60)));
    console.log(chalk.green(`✓ Passed: ${passed.length}`));
    console.log(chalk.red(`✗ Failed: ${failed.length}`));
    console.log(chalk.gray(`Total: ${results.length}`));
    console.log(chalk.bold.white('='.repeat(60) + '\n'));

    // UPSELL MESSAGE (NEW)
    if (failed.length > 0) {
        console.log(chalk.yellow('⚠️  ' + failed.length + ' test(s) failed'));
        console.log(chalk.gray('\nDon\'t waste time debugging manually.'));
        console.log(chalk.cyan('Run ') + chalk.bold.white('tuneprompt fix') + chalk.cyan(' to let AI repair these prompts instantly.\n'));

        // Check license status
        const licenseManager = new LicenseManager();
        licenseManager.hasFeature('fix').then((hasAccess: boolean) => {
            if (!hasAccess) {
                console.log(chalk.gray('Unlock fix with: ') + chalk.white('http://localhost:8080'));
                console.log(chalk.gray('Already have a key? ') + chalk.white('tuneprompt activate <key>\n'));
            }
        });
    }
}

export const runCommand = new Command('run')
  .description('Run prompt tests')
  .option('--cloud', 'Upload results to Tuneprompt Cloud')
  .option('--ci', 'Run in CI mode (auto-enables --cloud)')
  .action(async (options) => {
    const startTime = Date.now();
    const spinner = ora('Loading configuration...').start();

    try {
        // Load config
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');

        // Load tests
        spinner.start('Loading test cases...');
        const loader = new TestLoader();
        const testCases = loader.loadTestDir(config.testDir || './tests');

        if (testCases.length === 0) {
            spinner.fail('No test cases found');
            process.exit(1);
        }

        spinner.succeed(`Loaded ${testCases.length} test case(s)`);

        // Run tests
        spinner.start('Running tests...');
        const runner = new TestRunner(config);
        const results = await runner.runTests(testCases);
        spinner.stop();

        // Save to database
        const db = new TestDatabase();
        db.saveRun(results);
        db.close();

        // Report results
        const reporter = new TestReporter();
        reporter.printResults(results, config.outputFormat);

        // Calculate results for cloud upload
        const testResults = results.results.map((result: TestResult) => {
          // Map from internal TestResult to cloud service TestResult
          const mappedResult: import('../services/cloud.service').TestResult = {
            test_name: result.testCase.description,
            test_description: result.testCase.description,
            prompt: typeof result.testCase.prompt === 'string'
              ? result.testCase.prompt
              : JSON.stringify(result.testCase.prompt),
            input_data: result.testCase.variables,
            expected_output: result.expectedOutput,
            actual_output: result.actualOutput,
            score: result.score,
            method: result.testCase.config?.method || 'exact',
            status: result.status,
            model: result.metadata.provider || '',
            tokens_used: result.metadata.tokens,
            latency_ms: result.metadata.duration,
            cost_usd: result.metadata.cost,
            error_message: result.error,
            error_type: undefined, // No error type in current TestResult interface
          };
          return mappedResult;
        });

        // Calculate total cost from all test results
        const totalCost = results.results.reduce((sum, result) => {
          return sum + (result.metadata.cost || 0);
        }, 0);

        const resultsSummary = {
          totalTests: results.results.length,
          passedTests: results.passed,
          failedTests: results.failed,
          durationMs: Date.now() - startTime,
          totalCost: totalCost || 0.05, // fallback value
          tests: testResults,
        };

        // Print results to console (existing logic)
        console.log(chalk.green(`\n✅ ${resultsSummary.passedTests} passed`));
        console.log(chalk.red(`❌ ${resultsSummary.failedTests} failed\n`));

        // Show upsell hint if tests failed
        displayRunSummary(results.results);

        // NEW: Cloud upload logic
        const isCI = options.ci ||
                     process.env.CI === 'true' ||
                     !!process.env.GITHUB_ACTIONS ||
                     !!process.env.GITLAB_CI;

        const shouldUpload = options.cloud || isCI;

        if (shouldUpload) {
          await uploadToCloud(resultsSummary, options);
        }

        // Exit with error code if tests failed
        if (resultsSummary.failedTests > 0) {
          process.exit(1);
        }

    } catch (error: any) {
        spinner.fail('Test run failed');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
});

async function uploadToCloud(results: {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  totalCost: number;
  tests: import('../services/cloud.service').TestResult[];
}, options: any) {
  const cloudService = new CloudService();
  await cloudService.init();

  const isAuth = await cloudService.isAuthenticated();

  if (!isAuth) {
    console.log(chalk.yellow('\n⚠️  Not authenticated with Cloud.'));
    console.log(chalk.gray('Results saved locally. Run `tuneprompt activate` to enable cloud sync\n'));
    return;
  }

  // Get or create project
  let projectId: string;
  try {
    const projects = await cloudService.getProjects();
    if (projects.length === 0) {
      const project = await cloudService.createProject('Default Project');
      projectId = project.id;
    } else {
      projectId = projects[0].id; // Use first project
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Failed to get project'));
    return;
  }

  // Get Git context
  let gitContext = {};
  try {
    gitContext = {
      commit_hash: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      branch_name: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      commit_message: execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim(),
    };
  } catch {
    // Not a git repo
  }

  // Detect CI provider
  let ciProvider;
  if (process.env.GITHUB_ACTIONS) ciProvider = 'github';
  else if (process.env.GITLAB_CI) ciProvider = 'gitlab';
  else if (process.env.JENKINS_HOME) ciProvider = 'jenkins';
  else if (process.env.CIRCLECI) ciProvider = 'circleci';

  // Prepare run data
  const runData: import('../services/cloud.service').RunData = {
    project_id: projectId,
    environment: options.ci || process.env.CI ? 'ci' : 'local',
    ci_provider: ciProvider,
    total_tests: results.totalTests,
    passed_tests: results.passedTests,
    failed_tests: results.failedTests,
    duration_ms: results.durationMs,
    cost_usd: results.totalCost,
    started_at: new Date(Date.now() - results.durationMs).toISOString(),
    completed_at: new Date().toISOString(),
    test_results: results.tests,
    ...gitContext,
  };

  console.log(chalk.blue('\n☁️  Uploading results to Cloud...'));

  const uploadResult = await cloudService.uploadRun(runData);

  if (uploadResult.success) {
    console.log(chalk.green('✅ Results uploaded successfully'));
    console.log(chalk.gray(`View at: ${uploadResult.url}\n`));
  } else {
    console.log(chalk.yellow('⚠️  Failed to upload results:'), uploadResult.error);
  }
}