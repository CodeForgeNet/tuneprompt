import { Command } from 'commander';

export function registerGenerateCommand(program: Command) {
    program
        .command('generate')
        .description('Generate a new test file interactively')
        .action(async () => {
            console.log('Wizard started');
        });
}
