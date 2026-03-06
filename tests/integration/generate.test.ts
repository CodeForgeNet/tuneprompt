import { execSync } from 'child_process';

describe('tuneprompt generate', () => {
    it('should create a test file when provided inputs', () => {
        const stdout = execSync('npx ts-node src/cli.ts generate --help').toString();
        expect(stdout).toContain('Generate a new test file interactively');
    });
});
