import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { FailedTest, OptimizationResult, FixCandidate } from '../types/fix';
import {
    generateOptimizationPrompt,
    generateJSONFixPrompt,
    generateSemanticFixPrompt
} from './metaPrompt';
import { generateErrorContext } from './constraintExtractor';

export class PromptOptimizer {
    private anthropic?: Anthropic;
    private openai?: OpenAI;
    private openrouter?: OpenAI;

    constructor() {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey &&
            !anthropicKey.includes('your_key') &&
            !anthropicKey.startsWith('api_key') &&
            anthropicKey !== 'phc_xxxxx') {
            this.anthropic = new Anthropic({
                apiKey: anthropicKey
            });
        }

        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey && !openaiKey.includes('your_key')) {
            this.openai = new OpenAI({
                apiKey: openaiKey
            });
        }

        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if (openrouterKey && !openrouterKey.includes('your_key')) {
            this.openrouter = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: openrouterKey,
                defaultHeaders: {
                    'HTTP-Referer': 'https://tuneprompt.xyz',
                    'X-Title': 'TunePrompt CLI',
                },
            });
        }
    }

    /**
     * Main optimization method
     */
    async optimize(failedTest: FailedTest): Promise<OptimizationResult> {
        console.log(`\n🧠 Analyzing failure: "${failedTest.description}"`);

        // Step 1: Extract constraints and build context
        const errorContext = generateErrorContext(failedTest);

        // Step 2: Choose the right meta-prompt based on error type
        const metaPrompt = this.selectMetaPrompt(failedTest, errorContext);

        // Step 3: Generate fix candidates using Claude
        console.log('⚡ Generating optimized prompt candidates...');
        const candidates = await this.generateCandidates(metaPrompt, failedTest);

        // Step 4: Shadow test each candidate
        console.log('🧪 Shadow testing candidates...');
        const bestCandidate = await this.selectBestCandidate(
            candidates,
            failedTest
        );

        return {
            originalPrompt: failedTest.prompt,
            optimizedPrompt: bestCandidate.prompt,
            reasoning: bestCandidate.reasoning,
            confidence: bestCandidate.score,
            testResults: {
                score: bestCandidate.score,
                passed: bestCandidate.score >= failedTest.threshold,
                output: '' // Will be filled by shadow tester
            }
        };
    }

    /**
     * Select appropriate meta-prompt based on error type
     */
    private selectMetaPrompt(test: FailedTest, errorContext: string): string {
        const input = {
            originalPrompt: test.prompt,
            testInput: test.input,
            expectedOutput: test.expectedOutput,
            actualOutput: test.actualOutput,
            errorType: test.errorType,
            errorMessage: errorContext
        };

        switch (test.errorType) {
            case 'json':
                return generateJSONFixPrompt(input);
            case 'semantic':
                return generateSemanticFixPrompt(input);
            default:
                return generateOptimizationPrompt(input);
        }
    }

    /**
     * Generate multiple fix candidates using available LLMs with fallback
     */
    private async generateCandidates(
        metaPrompt: string,
        failedTest: FailedTest
    ): Promise<FixCandidate[]> {
        // Define provider priority order for candidate generation
        const providers = ['anthropic', 'openai', 'openrouter'];

        for (const provider of providers) {
            try {
                // Check if we have the required client for this provider
                if (provider === 'anthropic' && this.anthropic) {
                    console.log(`⚡ Using Anthropic for candidate generation...`);
                    const response = await this.anthropic.messages.create({
                        model: 'claude-3-5-sonnet-20240620',
                        max_tokens: 4000,
                        temperature: 0.7, // Some creativity for prompt rewriting
                        messages: [{
                            role: 'user',
                            content: metaPrompt
                        }]
                    });

                    const content = response.content[0];
                    if (content.type !== 'text') {
                        throw new Error('Unexpected response type from Claude');
                    }

                    // Parse the JSON response
                    const parsed = JSON.parse(content.text);

                    return [
                        {
                            prompt: parsed.candidateA.prompt,
                            reasoning: parsed.candidateA.reasoning,
                            score: 0 // Will be filled by shadow testing
                        },
                        {
                            prompt: parsed.candidateB.prompt,
                            reasoning: parsed.candidateB.reasoning,
                            score: 0
                        }
                    ];
                } else if (provider === 'openai' && this.openai) {
                    console.log(`⚡ Using OpenAI for candidate generation...`);
                    const response = await this.openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [{
                            role: 'user',
                            content: metaPrompt
                        }],
                        response_format: { type: 'json_object' }
                    });

                    const content = response.choices[0]?.message?.content;
                    if (!content) {
                        throw new Error('No content returned from OpenAI');
                    }

                    // Parse the JSON response
                    const parsed = JSON.parse(content);

                    return [
                        {
                            prompt: parsed.candidateA.prompt,
                            reasoning: parsed.candidateA.reasoning,
                            score: 0 // Will be filled by shadow testing
                        },
                        {
                            prompt: parsed.candidateB.prompt,
                            reasoning: parsed.candidateB.reasoning,
                            score: 0
                        }
                    ];
                } else if (provider === 'openrouter' && this.openrouter) {
                    console.log(`⚡ Using OpenRouter for candidate generation...`);
                    const response = await this.openrouter.chat.completions.create({
                        model: 'anthropic/claude-3-sonnet', // Default robust model on OpenRouter
                        messages: [{
                            role: 'user',
                            content: metaPrompt
                        }],
                        response_format: { type: 'json_object' }
                    });

                    const content = response.choices[0]?.message?.content;
                    if (!content) {
                        // Fallback if model doesn't support JSON mode or returns empty
                        throw new Error('No content returned from OpenRouter');
                    }

                    const parsed = JSON.parse(content);
                    return [
                        {
                            prompt: parsed.candidateA.prompt,
                            reasoning: parsed.candidateA.reasoning,
                            score: 0
                        },
                        {
                            prompt: parsed.candidateB.prompt,
                            reasoning: parsed.candidateB.reasoning,
                            score: 0
                        }
                    ];
                }
            } catch (error: any) {
                console.log(`⚠️  ${provider} provider failed for candidate generation: ${error.message}`);
                continue; // Try next provider
            }
        }

        // All providers failed
        console.error('All providers failed for candidate generation');
        return [{
            prompt: this.createFallbackPrompt(failedTest),
            reasoning: 'Generated using fallback method',
            score: 0
        }];
    }

    /**
     * Shadow test each candidate and return the best one
     */
    private async selectBestCandidate(
        candidates: FixCandidate[],
        originalTest: FailedTest
    ): Promise<FixCandidate> {
        const { runShadowTest } = await import('./shadowTester');

        const testedCandidates = await Promise.all(
            candidates.map(async (candidate) => {
                const result = await runShadowTest(candidate.prompt, originalTest);
                return {
                    ...candidate,
                    score: result.score
                };
            })
        );

        // Sort by score (highest first)
        testedCandidates.sort((a, b) => b.score - a.score);

        return testedCandidates[0];
    }

    /**
     * Fallback prompt improvement - generates a clean rewritten prompt
     */
    private createFallbackPrompt(test: FailedTest): string {
        // Extract the core intent from the original prompt
        // Remove any existing "fix" instructions we might have added previously
        let corePrompt = test.prompt
            .replace(/\n\nYour response must match this exactly: "[\s\S]*?$/g, '')
            .replace(/\n\nIMPORTANT: You must respond with valid JSON only[\s\S]*?$/g, '')
            .replace(/\n\nBe concise and match the expected output format exactly[\s\S]*?$/g, '')
            .trim();

        // For JSON errors, create a structured prompt
        if (test.errorType === 'json') {
            return `${corePrompt}

IMPORTANT: You must respond with valid JSON only. No explanations, no markdown, just the raw JSON object.`;
        }

        // For semantic errors, be more specific about expected output
        if (test.errorType === 'semantic') {
            return `${corePrompt}

Your response must match this exactly: "${test.expectedOutput}"
Do not add any extra text, greetings, or explanations. Output only what is requested.`;
        }

        // Default: add clarity
        return `${corePrompt}

Be concise and match the expected output format exactly.`;
    }
}