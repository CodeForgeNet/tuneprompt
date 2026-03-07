import { FailedTest, OptimizationResult, FixCandidate } from '../types/fix';
import ora from 'ora';
import chalk from 'chalk';
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
        const spinner = ora(`Analyzing failure: "${failedTest.description}"`).start();
        const initialAggregateScore = suite.reduce((sum, t) => sum + t.score, 0) / suite.length;

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
            spinner.text = `Optimization Attempt #${iterations}/${this.maxIterations}...`;

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
                    spinner.text = `Attempt #${iterations}: Testing candidate...`;

                    const primaryResult = await runShadowTest(candidate.prompt, failedTest);

                    if (primaryResult.score < failedTest.threshold) {
                        const specificReason = primaryResult.failureReason || `the output was: "${primaryResult.output.substring(0, 50)}..."`;
                        lastFailureReason = `Candidate failed. Reason: ${specificReason}.`;
                        continue;
                    }

                    spinner.text = `Attempt #${iterations}: Verifying anti-regression...`;

                    const suiteResult = await runSuiteShadowTest(candidate.prompt, suite);

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
                        const regressions = suiteResult.results.filter(r => !r.passed).map(r => r.failureReason).filter(Boolean);
                        const regressionText = regressions.length > 0 ? ` Required features broke: ${regressions.slice(0, 2).join('; ')}.` : '';
                        lastFailureReason = `Fix introduced regressions.${regressionText}`;
                    }
                } catch (error: any) {
                    spinner.text = `Attempt #${iterations}: ⚠️ ${error.message?.substring(0, 80)}`;
                    lastFailureReason = error.message;
                }
            }

            if (bestResult) break;
        }

        if (!bestResult) {
            spinner.fail(`Optimization failed`);
            throw new Error(`Failed to improve score after ${this.maxIterations} attempts. ${lastFailureReason || ''}`);
        }

        spinner.succeed(`Optimization successful!`);
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