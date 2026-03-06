import { FailedTest, OptimizationResult, FixCandidate } from '../types/fix';
import {
    generateOptimizationPrompt,
    generateJSONFixPrompt,
    generateSemanticFixPrompt,
    MetaPromptInput
} from './metaPrompt';
import { generateErrorContext } from './constraintExtractor';
import { runShadowTest, runSuiteShadowTest } from './shadowTester';
import { ProviderFactory } from '../providers/factory';
import { BaseProvider } from '../providers/base';

export class PromptOptimizer {
    maxIterations: number;

    constructor(options: { maxIterations?: number } = {}) {
        this.maxIterations = options.maxIterations || 3;
    }

    /**
     * Main optimization method with Anti-Regression and Iterative Refinement
     */
    async optimize(failedTest: FailedTest, suite: FailedTest[]): Promise<OptimizationResult> {
        console.log(`\n🧠 Analyzing failure: "${failedTest.description}"`);
        console.log(`📈 Full test suite size: ${suite.length}`);

        const initialAggregateScore = suite.reduce((sum, t) => sum + t.score, 0) / suite.length;
        console.log(`📊 Current aggregate score: ${initialAggregateScore.toFixed(2)}`);

        const errorContext = generateErrorContext(failedTest);
        const passingExamples = suite
            .filter(t => t.score >= t.threshold)
            .slice(0, 3)
            .map(t => ({ input: t.input, output: t.expectedOutput }));

        let iterations = 0;
        let lastFailureReason: string | undefined = undefined;
        let bestResult: OptimizationResult | null = null;
        let bestAggregateScore = initialAggregateScore;
        let conversation: Array<{ role: 'user' | 'assistant', content: string }> = [];

        while (iterations < this.maxIterations) {
            iterations++;
            console.log(`🚀 Optimization Attempt #${iterations}...`);

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

            const generationResult = await this.generateCandidates(conversation, failedTest);
            const candidates = generationResult.candidates;

            if (generationResult.rawResponse) {
                conversation.push({ role: 'assistant', content: generationResult.rawResponse });
            }

            for (const candidate of candidates) {
                try {
                    console.log(`🧪 Testing candidate...`);

                    const primaryResult = await runShadowTest(candidate.prompt, failedTest);

                    if (primaryResult.score < failedTest.threshold) {
                        console.log(`   ❌ Candidate failed to resolve primary error (score: ${primaryResult.score.toFixed(2)})`);
                        const specificReason = primaryResult.failureReason || `the output was: "${primaryResult.output.substring(0, 100)}..."`;
                        lastFailureReason = `Candidate failed. Reason: ${specificReason}. Previous reasoning: ${candidate.reasoning}`;
                        continue;
                    }

                    console.log(`   ✅ Resolved primary error. Running anti-regression...`);

                    const suiteResult = await runSuiteShadowTest(candidate.prompt, suite);
                    console.log(`   📊 Suite aggregate score: ${suiteResult.aggregateScore.toFixed(2)}`);

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

        const providerPool = ['anthropic', 'openai', 'gemini', 'openrouter'];
        const systemPrompt = "You are a prompt optimizer. Output exclusively JSON. You suggest a candidateA and candidateB. You MUST format output as: {\"candidateA\": {\"prompt\": \"...\", \"reasoning\": \"...\"}, \"candidateB\": {\"prompt\": \"...\", \"reasoning\": \"...\"}}";

        for (const providerName of providerPool) {
            try {
                const apiKey = ProviderFactory.getApiKey(providerName);
                if (!apiKey) continue;

                // Pick a strong model for optimization if not defined
                const model = providerName === 'anthropic' ? 'claude-3-5-sonnet-latest' :
                    providerName === 'openai' ? 'gpt-4o' :
                        providerName === 'gemini' ? 'gemini-2.0-flash' : undefined;

                if (!model) continue;

                const provider = ProviderFactory.create(providerName, {
                    apiKey,
                    model,
                    maxTokens: 4000
                });

                // Convert conversation to a format the provider understands
                const userContent = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

                const response = await provider.complete({
                    system: systemPrompt,
                    user: userContent
                });

                const content = response.content;
                if (!content) throw new Error('No content returned');

                const parsed = JSON.parse(content);
                return {
                    candidates: [
                        { prompt: parsed.candidateA.prompt, reasoning: parsed.candidateA.reasoning, score: 0 },
                        { prompt: parsed.candidateB.prompt, reasoning: parsed.candidateB.reasoning, score: 0 }
                    ],
                    rawResponse: content
                };
            } catch (error: any) {
                console.log(`⚠️ Candidate generation failed for ${providerName}: ${error.message}`);
                continue;
            }
        }

        return {
            candidates: [{ prompt: failedTest.prompt, reasoning: 'Fallback - optimization failed', score: 0 }],
            rawResponse: ''
        };
    }
}