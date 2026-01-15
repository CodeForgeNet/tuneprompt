import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { PromptOptimizer } from '../engine/optimizer';
import { checkLicense, getLicenseInfo } from '../utils/license';
import { trackFixAttempt } from '../utils/analytics';
import { getFailedTests } from '../utils/storage';
import { FailedTest } from '../types/fix';
import * as fs from 'fs';
import * as path from 'path';
import { handleError, Errors } from '../utils/errorHandler';

export async function fixCommand() {
    try {
        console.log(chalk.bold.cyan('\n🔧 TunePrompt Fix\n'));

        // License check with better error
        const spinner = ora('Checking license...').start();
        const licenseValid = await checkLicense();

        if (!licenseValid) {
            spinner.fail('Premium feature locked');
            showUpgradePrompt();
            throw Errors.NO_LICENSE;
        }

        spinner.succeed('License validated');

        // Load failed tests with error handling
        const failedTests = await getFailedTests();

        if (failedTests.length === 0) {
            throw Errors.NO_FAILED_TESTS;
        }

        console.log(chalk.yellow(`\nFound ${failedTests.length} failed test(s):\n`));

        failedTests.forEach((test: FailedTest, index: number) => {
            console.log(`${index + 1}. ${chalk.bold(test.description)}`);
            console.log(`   Score: ${chalk.red(test.score.toFixed(2))} (threshold: ${test.threshold})`);
        });

        // Step 3: Ask which tests to fix
        const { selectedIndexes } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedIndexes',
            message: 'Which tests would you like to fix?',
            choices: failedTests.map((test: FailedTest, index: number) => ({
                name: `${test.description} (score: ${test.score.toFixed(2)})`,
                value: index,
                checked: true
            }))
        }]);

        if (selectedIndexes.length === 0) {
            console.log(chalk.gray('\nNo tests selected. Exiting.'));
            return;
        }

        // Step 4: Optimize each selected test
        const optimizer = new PromptOptimizer();

        for (const index of selectedIndexes) {
            const test = failedTests[index];

            console.log(chalk.bold(`\n\n━━━ Fixing: ${test.description} ━━━\n`));

            try {
                const result = await optimizer.optimize(test);
                await showDiff(result.originalPrompt, result.optimizedPrompt, result.reasoning);

                // Ask if user wants to apply
                const { action } = await inquirer.prompt([{
                    type: 'rawlist',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: 'Apply this fix (Updates your test file)', value: 'apply' },
                        { name: 'Edit before applying', value: 'edit' },
                        { name: 'Skip this fix', value: 'skip' }
                    ],
                    default: 0
                }]);

                if (action === 'apply') {
                    await applyFix(test, result.optimizedPrompt);
                    console.log(`\n${chalk.bgGreen.black(' DONE ')} ${chalk.green('Prompt updated in:')} ${chalk.bold(test.id)}`);
                    console.log(chalk.gray('The next run will use this new prompt.\n'));
                } else if (action === 'edit') {
                    console.log(chalk.gray('\nOpening editor... (Save and close to apply)\n'));
                    const { edited } = await inquirer.prompt([{
                        type: 'editor',
                        name: 'edited',
                        message: 'Edit the prompt (save and close when done):',
                        default: result.optimizedPrompt
                    }]);
                    await applyFix(test, edited);
                    console.log(chalk.green('✅ Edited fix applied!'));
                } else {
                    console.log(chalk.gray('⏭️  Skipped'));
                }
            } catch (error: any) {
                console.error(chalk.red(`\n❌ Failed to optimize "${test.description}"`));
                console.error(chalk.gray(`Reason: ${error.message}\n`));
                continue; // Skip to next test
            }
        }

        console.log(chalk.bold.green('\n\n✨ Fix session complete!\n'));
        console.log(chalk.gray('Run `tuneprompt run` to verify your fixes.\n'));

        // After fix completes
        const license = getLicenseInfo();
        if (license) {
            trackFixAttempt(
                license.email,
                selectedIndexes.length,
                true
            );
        }

    } catch (error) {
        handleError(error);
    }
}

function showUpgradePrompt() {
    console.log(chalk.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('🔒 Premium Feature: Auto-Fix Engine\n'));
    console.log('The ' + chalk.cyan('fix') + ' command uses advanced AI to automatically');
    console.log('repair your failing prompts.\n');
    console.log(chalk.bold('What you get:'));
    console.log('  ✅ AI-powered prompt optimization');
    console.log('  ✅ Shadow testing before applying fixes');
    console.log('  ✅ Interactive diff viewer');
    console.log('  ✅ Unlimited fix attempts\n');

    console.log(chalk.bold('Get Premium:'));
    console.log(`  1. Buy a license: ${chalk.blue.underline('https://tuneprompt.com/pricing')}`);
    console.log(`  2. Activate: ${chalk.gray('tuneprompt activate <your-key>')}\n`);
    console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

async function showDiff(original: string, optimized: string, reasoning: string) {
    const diffLib = await import('diff');

    console.log(chalk.bold('\n💡 AI Analysis:'));
    console.log(chalk.gray(reasoning));

    console.log(chalk.bold('\n📝 Proposed Changes:\n'));

    const diff = diffLib.diffWords(original, optimized);

    diff.forEach((part: { added?: boolean; removed?: boolean; value: string }) => {
        const color = part.added ? chalk.green :
            part.removed ? chalk.red :
                chalk.gray;

        const prefix = part.added ? '+ ' :
            part.removed ? '- ' :
                '  ';

        process.stdout.write(color(prefix + part.value));
    });

    console.log('\n');
}

async function applyFix(test: FailedTest, newPrompt: string) {
    // This assumes prompts are stored in JSON test files
    // Adjust based on your Phase 1 implementation

    const testFilePath = test.id; // Assuming ID stores file path

    if (!fs.existsSync(testFilePath)) {
        console.error(chalk.red(`Test file not found: ${testFilePath}`));
        return;
    }

    const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'));
    testData.prompt = newPrompt;

    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
}