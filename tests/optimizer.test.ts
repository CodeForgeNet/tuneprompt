import { PromptOptimizer } from '../src/engine/optimizer';
import { FailedTest } from '../src/types/fix';

describe('PromptOptimizer', () => {
    const optimizer = new PromptOptimizer();

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
            errorMessage: 'Output was not valid JSON'
        };

        const result = await optimizer.optimize(failedTest);

        expect(result.optimizedPrompt).toBeTruthy();
        expect(result.optimizedPrompt).not.toBe(failedTest.prompt);
        expect(result.reasoning).toContain('JSON');
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
            errorMessage: 'Semantic similarity too low'
        };

        const result = await optimizer.optimize(failedTest);

        expect(result.confidence).toBeGreaterThan(0.4);
        expect(result.optimizedPrompt).toContain('welcome');
    });
});