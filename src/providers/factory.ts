import { ProviderConfig } from '../types';
import { BaseProvider } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';

export class ProviderFactory {
    static create(provider: string, config: ProviderConfig): BaseProvider {
        switch (provider.toLowerCase()) {
            case 'openai':
                return new OpenAIProvider(config);
            case 'anthropic':
                return new AnthropicProvider(config);
            case 'gemini':
                return new GeminiProvider(config);
            case 'openrouter':
                return new OpenRouterProvider(config);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    static getApiKey(provider: string): string | undefined {
        switch (provider.toLowerCase()) {
            case 'openai':
                return process.env.OPENAI_API_KEY;
            case 'anthropic':
                return process.env.ANTHROPIC_API_KEY;
            case 'gemini':
                return process.env.GEMINI_API_KEY;
            case 'openrouter':
                return process.env.OPENROUTER_API_KEY;
            default:
                return undefined;
        }
    }
}
