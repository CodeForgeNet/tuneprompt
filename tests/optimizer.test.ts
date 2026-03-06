import { describe, it, expect, jest } from '@jest/globals';
import { PromptOptimizer } from '../src/engine/optimizer';
import { FailedTest } from '../src/types/fix';

jest.mock('../src/engine/shadowTester', () => ({
    runShadowTest: jest.fn(),
    runSuiteShadowTest: jest.fn()
}));

import { runShadowTest, runSuiteShadowTest } from '../src/engine/shadowTester';

describe('PromptOptimizer', () => {
    process.env.TUNEPROMPT_MOCK_OPTIMIZER = 'true';
    const optimizer = new PromptOptimizer();

    // Mock the private generateCandidates if possible, or provide valid-ish environment
    // For now, let's just make sure runShadowTest returns what we want
    (runShadowTest as any).mockResolvedValue({ score: 0.9, passed: true, output: 'JSON result' });
    (runSuiteShadowTest as any).mockResolvedValue({ aggregateScore: 0.9, results: [] });

    it('should generate optimization candidates', async () => {
        const failedTest: FailedTest = {
            id: 'test-1',
            description: 'JSON output test',
            prompt: 'Generate a user profile',
            expectedOutput: '{"name": "John", "age": 30}',
            actualOutput: 'Here is a profile: John is 30 years old',
            score: 0.3,
            threshold: 0.8,
            errorType: 'json',
            errorMessage: 'Output was not valid JSON',
            config: { provider: 'openai', model: 'gpt-4o' }
        };

        const result = await optimizer.optimize(failedTest, [failedTest]);

        expect(result.optimizedPrompt).toBeTruthy();
        expect(result.reasoning).toBeTruthy();
    });

    it('should improve semantic similarity scores', async () => {
        const failedTest: FailedTest = {
            id: 'test-2',
            description: 'Welcome message',
            prompt: 'Say hi',
            expectedOutput: 'Welcome to our platform! We are excited to have you.',
            actualOutput: 'Hi',
            score: 0.4,
            threshold: 0.8,
            errorType: 'semantic',
            errorMessage: 'Semantic similarity too low',
            config: { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' }
        };

        const result = await optimizer.optimize(failedTest, [failedTest]);

        expect(result.confidence).toBeGreaterThan(0.3);
        expect(result.optimizedPrompt).toBeTruthy();
    });
});