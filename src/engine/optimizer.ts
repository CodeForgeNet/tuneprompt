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

    constructor() {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey && !anthropicKey.startsWith('api_key') && anthropicKey !== 'phc_xxxxx') {
            this.anthropic = new Anthropic({
                apiKey: anthropicKey
            });
        }

        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey && !openaiKey.startsWith('api_key')) {
            this.openai = new OpenAI({
                apiKey: openaiKey
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
                        model: 'claude-sonnet-4-20250514',
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
                } else if (provider === 'openrouter') {
                    // For OpenRouter, we'll use the shadowTester to get a response
                    console.log(`⚡ Using OpenRouter for candidate generation...`);
                    // Since OpenRouter is used in shadow testing, we'll use a different approach
                    // For now, we'll return a basic fallback since OpenRouter doesn't support structured outputs as well
                    return [{
                        prompt: this.createFallbackPrompt(failedTest),
                        reasoning: 'Generated using fallback method',
                        score: 0
                    }];
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
            reasoning: 'Fallback prompt with basic improvements',
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
     * Fallback prompt improvement (basic heuristics)
     */
    private createFallbackPrompt(test: FailedTest): string {
        let improved = test.prompt;

        // Add output format specification if missing
        if (test.errorType === 'json' && !improved.includes('JSON')) {
            improved += '\n\nReturn your response as valid JSON only, with no additional text.';
        }

        // Add specificity for semantic failures
        if (test.errorType === 'semantic') {
            improved = `You must provide a response that includes the following key information:\n${test.expectedOutput}\n\n${improved}`;
        }

        return improved;
    }
}