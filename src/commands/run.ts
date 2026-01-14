import ora from 'ora';
import chalk from 'chalk';
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
        displayRunSummary(results.results);

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



async function displayResults(results: TestResult[]) {
    const failures = results.filter(r => r.status === 'fail');
    const passes = results.filter(r => r.status === 'pass');

    console.log('\n' + chalk.bold('Test Results:'));
    console.log(chalk.green(`✅ ${passes.length} passed`));
    console.log(chalk.red(`❌ ${failures.length} failed`));

    // Show failures
    if (failures.length > 0) {
        console.log('\n' + chalk.bold.red('Failed Tests:\n'));

        failures.forEach((test, index) => {
            console.log(chalk.red(`${index + 1}. ${test.testCase.description}`));
            console.log(chalk.gray(`   Expected: ${test.expectedOutput.substring(0, 80)}...`));
            console.log(chalk.gray(`   Got: ${test.actualOutput.substring(0, 80)}...`));
            console.log(chalk.gray(`   Score: ${test.score.toFixed(2)} (threshold: ${test.testCase.config?.threshold || 0.8})\n`));
        });

        // ⭐ UPSELL SECTION
        showFixUpsell(failures.length);
    }
}

function showFixUpsell(failureCount: number) {
    const license = getLicenseInfo();

    if (license) {
        // User has premium - encourage them to use fix
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.bold.cyan(`💡 ${failureCount} test${failureCount > 1 ? 's' : ''} failed`));
        console.log('\n' + chalk.gray('Let AI fix these prompts automatically:'));
        console.log('  ' + chalk.bold('tuneprompt fix'));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    } else {
        // User is on free tier - show upgrade prompt
        console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.bold(`💡 ${failureCount} test${failureCount > 1 ? 's' : ''} failed`));
        console.log('\n' + chalk.gray('Stop debugging manually. Let AI fix these prompts:'));
        console.log('  ' + chalk.bold('tuneprompt fix') + chalk.red(' (Premium)'));
        console.log('\n' + chalk.bold('What you get:'));
        console.log(chalk.gray('  ✅ AI analyzes why each test failed'));
        console.log(chalk.gray('  ✅ Generates optimized prompt variations'));
        console.log(chalk.gray('  ✅ Shadow tests fixes before applying'));
        console.log(chalk.gray('  ✅ Interactive diff viewer\n'));
        console.log(chalk.bold('Get started:'));
        console.log(chalk.gray(`  ${chalk.blue.underline('http://localhost:8080')}`));
        console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    }
}