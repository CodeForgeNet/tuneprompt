export interface FailedTest {
    id: string;
    description: string;
    prompt: string;
    input?: Record<string, any>;
    expectedOutput: string;
    actualOutput: string;
    score: number;
    threshold: number;
    errorType: 'semantic' | 'json' | 'exact' | 'length';
    errorMessage: string;
    config?: {
        provider?: string;
        model?: string;
    };
}

export interface OptimizationResult {
    originalPrompt: string;
    optimizedPrompt: string;
    reasoning: string;
    confidence: number;
    testResults: {
        score: number;
        passed: boolean;
        output: string;
        aggregateScore?: number;
    };
    iterations?: number;
}

export interface FixCandidate {
    prompt: string;
    score: number;
    reasoning: string;
    testResults?: {
        testId: string;
        score: number;
        passed: boolean;
    }[];
}