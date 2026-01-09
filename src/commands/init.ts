import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getDefaultConfigTemplate } from '../utils/config';

export async function initCommand() {
    console.log(chalk.bold('\n🎛️  TunePrompt Initialization\n'));

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'createConfig',
            message: 'Create tuneprompt.config.js?',
            default: true
        },
        {
            type: 'confirm',
            name: 'createTests',
            message: 'Create sample test file?',
            default: true
        },
        {
            type: 'confirm',
            name: 'createEnv',
            message: 'Create .env file for API keys?',
            default: true
        }
    ]);

    if (answers.createConfig) {
        const configPath = path.join(process.cwd(), 'tuneprompt.config.js');
        fs.writeFileSync(configPath, getDefaultConfigTemplate());
        console.log(chalk.green('✓ Created tuneprompt.config.js'));
    }

    if (answers.createTests) {
        const testsDir = path.join(process.cwd(), 'tests');
        if (!fs.existsSync(testsDir)) {
            fs.mkdirSync(testsDir);
        }

        const sampleTest = {
            description: 'User onboarding welcome message',
            prompt: 'Generate a friendly welcome message for a user named Alice.',
            expect: 'Welcome, Alice! We are glad you are here.',
            config: {
                threshold: 0.85,
                method: 'semantic'
            }
        };

        fs.writeFileSync(
            path.join(testsDir, 'sample.json'),
            JSON.stringify(sampleTest, null, 2)
        );
        console.log(chalk.green('✓ Created tests/sample.json'));
    }

    if (answers.createEnv) {
        const envPath = path.join(process.cwd(), '.env');
        const envContent = `OPENAI_API_KEY=your_key_here\nANTHROPIC_API_KEY=your_key_here\n`;
        fs.writeFileSync(envPath, envContent);
        console.log(chalk.green('✓ Created .env'));
    }

    console.log(chalk.bold('\n✨ Setup complete! Run "tuneprompt run" to test your prompts.\n'));
}