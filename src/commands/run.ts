import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../utils/config';
import { TestLoader } from '../engine/loader';
import { TestRunner } from '../engine/runner';
import { TestReporter } from '../engine/reporter';
import { TestDatabase } from '../storage/database';

export interface RunOptions {
    config?: string;
    watch?: boolean;
    ci?: boolean;
}

export async function runCommand(options: RunOptions) {
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

        // Show upsell hint if tests failed
        if (results.failed > 0) {
            console.log(chalk.dim('\n─────────────────────────────────────────────────'));
            console.log(chalk.cyan('💡 HINT: ') +
                `${results.failed} test(s) failed. Don't waste time debugging manually.`);
            console.log(chalk.cyan('   Run ') + chalk.bold('tuneprompt fix') +
                chalk.cyan(' to let AI repair these prompts instantly.'));
            console.log(chalk.dim('─────────────────────────────────────────────────\n'));
        }

        // Exit with error code in CI mode
        if (options.ci && results.failed > 0) {
            process.exit(1);
        }

    } catch (error: any) {
        spinner.fail('Test run failed');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
}