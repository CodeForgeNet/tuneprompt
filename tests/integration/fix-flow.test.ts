import { describe, it, expect } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Fix Command Integration', () => {
  it('should complete full fix workflow', async () => {
    // 0. Create a dummy config
    const configPath = path.join(process.cwd(), 'tuneprompt.config.js');
    const configContent = `
module.exports = {
  providers: {
    openai: { apiKey: 'test-key', model: 'gpt-4o' }
  },
  threshold: 0.8,
  testDir: './tests'
};`;
    fs.writeFileSync(configPath, configContent);

    // 1. Create a test file
    const testFile = [
      {
        description: 'Test prompt',
        prompt: 'Say hello',
        expect: 'Hello! Welcome to our service.',
        config: { threshold: 0.8, method: 'semantic' }
      }
    ];

    if (!fs.existsSync('tests')) fs.mkdirSync('tests');
    fs.writeFileSync('tests/temp-test.json', JSON.stringify(testFile));

    // 2. Setup mock environment
    const testEnv = { ...process.env, TEST_MODE: 'true', TUNEPROMPT_MOCK_OPTIMIZER: 'true' };

    // 3. Run tests (will mock failures)
    await execAsync('npx ts-node src/cli.ts run', { env: testEnv });

    // 4. Activate test license
    await execAsync('npx ts-node src/cli.ts activate sub_test123', { env: testEnv });

    // 5. Run fix
    const { stdout } = await execAsync('npx ts-node src/cli.ts fix -y', { env: testEnv });

    expect(stdout).toContain('Analyzing failure');
    expect(stdout).toContain('optimized');

    // Cleanup
    fs.unlinkSync('tests/temp-test.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  }, 120000); // 120s timeout since ts-node is slow
});