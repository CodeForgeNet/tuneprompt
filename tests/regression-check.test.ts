import { describe, it, expect, jest } from '@jest/globals';
import { PromptOptimizer } from '../src/engine/optimizer';
import { FailedTest } from '../src/types/fix';

jest.mock('../src/engine/shadowTester', () => ({
    runShadowTest: jest.fn(),
    runSuiteShadowTest: jest.fn()
}));

import { runShadowTest, runSuiteShadowTest } from '../src/engine/shadowTester';

describe('PromptOptimizer: Anti-Regression', () => {
    process.env.TUNEPROMPT_MOCK_OPTIMIZER = 'true';
    const optimizer = new PromptOptimizer();

    it('should reject a candidate that causes a regression in other tests', async () => {
        const failedTest: FailedTest = {
            id: 'test-1',
            description: 'Fixing A',
            prompt: 'Initial prompt',
            expectedOutput: 'A',
            actualOutput: 'Wrong',
            score: 0.2, // Failed case
            threshold: 0.8,
            errorType: 'exact',
            errorMessage: 'Output was not A',
            config: { provider: 'openai', model: 'gpt-4o' }
        };

        const passingTest: FailedTest = {
            id: 'test-2',
            description: 'Stable case B',
            prompt: 'Initial prompt',
            expectedOutput: 'B',
            actualOutput: 'B',
            score: 1.0, // Passing case
            threshold: 0.8,
            errorType: 'exact',
            errorMessage: '',
            config: { provider: 'openai', model: 'gpt-4o' }
        };

        const suite = [failedTest, passingTest];
        // Initial aggregate score = (0.2 + 1.0) / 2 = 0.6

        // Mock Candidate A: Fixes primary failure but breaks passing test
        // Primary score: 1.0, Suite score: (1.0 + 0.1) / 2 = 0.55 (Regression from 0.6)

        // Mock Candidate B: Fixes primary failure AND keeps passing test
        // Primary score: 1.0, Suite score: (1.0 + 1.0) / 2 = 1.0 (Improvement from 0.6)

        (runShadowTest as any).mockResolvedValueOnce({ score: 1.0, passed: true, output: 'A' }) // Candidate A primary
            .mockResolvedValueOnce({ score: 1.0, passed: true, output: 'A' }); // Candidate B primary

        (runSuiteShadowTest as any).mockResolvedValueOnce({ aggregateScore: 0.55, results: [] }) // Candidate A suite
            .mockResolvedValueOnce({ aggregateScore: 1.0, results: [] }); // Candidate B suite

        const result = await optimizer.optimize(failedTest, suite);

        expect(result.testResults.aggregateScore).toBe(1.0);
        expect(result.optimizedPrompt).toContain('candidate');
        expect(runSuiteShadowTest).toHaveBeenCalledTimes(2);
    });
});
