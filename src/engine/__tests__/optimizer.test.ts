import { PromptOptimizer } from '../optimizer';

describe('Optimizer Refinement Loop', () => {
    it('should support tracking Max Iterations', () => {
        const opt = new PromptOptimizer({ maxIterations: 3 });
        expect(opt.maxIterations).toBe(3);
    });
});
