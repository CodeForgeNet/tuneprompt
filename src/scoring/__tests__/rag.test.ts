import { RAGScorer } from '../rag';

describe('RAGScorer', () => {
    it('should instantiate and evaluate', async () => {
        const scorer = new RAGScorer();
        const result = await scorer.score({ expected: '', actual: 'Test' });
        expect(result.score).toBeDefined();
    });
});
