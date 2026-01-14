import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('Fix Command Integration', () => {
    it('should complete full fix workflow', async () => {
        // 1. Create a test file
        const testFile = {
            description: 'Test prompt',
            prompt: 'Say hello',
            expect: 'Hello! Welcome to our service.',
            config: { threshold: 0.8, method: 'semantic' }
        };

        fs.writeFileSync('tests/temp-test.json', JSON.stringify(testFile));

        // 2. Run tests (will fail)
        await execAsync('tuneprompt run');

        // 3. Activate test license
        process.env.TEST_MODE = 'true';
        await execAsync('tuneprompt activate sub_test123');

        // 4. Run fix
        const { stdout } = await execAsync('tuneprompt fix');

        expect(stdout).toContain('Analyzing failure');
        expect(stdout).toContain('optimized');

        // Cleanup
        fs.unlinkSync('tests/temp-test.json');
    }, 60000); // 60s timeout
});