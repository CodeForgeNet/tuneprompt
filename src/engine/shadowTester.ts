import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { FailedTest } from '../types/fix';
import { calculateSemanticSimilarity } from '../scoring/semantic';

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

    const provider = test.config?.provider;
    const model = test.config?.model;

    // If specific provider/model is requested, use it directly (Strict Mode)
    if (provider && model) {
        try {
            const output = await runSpecificTest(candidatePrompt, test.input, provider, model);
            const { score, failureReason } = await scoreOutput(output, test.expectedOutput, test.errorType);
            return {
                score,
                output,
                passed: score >= test.threshold,
                failureReason
            };
        } catch (error: any) {
            console.log(`⚠️ Specified provider ${provider} failed: ${error.message}`);
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

async function runSpecificTest(
    prompt: string,
    input: Record<string, any> | undefined,
    provider: string,
    model: string
): Promise<string> {
    const apiKey = getApiKeyForProvider(provider);
    if (!apiKey) {
        throw new Error(`No API key found for provider: ${provider}`);
    }

    switch (provider) {
        case 'anthropic':
            return runAnthropicTest(prompt, input, model);
        case 'openai':
            return runOpenAITest(prompt, input, model);
        case 'openrouter':
            return runOpenRouterTest(prompt, input, model);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

function getApiKeyForProvider(provider: string): string | undefined {
    switch (provider) {
        case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
        case 'openai':
            return process.env.OPENAI_API_KEY;
        case 'openrouter':
            return process.env.OPENROUTER_API_KEY;
        default:
            return undefined;
    }
}

async function runAnthropicTest(
    prompt: string,
    input: Record<string, any> | undefined,
    model: string
): Promise<string> {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });

    const finalPrompt = interpolateVariables(prompt, input);

    const response = await anthropic.messages.create({
        model: model,
        max_tokens: 2000,
        messages: [{
            role: 'user',
            content: finalPrompt
        }]
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
}

async function runOpenAITest(
    prompt: string,
    input: Record<string, any> | undefined,
    model: string
): Promise<string> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const finalPrompt = interpolateVariables(prompt, input);

    const response = await openai.chat.completions.create({
        model: model,
        messages: [{
            role: 'user',
            content: finalPrompt
        }]
    });

    return response.choices[0]?.message?.content || '';
}

async function runOpenRouterTest(
    prompt: string,
    input: Record<string, any> | undefined,
    model: string
): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: key
    });

    const finalPrompt = interpolateVariables(prompt, input);
    const response = await openai.chat.completions.create({
        model: model,
        messages: [{
            role: 'user',
            content: finalPrompt
        }]
    });

    return response.choices[0]?.message?.content || '';
}

function interpolateVariables(
    prompt: string,
    variables?: Record<string, any>
): string {
    if (!variables) return prompt;

    let result = prompt;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
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