import { GoogleGenAI } from '@google/genai';
import { BaseProvider, ProviderResponse } from './base';
import { ProviderConfig } from '../types';

export class GeminiProvider extends BaseProvider {
    private ai: GoogleGenAI;

    constructor(config: ProviderConfig) {
        super(config);
        this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    }

    async complete(prompt: string | { system?: string; user: string }): Promise<ProviderResponse> {
        let textContent = '';
        let systemInstruction: string | undefined = undefined;

        if (typeof prompt === 'string') {
            textContent = prompt;
        } else {
            textContent = prompt.user;
            systemInstruction = prompt.system;
        }

        const response = await this.ai.models.generateContent({
            model: this.config.model,
            contents: textContent,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature
            }
        });

        const content = response.text || '';

        return {
            content,
            tokens: 0,
            cost: 0
        };
    }

    async getEmbedding(text: string): Promise<number[]> {
        const response = await this.ai.models.embedContent({
            model: 'text-embedding-004',
            contents: text
        });
        return response.embeddings?.[0]?.values || [];
    }
}
