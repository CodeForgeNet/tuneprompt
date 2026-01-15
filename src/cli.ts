#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { initCommand } from './commands/init';
import { runCommand as runCommandObj } from './commands/run';
import { runTests, RunOptions } from './commands/run';
import { historyCommand } from './commands/history';
import { fixCommand } from './commands/fix';
import { activateCommand } from './commands/activate';
import { getLicenseInfo } from './utils/license';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('tuneprompt')
    .description('Industrial-grade testing framework for LLM prompts')
    .version('1.0.0');

program
    .command('init')
    .description('Initialize a new tuneprompt project')
    .action(async () => {
        await initCommand();
    });

program
    .command('run')
    .description('Run prompt tests')
    .option('-c, --config <path>', 'Path to config file')
    .option('-w, --watch', 'Watch mode for continuous testing')
    .option('--ci', 'CI mode (exit with error code on failure)')
    .option('--cloud', 'Upload results to Tuneprompt Cloud')
    .action(async (options) => {
        if (options.watch) {
            await runWatchMode(options);
        } else {
            await runTests(options);
        }
    });

program
    .command('fix')
    .description('Auto-fix failing prompts using AI')
    .action(async () => {
        await fixCommand();
    });

program
    .command('history')
    .description('View test run history')
    .option('-l, --limit <number>', 'Number of runs to show', '10')
    .option('-d, --detailed', 'Show detailed results')
    .action(async (options) => {
        await historyCommand({
            limit: parseInt(options.limit),
            detailed: options.detailed
        });
    });

program
    .command('activate')
    .argument('[subscription-id]', 'Razorpay subscription ID')
    .description('Activate your Premium license')
    .action(async (subscriptionId) => {
        await activateCommand(subscriptionId);
    });

program
    .command('status')
    .description('Check license status')
    .action(async () => {
        const { checkLicense, getLicenseInfo } = await import('./utils/license');

        // First verify with backend (this will update DB and delete local license if cancelled)
        const isValid = await checkLicense();

        if (!isValid) {
            console.log(chalk.yellow('\n⚠️  No active license found\n'));
            console.log(chalk.gray('You are using the free tier.\n'));
            console.log(chalk.bold('Upgrade to Premium:'));
            console.log(chalk.gray('  ' + chalk.blue.underline('https://tuneprompt.com/pricing') + '\n'));
            return;
        }

        // If license is valid, show info
        const license = getLicenseInfo();
        if (license) {
            console.log(chalk.green('\n✅ Premium License Active\n'));
            console.log(chalk.gray(`Email: ${license.email}`));
            console.log(chalk.gray(`Plan: ${license.plan}`));
            console.log(chalk.gray(`Activated: ${new Date(license.activatedAt).toLocaleDateString()}`));
            console.log(chalk.gray(`Last Verified: ${new Date(license.lastVerified).toLocaleDateString()}\n`));
        }
    });

// Watch mode implementation
async function runWatchMode(options: any) {
    const chokidar = require('chokidar');

    console.log(chalk.cyan('👀 Watch mode enabled. Monitoring for changes...\n'));

    const watcher = chokidar.watch('./tests', {
        persistent: true,
        ignoreInitial: false
    });

    watcher.on('change', async (path: string) => {
        console.log(chalk.dim(`\n📝 Detected change in ${path}\n`));
        await runTests(options);
    });

    watcher.on('add', async (path: string) => {
        console.log(chalk.dim(`\n➕ New test file: ${path}\n`));
        await runTests(options);
    });
}

// Error handling
process.on('unhandledRejection', (error: any) => {
    console.error(chalk.red('\n❌ Unhandled error:'), error.message);
    process.exit(1);
});

program.parse();