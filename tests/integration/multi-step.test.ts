import { validateTestFile } from '../../src/utils/validator';

describe('Multi-step test validation', () => {
    it('should allow an array of steps instead of a single prompt', () => {
        const multiStepConfig = [{
            steps: [
                { prompt: "Hello", expect: "Hi" },
                { prompt: "How are you", expect: "Good" }
            ]
        }];
        expect(() => validateTestFile(multiStepConfig)).not.toThrow();
    });
});
