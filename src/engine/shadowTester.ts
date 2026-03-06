import { FailedTest } from '../types/fix';
import { calculateSemanticSimilarity } from '../scoring/semantic';
import { ProviderFactory } from '../providers/factory';
import { interpolateVariables } from '../utils/interpolation';

export interface ShadowTestResult {
    score: number;
    output: string;
    passed: boolean;
    failureReason?: string;
}

export interface ShadowSuiteResult {
    aggregateScore: number;
    results: {
        testId: string;
        score: number;
        passed: boolean;
        output: string;
        failureReason?: string;
    }[];
}

/**
 * Test a candidate prompt against the original test case
 * Uses specified provider/model or falls back to priority sequence
 */
export async function runShadowTest(
    candidatePrompt: string,
    test: FailedTest
): Promise<ShadowTestResult> {
    // For integration tests: bypass real API calls if mock mode is on
    if (process.env.TUNEPROMPT_MOCK_OPTIMIZER === 'true') {
        return {
            score: 0.95,
            output: 'Mock satisfied output',
            passed: true
        };
    }

    const providerName = test.config?.provider;
    const model = test.config?.model;

    // Determine providers to try
    let providersToTry: { name: string, model?: string }[] = [];

    if (providerName && model) {
        providersToTry.push({ name: providerName, model });
    }

    // Fallback queue
    const fallbackQueue = [
        { name: 'anthropic', model: 'claude-3-5-sonnet-latest' },
        { name: 'openai', model: 'gpt-4o' },
        { name: 'gemini', model: 'gemini-2.0-flash' },
        { name: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b:free' }
    ];

    for (const entry of fallbackQueue) {
        if (entry.name !== providerName) {
            providersToTry.push(entry);
        }
    }

    let errors: string[] = [];

    for (const target of providersToTry) {
        try {
            const apiKey = ProviderFactory.getApiKey(target.name);
            if (!apiKey) continue;

            const provider = ProviderFactory.create(target.name, {
                apiKey,
                model: target.model || 'latest',
                maxTokens: 2000
            });

            const finalPrompt = interpolateVariables(candidatePrompt, test.input);
            const response = await provider.complete(finalPrompt);
            const output = response.content;

            const { score, failureReason } = await scoreOutput(output, test.expectedOutput, test.errorType);
            return {
                score,
                output,
                passed: score >= test.threshold,
                failureReason
            };
        } catch (error: any) {
            errors.push(`${target.name}: ${error.message}`);
            continue;
        }
    }

    throw new Error(`Shadow test failed for all providers: ${errors.join(' | ')}`);
}

/**
 * Run a candidate prompt against multiple tests and return aggregate results
 */
export async function runSuiteShadowTest(
    candidatePrompt: string,
    tests: FailedTest[]
): Promise<ShadowSuiteResult> {
    const results = await Promise.all(
        tests.map(async (test) => {
            const result = await runShadowTest(candidatePrompt, test);
            return {
                testId: test.id,
                score: result.score,
                passed: result.passed,
                output: result.output,
                failureReason: result.failureReason
            };
        })
    );

    const aggregateScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    return {
        aggregateScore,
        results
    };
}


async function scoreOutput(
    actual: string,
    expected: string,
    method: string
): Promise<{ score: number, failureReason?: string }> {
    switch (method) {
        case 'semantic': {
            const score = await calculateSemanticSimilarity(actual, expected);
            return { score, failureReason: score < 0.9 ? `Semantic similarity (${score.toFixed(2)}) is low. Output did not capture expected meaning.` : undefined };
        }

        case 'exact': {
            const exactMatch = actual.trim() === expected.trim();
            return {
                score: exactMatch ? 1.0 : 0.0,
                failureReason: exactMatch ? undefined : `Expected exact match but output differed.`
            };
        }

        case 'json': {
            try {
                JSON.parse(actual);
                return { score: 1.0 };
            } catch (e: any) {
                return { score: 0.0, failureReason: `Did not output valid JSON. Parse error: ${e.message}` };
            }
        }

        default:
            return { score: 0.5, failureReason: `Unknown scoring method: ${method}` };
    }
}