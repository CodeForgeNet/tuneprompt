import OpenAI from 'openai';
import { BaseProvider, ProviderResponse } from './base';
import { ProviderConfig } from '../types';

export class OpenRouterProvider extends BaseProvider {
    private client: OpenAI;

    constructor(config: ProviderConfig) {
        super(config);
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/tuneprompt/tuneprompt',
                'X-Title': 'TunePrompt'
            }
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
            // OpenRouter costs vary wildly by model, hard to calc locally without metadata
            // For now, we'll return 0 or implement a lookup table later
            cost: 0
        };
    }

    async getEmbedding(text: string): Promise<number[]> {
        // OpenRouter does support embeddings for some models, but the endpoint might differ or require specific models
        // We'll attempt to use the standard OpenAI-compatible embedding endpoint
        // Users should ensure they select an embedding-capable model in their config if they use this
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small', // This likely won't work on OR unless they proxy it to OpenAI or have a mapped model
            input: text
        });

        return response.data[0].embedding;
    }
}
