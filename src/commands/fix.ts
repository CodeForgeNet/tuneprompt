import chalk from 'chalk';
import inquirer from 'inquirer';
import { TestDatabase } from '../storage/database';
import { TestRunner } from '../engine/runner';
import { loadConfig } from '../utils/config';
import { buildOptimizationPrompt } from '../engine/metaPrompt';


export async function fixCommand() {
    console.log(chalk.bold('\n🔧 TunePrompt Auto-Fix Engine\n'));

    // 1. Get failed tests from DB
    const db = new TestDatabase();
    const lastRun = db.getRecentRuns(1)[0];
    db.close();

    if (!lastRun || lastRun.failed === 0) {
        console.log(chalk.green('✓ No recent failures found to fix!'));
        return;
    }

    const failedResults = lastRun.results.filter(r => r.status === 'fail');
    console.log(chalk.yellow(`Found ${failedResults.length} failing test(s) to analyze.\n`));

    // 2. Initialize Runner (for shadow testing)
    const config = await loadConfig();
    const runner = new TestRunner(config);

    // 3. Fix Loop
    for (const result of failedResults) {
        console.log(chalk.bold(`\n📝 Analyzing: ${result.testCase.description}`));
        console.log(chalk.dim(`   Current Score: ${result.score.toFixed(2)}`));

        // Generate candidate fix
        try {
            console.log(chalk.cyan('   🧠 Generating optimization candidates...'));

            // We use the "runner" providers to generate the fix itself
            // NOTE: Ideally we'd have a specific "optimizer" provider, but we reuse the test runner's
            // generic capability here.
            // For now, we manually create an optimization payload

            // HACK: Access protected providers map or instantiate a raw one. 
            // Better design: Make TestRunner expose a "complete" method or "getProvider"
            // For MVP, we'll instantiate OpenAI or OpenRouter directly if possible, or use the runner execution?
            // Actually, we can just use the provider attached to the test case config or default!

            // Simplified: Just use the first available provider from config for the fix logic
            // In a real implementation this would be more robust

            // We need a way to run a raw prompt. The TestRunner executes TestCases.
            // Let's create a temporary TestCase for the optimization task.
            const metaPrompt = buildOptimizationPrompt(
                typeof result.testCase.prompt === 'string' ? result.testCase.prompt : JSON.stringify(result.testCase.prompt),
                result.actualOutput,
                result.expectedOutput,
                result.error || `Score ${result.score} < Threshold`
            );

            // Using the runner to execute the meta-prompt
            // This is a bit of a hack re-using the test runner as a client wrapper
            const fixResult = await runner['runSingleTest']({
                description: 'Internal Meta-Prompt',
                prompt: metaPrompt,
                expect: '', // No expectation, we just want output
                config: {
                    // Force using a smart model if possible, or same as test
                    provider: result.testCase.config?.provider,
                    method: 'exact' // Dummy method so we don't error on scoring (we ignore the score)
                }
            });

            const candidatePromptRaw = fixResult.actualOutput;
            // Clean up the output (remove quotes, markdown)
            const candidatePrompt = candidatePromptRaw.replace(/^["']|["']$/g, '').trim();

            console.log(chalk.green('   ✨ Candidate generated!'));
            console.log(chalk.dim('   -----------------------------------'));
            console.log(chalk.white(candidatePrompt));
            console.log(chalk.dim('   -----------------------------------'));

            // 4. Shadow Test
            console.log(chalk.cyan('   🔄 Verifying fix (Shadow Testing)...'));
            const shadowTest = {
                ...result.testCase,
                prompt: candidatePrompt
            };

            const shadowResult = await runner['runSingleTest'](shadowTest);

            if (shadowResult.status === 'pass') {
                console.log(chalk.green(`   ✓ Fix Verified! New Score: ${shadowResult.score.toFixed(2)}`));

                const { apply } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'apply',
                    message: 'Apply this fix to your test file?',
                    default: true
                }]);

                if (apply) {
                    // TODO: This is tricky. We need to find the source file.
                    // The Loader doesn't currently attach source file path to TestCase.
                    // For Phase 2 MVP, we will just print "Please update your file manually"
                    // unless we upgrade Loader to track file lineage.

                    // UPGRADE: Update file logic would go here.
                    console.log(chalk.blue('   ℹ️  Automatic file updating coming in v0.2.0'));
                    console.log(chalk.blue('      Please copy/paste the new prompt manually for now.'));
                }

            } else {
                console.log(chalk.red(`   ✗ Fix failed verification (Score: ${shadowResult.score.toFixed(2)}).`));
                console.log(chalk.dim('      Skipping...'));
            }

        } catch (error: any) {
            console.log(chalk.red(`   ⚠ Optimization failed: ${error.message}`));
        }
    }
}
