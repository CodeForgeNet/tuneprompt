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

    // If specific provider/model is requested, use it directly (Strict Mode)
    if (providerName && model) {
        try {
            const apiKey = ProviderFactory.getApiKey(providerName);
            if (!apiKey) {
                throw new Error(`No API key found for provider: ${providerName}`);
            }

            const provider = ProviderFactory.create(providerName, {
                apiKey,
                model,
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
            console.log(`⚠️ Specified provider ${providerName} failed: ${error.message}`);
            throw new Error(`Failed to validate on target model: ${error.message}`);
        }
    }

    // Phase 2 Decision: Fail fast if no provider/model is defined (Strict Awareness)
    throw new Error(`Test "${test.description}" lacks provider/model configuration. Validation aborted.`);
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