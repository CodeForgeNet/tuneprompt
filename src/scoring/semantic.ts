import { BaseProvider } from '../providers/base';

export class SemanticScorer {
    private embeddingProvider: BaseProvider;

    constructor(provider: BaseProvider) {
        this.embeddingProvider = provider;
    }

    async score(expected: string, actual: string): Promise<number> {
        const [expectedEmb, actualEmb] = await Promise.all([
            this.embeddingProvider.getEmbedding(expected),
            this.embeddingProvider.getEmbedding(actual)
        ]);

        return this.cosineSimilarity(expectedEmb, actualEmb);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}