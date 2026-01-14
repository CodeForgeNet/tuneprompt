import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { activateLicense, getLicenseInfo } from '../utils/license';

export async function activateCommand(subscriptionId?: string) {
    console.log(chalk.bold.cyan('\n🔑 Activate TunePrompt Premium\n'));

    // Check if already activated
    const existingLicense = getLicenseInfo();
    if (existingLicense) {
        console.log(chalk.yellow('⚠️  A license is already activated on this machine.\n'));
        console.log(chalk.gray(`Email: ${existingLicense.email}`));
        console.log(chalk.gray(`Plan: ${existingLicense.plan}`));
        console.log(chalk.gray(`Activated: ${new Date(existingLicense.activatedAt).toLocaleDateString()}\n`));

        const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to replace it with a new license?',
            default: false
        }]);

        if (!overwrite) {
            console.log(chalk.gray('\nActivation cancelled.'));
            return;
        }
    }

    // Get subscription ID if not provided
    if (!subscriptionId) {
        const answers = await inquirer.prompt([{
            type: 'input',
            name: 'subscriptionId',
            message: 'Enter your Razorpay Subscription ID:',
            validate: (input: string) => {
                if (!input || input.trim().length === 0) {
                    return 'Subscription ID is required';
                }
                if (!input.startsWith('sub_')) {
                    return 'Invalid format. Razorpay Subscription IDs start with "sub_"';
                }
                return true;
            }
        }]);

        subscriptionId = answers.subscriptionId;
    }

    const { email } = await inquirer.prompt([{
        type: 'input',
        name: 'email',
        message: 'Enter your email address:',
        validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Please enter a valid email address';
        }
    }]);

    const { plan } = await inquirer.prompt([{
        type: 'list',
        name: 'plan',
        message: 'Select your plan:',
        choices: [
            { name: 'Pro Monthly (₹999/month)', value: 'pro-monthly' },
            { name: 'Pro Yearly (₹9,999/year)', value: 'pro-yearly' },
            { name: 'Lifetime (₹24,999 one-time)', value: 'lifetime' }
        ]
    }]);

    // Activate the license
    const spinner = ora('Verifying subscription...').start();

    const success = await activateLicense(subscriptionId!, email, plan);

    if (success) {
        spinner.succeed('License activated successfully!');

        console.log(chalk.green('\n✅ TunePrompt Premium is now active!\n'));
        console.log(chalk.bold('Premium features unlocked:'));
        console.log(chalk.gray('  • tuneprompt fix (Auto-Fix Engine)'));
        console.log(chalk.gray('  • Cloud sync & team collaboration'));
        console.log(chalk.gray('  • Advanced diagnostics\n'));

        console.log(chalk.cyan('Try running:'), chalk.bold('tuneprompt fix\n'));

    } else {
        spinner.fail('Activation failed');

        console.log(chalk.red('\n❌ Could not activate license\n'));
        console.log(chalk.yellow('Possible reasons:'));
        console.log(chalk.gray('  • Invalid subscription ID'));
        console.log(chalk.gray('  • Subscription is not active'));
        console.log(chalk.gray('  • Network connection issue\n'));

        console.log(chalk.bold('Need help?'));
        console.log(chalk.gray(`  • Check your subscription: ${chalk.blue.underline('https://razorpay.com/my-subscriptions')}`));
        console.log(chalk.gray(`  • Contact support: ${chalk.blue.underline('support@tuneprompt.com')}\n`));
    }
}