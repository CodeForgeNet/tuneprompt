import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { FailedTest } from '../types/fix';
import { calculateSemanticSimilarity } from '../scoring/semantic'; // From Phase 1

export interface ShadowTestResult {
    score: number;
    output: string;
    passed: boolean;
}

/**
 * Test a candidate prompt against the original test case
 * Tries providers in sequence until one succeeds
 */
export async function runShadowTest(
    candidatePrompt: string,
    originalTest: FailedTest
): Promise<ShadowTestResult> {

    // Define provider priority order
    const providers = ['anthropic', 'openai', 'openrouter'];

    // Try each provider in order
    for (const provider of providers) {
        try {
            // Check if API key exists for this provider
            const apiKey = getApiKeyForProvider(provider);
            if (!apiKey || apiKey.startsWith('api_key') || apiKey === 'phc_xxxxx') {
                // Silently skip placeholders or missing keys
                continue;
            }

            let output: string;
            if (provider === 'anthropic') {
                output = await runAnthropicTest(candidatePrompt, originalTest.input);
            } else if (provider === 'openai') {
                output = await runOpenAITest(candidatePrompt, originalTest.input);
            } else if (provider === 'openrouter') {
                output = await runOpenRouterTest(candidatePrompt, originalTest.input);
            } else {
                continue; // Unsupported provider
            }

            // Score the output using the same method as Phase 1
            const score = await scoreOutput(
                output,
                originalTest.expectedOutput,
                originalTest.errorType
            );

            return {
                score,
                output,
                passed: score >= originalTest.threshold
            };

        } catch (error: any) {
            console.log(`⚠️  ${provider} provider failed: ${error.message}`);
            continue; // Try next provider
        }
    }

    // All providers failed
    console.error('All providers failed for shadow test');
    return {
        score: 0,
        output: '',
        passed: false
    };
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
    input?: Record<string, any>
): Promise<string> {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Interpolate variables if present
    const finalPrompt = interpolateVariables(prompt, input);

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
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
    input?: Record<string, any>
): Promise<string> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const finalPrompt = interpolateVariables(prompt, input);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
            role: 'user',
            content: finalPrompt
        }]
    });

    return response.choices[0]?.message?.content || '';
}

async function runOpenRouterTest(
    prompt: string,
    input?: Record<string, any>
): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;

    // Save original key and temporarily remove it to prevent OpenAI client confusion
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
        const openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: key
        });

        const finalPrompt = interpolateVariables(prompt, input);
        const response = await openai.chat.completions.create({
            model: 'nvidia/nemotron-3-nano-30b-a3b:free',
            messages: [{
                role: 'user',
                content: finalPrompt
            }]
        });

        return response.choices[0]?.message?.content || '';
    } finally {
        // Restore original key
        if (originalOpenAIKey) {
            process.env.OPENAI_API_KEY = originalOpenAIKey;
        }
    }
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
): Promise<number> {
    switch (method) {
        case 'semantic':
            return await calculateSemanticSimilarity(actual, expected);

        case 'exact':
            return actual.trim() === expected.trim() ? 1.0 : 0.0;

        case 'json':
            try {
                JSON.parse(actual);
                return 1.0;
            } catch {
                return 0.0;
            }

        default:
            return 0.5;
    }
}