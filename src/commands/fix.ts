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

export async function fixCommand(options: { yes?: boolean } = {}) {
    try {
        console.log('');

        const spinner = ora('Checking license...').start();
        const licenseValid = await checkLicense();

        if (!licenseValid) {
            spinner.fail('Premium feature locked');
            showUpgradePrompt();
            throw Errors.NO_LICENSE;
        }

        spinner.succeed('License validated');

        const failedTests = await getFailedTests();

        if (failedTests.length === 0) {
            throw Errors.NO_FAILED_TESTS;
        }

        console.log(chalk.yellow(`\n${failedTests.length} failed test(s):`));

        failedTests.forEach((test: FailedTest, index: number) => {
            console.log(chalk.gray(`  ${index + 1}. ${test.description} — score: ${chalk.red(test.score.toFixed(2))} / ${test.threshold}`));
        });

        // Step 3: Ask which tests to fix
        let selectedIndexes: number[] = [];
        if (options.yes) {
            selectedIndexes = failedTests.map((_, i) => i);
        } else {
            const response = await inquirer.prompt([{
                type: 'checkbox',
                name: 'selectedIndexes',
                message: 'Which tests would you like to fix?',
                choices: failedTests.map((test: FailedTest, index: number) => ({
                    name: `${test.description} (${test.score.toFixed(2)})`,
                    value: index,
                    checked: true
                }))
            }]);
            selectedIndexes = response.selectedIndexes;
        }

        if (selectedIndexes.length === 0) {
            console.log(chalk.gray('\nNo tests selected. Exiting.'));
            return;
        }

        // Step 4: Optimize each selected test
        const optimizer = new PromptOptimizer();

        // Load suite tests for each failing test to support anti-regression
        const { getSuiteTests } = await import('../utils/storage');

        for (const index of selectedIndexes) {
            const test = failedTests[index];
            const suite = await getSuiteTests(test.id);

            const modelInfo = test.config?.model ? ` (${test.config.model})` : '';
            console.log(chalk.bold(`\n━━━ ${test.description}${modelInfo} ━━━\n`));

            try {
                const result = await optimizer.optimize(test, suite);
                await showDiff(result.originalPrompt, result.optimizedPrompt, result.reasoning);

                // Ask if user wants to apply
                let action = 'apply';
                if (!options.yes) {
                    const response = await inquirer.prompt([{
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
                    action = response.action;
                }

                if (action === 'apply') {
                    await applyFix(test, result.optimizedPrompt);
                    console.log(chalk.green(`  ✓ Updated: ${test.id}`));
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

        console.log(chalk.bold.green('\n✨ Done. Run `tuneprompt run` to verify.\n'));

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
    console.log(chalk.yellow('\n🔒 Premium feature. Get access:'));
    console.log(chalk.gray(`   ${chalk.blue.underline('https://www.tuneprompt.xyz/pricing')}`));
    console.log(chalk.gray(`   Then: ${chalk.white('tuneprompt activate <key>')}\n`));
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