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
export async function calculateSemanticSimilarity(actual: string, expected: string): Promise<number> {
    const providersToTry = [];

    // Prioritize OpenAI if key looks potentially valid
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('api_key')) {
        providersToTry.push('openai');
    }

    // Always try OpenRouter if key is present
    if (process.env.OPENROUTER_API_KEY) {
        providersToTry.push('openrouter');
    }

    // Fallback to OpenAI if nothing else was added
    if (providersToTry.length === 0) {
        providersToTry.push('openai');
    }

    let lastError: any;

    for (const providerType of providersToTry) {
        try {
            let provider;
            if (providerType === 'openai') {
                const { OpenAIProvider } = await import('../providers/openai');
                provider = new OpenAIProvider({
                    apiKey: process.env.OPENAI_API_KEY || '',
                    model: 'text-embedding-3-small'
                });
            } else {
                const { OpenRouterProvider } = await import('../providers/openrouter');
                provider = new OpenRouterProvider({
                    apiKey: process.env.OPENROUTER_API_KEY || '',
                    model: 'text-embedding-3-small'
                });
            }

            const scorer = new SemanticScorer(provider);
            return await scorer.score(expected, actual);
        } catch (error) {
            lastError = error;
            continue;
        }
    }

    throw lastError || new Error('No embedding provider available');
}
