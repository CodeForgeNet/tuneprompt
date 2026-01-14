import { v4 as uuidv4 } from "uuid";
import { TestCase, TestResult, TestRun, TunePromptConfig } from "../types";
import { BaseProvider } from "../providers/base";
import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenRouterProvider } from "../providers/openrouter";
import { exactMatch } from "../scoring/exact-match";
import { validateJSON } from "../scoring/json-validator";
import { SemanticScorer } from "../scoring/semantic";

export class TestRunner {
  private config: TunePromptConfig;
  private providers: Map<string, BaseProvider> = new Map();

  constructor(config: TunePromptConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders() {
    if (this.config.providers.openai) {
      const provider = new OpenAIProvider(this.config.providers.openai);
      this.providers.set("openai", provider);
    }

    if (this.config.providers.anthropic) {
      this.providers.set(
        "anthropic",
        new AnthropicProvider(this.config.providers.anthropic)
      );
    }

    if (this.config.providers.openrouter) {
      const provider = new OpenRouterProvider(this.config.providers.openrouter);
      this.providers.set("openrouter", provider);
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
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;

    return {
      id: runId,
      timestamp: new Date(),
      totalTests: testCases.length,
      passed,
      failed,
      duration,
      results,
    };
  }

  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const testId = uuidv4();
    const startTime = Date.now();

    // Define fallback order: Primary -> Fallbacks
    const fallbackChain = ["openai", "anthropic", "openrouter"];

    // Determine starting provider
    const initialProvider = testCase.config?.provider || "openai";

    // Build the sequence of providers to try
    let providersToTry: string[];
    if (testCase.config?.provider) {
      // If provider is explicitly set, only try that one
      providersToTry = [testCase.config.provider];
    } else {
      providersToTry = [
        initialProvider,
        ...fallbackChain.filter((p) => p !== initialProvider),
      ];
    }

    let lastError: any;
    let errors: string[] = [];

    for (const providerName of providersToTry) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        // Execute prompt
        const response = await provider.complete(testCase.prompt);

        // Score result
        const scoringMethod = testCase.config?.method || "semantic";
        const threshold =
          testCase.config?.threshold || this.config.threshold || 0.8;

        let score: number;
        let error: string | undefined;

        if (scoringMethod === "exact") {
          score = exactMatch(String(testCase.expect), response.content);
        } else if (scoringMethod === "json") {
          const result = validateJSON(testCase.expect, response.content);
          score = result.score;
          error = result.error;
        } else if (scoringMethod === "semantic") {
          let calculatedScore: number | undefined;
          let lastScoringError: any;

          // potential embedding providers
          const embeddingCapable = ["openai", "openrouter"];

          // Order: Current provider (if capable) -> OpenAI -> OpenRouter -> others
          const scoringProvidersToTry = [
            ...(embeddingCapable.includes(providerName) ? [providerName] : []),
            ...embeddingCapable.filter((p) => p !== providerName),
          ].filter((p) => this.providers.has(p));

          if (scoringProvidersToTry.length === 0) {
            throw new Error(
              "No embedding-capable providers available for semantic scoring"
            );
          }

          for (const scoreProviderName of scoringProvidersToTry) {
            try {
              const scoreProvider = this.providers.get(scoreProviderName);
              if (!scoreProvider) continue;

              const scorer = new SemanticScorer(scoreProvider);
              calculatedScore = await scorer.score(
                String(testCase.expect),
                response.content
              );
              break;
            } catch (err) {
              lastScoringError = err;
              continue;
            }
          }

          if (calculatedScore === undefined) {
            throw new Error(
              `Semantic scoring failed. Last error: ${
                lastScoringError?.message || "Unknown error"
              }`
            );
          }
          score = calculatedScore;
        } else {
          throw new Error(`Unknown scoring method: ${scoringMethod}`);
        }

        const status = score >= threshold ? "pass" : "fail";
        const duration = Date.now() - startTime;

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
            cost: response.cost,
            provider: providerName,
          },
        };
      } catch (error: any) {
        lastError = error;
        errors.push(`${providerName.toUpperCase()}: ${error.message}`);
        continue;
      }
    }

    // If all attempts failed
    return {
      id: testId,
      testCase,
      status: "error",
      score: 0,
      actualOutput: "",
      expectedOutput: String(testCase.expect),
      error: errors.join(" | ") || lastError?.message || "All providers failed",
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
      },
    };
  }
}
