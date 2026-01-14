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
    };
}

export interface FixCandidate {
    prompt: string;
    score: number;
    reasoning: string;
}