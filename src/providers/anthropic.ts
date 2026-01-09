import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderResponse } from './base';
import { ProviderConfig } from '../types';

export class AnthropicProvider extends BaseProvider {
    private client: Anthropic;

    constructor(config: ProviderConfig) {
        super(config);
        this.client = new Anthropic({
            apiKey: config.apiKey
        });
    }

    async complete(prompt: string | { system?: string; user: string }): Promise<ProviderResponse> {
        const systemPrompt = typeof prompt === 'string' ? undefined : prompt.system;
        const userPrompt = typeof prompt === 'string' ? prompt : prompt.user;

        const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 1000,
            temperature: this.config.temperature,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        });

        const content = response.content[0].type === 'text'
            ? response.content[0].text
            : '';

        return {
            content,
            tokens: response.usage.input_tokens + response.usage.output_tokens,
            cost: this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)
        };
    }

    async getEmbedding(text: string): Promise<number[]> {
        // Anthropic doesn't provide embeddings, use OpenAI as fallback
        // or implement a separate embedding service
        throw new Error('Anthropic does not support embeddings. Use OpenAI provider.');
    }

    private calculateCost(inputTokens: number, outputTokens: number): number {
        // Claude Sonnet 4 pricing (example)
        const inputCostPer1M = 3.00;
        const outputCostPer1M = 15.00;

        return (
            (inputTokens / 1_000_000) * inputCostPer1M +
            (outputTokens / 1_000_000) * outputCostPer1M
        );
    }
}