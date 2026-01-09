import { ProviderConfig } from '../types';

export interface ProviderResponse {
    content: string;
    tokens?: number;
    cost?: number;
}

export abstract class BaseProvider {
    protected config: ProviderConfig;

    constructor(config: ProviderConfig) {
        this.config = config;
    }

    abstract complete(prompt: string | { system?: string; user: string }): Promise<ProviderResponse>;
    abstract getEmbedding(text: string): Promise<number[]>;
}