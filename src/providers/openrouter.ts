import axios from 'axios';
import { BaseProvider, ProviderResponse } from './base';
import { ProviderConfig } from '../types';

export class OpenRouterProvider extends BaseProvider {
    private baseURL: string;

    constructor(config: ProviderConfig) {
        super(config);
        this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
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

        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: this.config.model,
                    messages,
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'HTTP-Referer': 'https://github.com/tuneprompt/tuneprompt',
                        'X-Title': 'TunePrompt',
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = response.data;
            const content = data.choices?.[0]?.message?.content || '';
            const tokens = data.usage?.total_tokens || 0;

            return {
                content,
                tokens,
                cost: 0
            };
        } catch (error: any) {
            if (error.response) {
                const errorMsg = error.response.data?.error?.message || JSON.stringify(error.response.data);
                throw new Error(`OpenRouter API Error (${error.response.status}): ${errorMsg}`);
            }
            throw new Error(`OpenRouter network error: ${error.message}`);
        }
    }

    async getEmbedding(text: string): Promise<number[]> {
        try {
            // Attempt to use OpenRouter's embedding endpoint (which proxies to OpenAI or others)
            // Note: User must be entitled to use the requested embedding model
            const response = await axios.post(
                `${this.baseURL}/embeddings`,
                {
                    model: 'text-embedding-3-small', // Default fallback, customizable in future
                    input: text
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'HTTP-Referer': 'https://github.com/tuneprompt/tuneprompt',
                        'X-Title': 'TunePrompt',
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.data[0].embedding;
        } catch (error: any) {
            if (error.response) {
                const errorMsg = error.response.data?.error?.message || JSON.stringify(error.response.data);
                throw new Error(`OpenRouter Embedding Error (${error.response.status}): ${errorMsg}`);
            }
            throw new Error(`OpenRouter embedding network error: ${error.message}`);
        }
    }
}
