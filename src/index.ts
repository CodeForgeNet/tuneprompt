#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runCommand } from './commands/run'; // From Phase 1
import { fixCommand } from './commands/fix';
import { activateCommand } from './commands/activate';
import { getLicenseInfo } from './utils/license';

const program = new Command();

program
    .name('tuneprompt')
    .description('Industrial-grade testing framework for LLM prompts')
    .version('1.0.0');

// Existing run command from Phase 1
program
    .command('run')
    .description('Run prompt tests')
    .option('-w, --watch', 'Watch mode for continuous testing')
    .option('--ci', 'CI mode (exit with error code on failure)')
    .option('--cloud', 'Upload results to cloud dashboard')
    .action(runCommand);

// New fix command (Premium)
program
    .command('fix')
    .description('Auto-fix failing prompts using AI (Premium)')
    .action(fixCommand);

// New activate command
program
    .command('activate [subscription-id]')
    .description('Activate your Premium license')
    .action(activateCommand);

// License status command
program
    .command('status')
    .description('Check license status')
    .action(() => {
        const license = getLicenseInfo();

        if (!license) {
            console.log(chalk.yellow('\n⚠️  No active license found\n'));
            console.log(chalk.gray('You are using the free tier.\n'));
            console.log(chalk.bold('Upgrade to Premium:'));
            console.log(chalk.gray(`  ${chalk.blue.underline('http://localhost:8080')}\n`));
            return;
        }

        console.log(chalk.green('\n✅ Premium License Active\n'));
        console.log(chalk.gray(`Email: ${license.email}`));
        console.log(chalk.gray(`Plan: ${license.plan}`));
        console.log(chalk.gray(`Activated: ${new Date(license.activatedAt).toLocaleDateString()}`));
        console.log(chalk.gray(`Last Verified: ${new Date(license.lastVerified).toLocaleDateString()}\n`));
    });

// Init command from Phase 1
program
    .command('init')
    .description('Initialize a new tuneprompt project')
    .action(async () => {
        const { initCommand } = await import('./commands/init');
        initCommand();
    });

program.parse();