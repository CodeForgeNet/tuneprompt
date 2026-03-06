import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { FailedTest, OptimizationResult, FixCandidate } from '../types/fix';
import {
    generateOptimizationPrompt,
    generateJSONFixPrompt,
    generateSemanticFixPrompt,
    MetaPromptInput
} from './metaPrompt';
import { generateErrorContext } from './constraintExtractor';
import { runShadowTest, runSuiteShadowTest } from './shadowTester';

export class PromptOptimizer {
    private anthropic?: Anthropic;
    private openai?: OpenAI;
    private openrouter?: OpenAI;
    maxIterations: number;

    constructor(options: { maxIterations?: number } = {}) {
        this.maxIterations = options.maxIterations || 3;
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey && !anthropicKey.includes('your_key') && !anthropicKey.startsWith('api_key')) {
            this.anthropic = new Anthropic({ apiKey: anthropicKey });
        }

        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey && !openaiKey.includes('your_key')) {
            this.openai = new OpenAI({ apiKey: openaiKey });
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
     * Main optimization method with Anti-Regression and Iterative Refinement
     */
    async optimize(failedTest: FailedTest, suite: FailedTest[]): Promise<OptimizationResult> {
        console.log(`\n🧠 Analyzing failure: "${failedTest.description}"`);
        console.log(`📈 Full test suite size: ${suite.length}`);

        // Initial aggregate score for comparison
        const initialAggregateScore = suite.reduce((sum, t) => sum + t.score, 0) / suite.length;
        console.log(`📊 Current aggregate score: ${initialAggregateScore.toFixed(2)}`);

        // Extract constraints and passing examples
        const errorContext = generateErrorContext(failedTest);
        const passingExamples = suite
            .filter(t => t.score >= t.threshold)
            .slice(0, 3)
            .map(t => ({ input: t.input, output: t.expectedOutput }));

        // Iterative Refinement Loop (Phase 3)
        let iterations = 0;
        let lastFailureReason: string | undefined = undefined;
        let bestResult: OptimizationResult | null = null;
        let bestAggregateScore = initialAggregateScore;
        let conversation: Array<{ role: 'user' | 'assistant', content: string }> = [];

        while (iterations < this.maxIterations) {
            iterations++;
            console.log(`🚀 Optimization Attempt #${iterations}...`);

            // Step 1: Select and generate meta-prompt or append feedback
            if (iterations === 1) {
                const input: MetaPromptInput = {
                    originalPrompt: failedTest.prompt,
                    testInput: failedTest.input,
                    expectedOutput: failedTest.expectedOutput,
                    actualOutput: failedTest.actualOutput,
                    errorType: failedTest.errorType,
                    errorMessage: errorContext,
                    passingExamples,
                };
                conversation.push({ role: 'user', content: this.getMetaPrompt(input) });
            } else {
                conversation.push({ role: 'user', content: lastFailureReason || 'Please try again.' });
            }

            // Step 2: Generate candidates
            const generationResult = await this.generateCandidates(conversation, failedTest);
            const candidates = generationResult.candidates;

            if (generationResult.rawResponse) {
                conversation.push({ role: 'assistant', content: generationResult.rawResponse });
            }

            // Step 3: Tiered Validation
            for (const candidate of candidates) {
                try {
                    console.log(`🧪 Testing candidate...`);

                    // 1. Check primary failure first (Tiered efficiency)
                    const primaryResult = await runShadowTest(candidate.prompt, failedTest);

                    if (primaryResult.score < failedTest.threshold) {
                        console.log(`   ❌ Candidate failed to resolve primary error (score: ${primaryResult.score.toFixed(2)})`);
                        const specificReason = primaryResult.failureReason || `the output was: "${primaryResult.output.substring(0, 100)}..."`;
                        lastFailureReason = `Candidate failed. Reason: ${specificReason}. Previous reasoning: ${candidate.reasoning}`;
                        continue;
                    }

                    console.log(`   ✅ Resolved primary error. Running anti-regression...`);

                    // 2. Run full suite (Anti-Regression)
                    const suiteResult = await runSuiteShadowTest(candidate.prompt, suite);
                    console.log(`   📊 Suite aggregate score: ${suiteResult.aggregateScore.toFixed(2)}`);

                    // Accept if it improves (Phase 1 Decision: Aggregate > Initial)
                    if (suiteResult.aggregateScore > bestAggregateScore) {
                        bestAggregateScore = suiteResult.aggregateScore;
                        bestResult = {
                            originalPrompt: failedTest.prompt,
                            optimizedPrompt: candidate.prompt,
                            reasoning: candidate.reasoning,
                            confidence: suiteResult.aggregateScore,
                            testResults: {
                                score: primaryResult.score,
                                passed: true,
                                output: primaryResult.output,
                                aggregateScore: suiteResult.aggregateScore
                            },
                            iterations
                        };
                    } else if (suiteResult.aggregateScore <= bestAggregateScore) {
                        console.log(`   📉 Candidate regression: aggregate score dropped (Current: ${bestAggregateScore.toFixed(2)} VS New: ${suiteResult.aggregateScore.toFixed(2)})`);
                        const regressions = suiteResult.results.filter(r => !r.passed).map(r => r.failureReason).filter(Boolean);
                        const regressionText = regressions.length > 0 ? ` Required features broke: ${regressions.slice(0, 2).join('; ')}.` : '';
                        lastFailureReason = `The fix resolved the failure but introduced regressions in other cases.${regressionText} Maintain all successful patterns while fixing the failure.`;
                    }
                } catch (error: any) {
                    console.error(`   ⚠️ Validation error for candidate: ${error.message}`);
                }
            }

            if (bestResult) break;
            console.log(`♻️ No candidate was net-positive. Retrying with refinement feedback...`);
        }

        if (!bestResult) {
            throw new Error(`All fix attempts failed to resolve the regression or improve the aggregate score after ${this.maxIterations} iterations.`);
        }

        return bestResult;
    }

    private getMetaPrompt(input: MetaPromptInput): string {
        switch (input.errorType) {
            case 'json':
                return generateJSONFixPrompt(input);
            case 'semantic':
                return generateSemanticFixPrompt(input);
            default:
                return generateOptimizationPrompt(input);
        }
    }

    private async generateCandidates(
        messages: Array<{ role: 'user' | 'assistant', content: string }>,
        failedTest: FailedTest
    ): Promise<{ candidates: FixCandidate[], rawResponse: string }> {
        if (process.env.TUNEPROMPT_MOCK_OPTIMIZER === 'true') {
            return {
                candidates: [
                    { prompt: 'Optimized candidate A', reasoning: 'Mock reasoning A', score: 0 },
                    { prompt: 'Optimized candidate B', reasoning: 'Mock reasoning B', score: 0 }
                ],
                rawResponse: '{"candidateA": {"prompt": "Optimized candidate A", "reasoning": "Mock reasoning A"}, "candidateB": {"prompt": "Optimized candidate B", "reasoning": "Mock reasoning B"}}'
            };
        }
        const providers = ['anthropic', 'openai', 'openrouter'];
        for (const provider of providers) {
            try {
                if (provider === 'anthropic' && this.anthropic) {
                    const response = await this.anthropic.messages.create({
                        model: 'claude-3-5-sonnet-20240620',
                        max_tokens: 4000,
                        temperature: 0.7,
                        messages: messages as any
                    });
                    const content = response.content[0];
                    if (content.type !== 'text') throw new Error('Unexpected response type');
                    const parsed = JSON.parse(content.text);
                    return {
                        candidates: [
                            { prompt: parsed.candidateA.prompt, reasoning: parsed.candidateA.reasoning, score: 0 },
                            { prompt: parsed.candidateB.prompt, reasoning: parsed.candidateB.reasoning, score: 0 }
                        ],
                        rawResponse: content.text
                    };
                } else if (provider === 'openai' && this.openai) {
                    const response = await this.openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: messages as any,
                        response_format: { type: 'json_object' }
                    });
                    const content = response.choices[0]?.message?.content;
                    if (!content) throw new Error('No content returned');
                    const parsed = JSON.parse(content);
                    return {
                        candidates: [
                            { prompt: parsed.candidateA.prompt, reasoning: parsed.candidateA.reasoning, score: 0 },
                            { prompt: parsed.candidateB.prompt, reasoning: parsed.candidateB.reasoning, score: 0 }
                        ],
                        rawResponse: content
                    };
                }
            } catch (error: any) {
                console.log(`⚠️ Candidate generation failed for ${provider}: ${error.message}`);
                continue;
            }
        }
        return {
            candidates: [{ prompt: failedTest.prompt, reasoning: 'Fallback - optimization failed', score: 0 }],
            rawResponse: ''
        };
    }
}