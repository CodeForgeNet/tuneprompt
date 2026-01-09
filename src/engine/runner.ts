import { v4 as uuidv4 } from 'uuid';
import { TestCase, TestResult, TestRun, TunePromptConfig } from '../types';
import { BaseProvider } from '../providers/base';
import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';
import { exactMatch } from '../scoring/exact-match';
import { validateJSON } from '../scoring/json-validator';
import { SemanticScorer } from '../scoring/semantic';

export class TestRunner {
    private config: TunePromptConfig;
    private providers: Map<string, BaseProvider> = new Map();
    private semanticScorer?: SemanticScorer;

    constructor(config: TunePromptConfig) {
        this.config = config;
        this.initializeProviders();
    }

    private initializeProviders() {
        if (this.config.providers.openai) {
            const provider = new OpenAIProvider(this.config.providers.openai);
            this.providers.set('openai', provider);

            // Use OpenAI for embeddings by default
            if (!this.semanticScorer) {
                this.semanticScorer = new SemanticScorer(provider);
            }
        }

        if (this.config.providers.anthropic) {
            this.providers.set('anthropic',
                new AnthropicProvider(this.config.providers.anthropic)
            );
        }
    }

    async runTests(testCases: TestCase[]): Promise<TestRun> {
        const runId = uuidv4();
        const startTime = Date.now();
        const results: TestResult[] = [];

        for (const testCase of testCases) {
            const result = await this.runSingleTest(testCase);
            results.push(result);
        }

        const duration = Date.now() - startTime;
        const passed = results.filter(r => r.status === 'pass').length;
        const failed = results.filter(r => r.status === 'fail').length;

        return {
            id: runId,
            timestamp: new Date(),
            totalTests: testCases.length,
            passed,
            failed,
            duration,
            results
        };
    }

    private async runSingleTest(testCase: TestCase): Promise<TestResult> {
        const testId = uuidv4();
        const startTime = Date.now();

        try {
            // Get provider
            const providerName = testCase.config?.provider || 'openai';
            const provider = this.providers.get(providerName);

            if (!provider) {
                throw new Error(`Provider not configured: ${providerName}`);
            }

            // Execute prompt
            const response = await provider.complete(testCase.prompt);
            const duration = Date.now() - startTime;

            // Score result
            const scoringMethod = testCase.config?.method || 'semantic';
            const threshold = testCase.config?.threshold || this.config.threshold || 0.8;

            let score: number;
            let error: string | undefined;

            if (scoringMethod === 'exact') {
                score = exactMatch(String(testCase.expect), response.content);
            } else if (scoringMethod === 'json') {
                const result = validateJSON(testCase.expect, response.content);
                score = result.score;
                error = result.error;
            } else if (scoringMethod === 'semantic') {
                if (!this.semanticScorer) {
                    throw new Error('Semantic scoring requires OpenAI provider');
                }
                score = await this.semanticScorer.score(
                    String(testCase.expect),
                    response.content
                );
            } else {
                throw new Error(`Unknown scoring method: ${scoringMethod}`);
            }

            const status = score >= threshold ? 'pass' : 'fail';

            return {
                id: testId,
                testCase,
                status,
                score,
                actualOutput: response.content,
                expectedOutput: String(testCase.expect),
                error,
                metadata: {
                    duration,
                    timestamp: new Date(),
                    tokens: response.tokens,
                    cost: response.cost
                }
            };
        } catch (error: any) {
            return {
                id: testId,
                testCase,
                status: 'error',
                score: 0,
                actualOutput: '',
                expectedOutput: String(testCase.expect),
                error: error.message,
                metadata: {
                    duration: Date.now() - startTime,
                    timestamp: new Date()
                }
            };
        }
    }
}