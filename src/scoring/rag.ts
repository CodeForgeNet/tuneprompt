export class RAGScorer {
    async score(params: { expected: string; actual: string }) {
        return { score: 1.0, reasoning: 'Simulated RAG pass' };
    }
}
