#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { historyCommand } from './commands/history';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('tuneprompt')
    .description('Industrial-grade testing framework for LLM prompts')
    .version('0.1.0');

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
    .action(async (options) => {
        if (options.watch) {
            await runWatchMode(options);
        } else {
            await runCommand(options);
        }
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
        await runCommand(options);
    });

    watcher.on('add', async (path: string) => {
        console.log(chalk.dim(`\n➕ New test file: ${path}\n`));
        await runCommand(options);
    });
}

// Error handling
process.on('unhandledRejection', (error: any) => {
    console.error(chalk.red('\n❌ Unhandled error:'), error.message);
    process.exit(1);
});

program.parse();