import OpenAI from 'openai';
import { BaseProvider, ProviderResponse } from './base';
import { ProviderConfig } from '../types';

export class OpenAIProvider extends BaseProvider {
    private client: OpenAI;

    constructor(config: ProviderConfig) {
        super(config);
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL
        });
    }

    async complete(prompt: string | { system?: string; user: string }): Promise<ProviderResponse> {
        const messages: any[] = [];

        if (typeof prompt === 'string') {
            messages.push({ role: 'user', content: prompt });
        } else {
            if (prompt.system) {
                messages.push({ role: 'system', content: prompt.system });
            }
            messages.push({ role: 'user', content: prompt.user });
        }

        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
        });

        const content = response.choices[0]?.message?.content || '';
        const tokens = response.usage?.total_tokens;

        return {
            content,
            tokens,
            cost: this.calculateCost(tokens || 0)
        };
    }

    async getEmbedding(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text
        });

        return response.data[0].embedding;
    }

    private calculateCost(tokens: number): number {
        // Pricing for GPT-4o (example rates)
        const inputCostPer1k = 0.005;
        const outputCostPer1k = 0.015;

        // Simplified: assume 50/50 input/output split
        return ((tokens / 1000) * (inputCostPer1k + outputCostPer1k)) / 2;
    }
}