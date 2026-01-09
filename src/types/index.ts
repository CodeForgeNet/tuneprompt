export interface TestCase {
    description: string;
    prompt: string | { system?: string; user: string };
    variables?: Record<string, any>;
    expect: string | Record<string, any>;
    config?: {
        threshold?: number;
        method?: 'exact' | 'semantic' | 'json' | 'llm-judge';
        model?: string;
        provider?: 'openai' | 'anthropic' | 'openrouter';
    };
}

export interface TestResult {
    id: string;
    testCase: TestCase;
    status: 'pass' | 'fail' | 'error';
    score: number;
    actualOutput: string;
    expectedOutput: string;
    error?: string;
    metadata: {
        duration: number;
        timestamp: Date;
        tokens?: number;
        cost?: number;
        provider?: string;
    };
}

export interface TestRun {
    id: string;
    timestamp: Date;
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
    results: TestResult[];
}

export interface ProviderConfig {
    apiKey: string;
    model: string;
    baseURL?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface TunePromptConfig {
    providers: {
        openai?: ProviderConfig;
        anthropic?: ProviderConfig;
        openrouter?: ProviderConfig;
    };
    threshold?: number;
    testDir?: string;
    outputFormat?: 'json' | 'table' | 'both';
}