import { v4 as uuidv4 } from "uuid";
import { TestCase, TestResult, TestRun, TunePromptConfig } from "../types";
import { BaseProvider } from "../providers/base";
import { ProviderFactory } from "../providers/factory";
import { exactMatch } from "../scoring/exact-match";
import { validateJSON } from "../scoring/json-validator";
import { SemanticScorer } from "../scoring/semantic";
import { interpolateVariables } from "../utils/interpolation";

export class TestRunner {
  private config: TunePromptConfig;
  private providers: Map<string, BaseProvider> = new Map();

  constructor(config: TunePromptConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerNames = ["openai", "anthropic", "openrouter", "gemini"] as const;

    for (const name of providerNames) {
      const providerConfig = this.config.providers[name];
      if (providerConfig && providerConfig.apiKey) {
        this.providers.set(name, ProviderFactory.create(name, providerConfig));
      }
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

    const fallbackChain = ["openai", "anthropic", "gemini", "openrouter"];
    const initialProvider = testCase.config?.provider || "openai";

    let providersToTry: string[];
    if (testCase.config?.provider) {
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
        // Interpolate variables if present
        const finalPrompt = typeof testCase.prompt === 'string'
          ? interpolateVariables(testCase.prompt, testCase.variables)
          : testCase.prompt;

        const response = await provider.complete(finalPrompt);

        const { score, error: scoringError } = await this.scoreResult(
          testCase,
          response.content,
          providerName
        );

        const threshold = testCase.config?.threshold || this.config.threshold || 0.8;
        const status = score >= threshold ? "pass" : "fail";
        const duration = Date.now() - startTime;

        return {
          id: testId,
          testCase,
          status,
          score,
          actualOutput: response.content,
          expectedOutput: String(testCase.expect),
          error: scoringError,
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

  private async scoreResult(
    testCase: TestCase,
    actualOutput: string,
    providerName: string
  ): Promise<{ score: number; error?: string }> {
    const scoringMethod = testCase.config?.method || "semantic";

    if (scoringMethod === "exact") {
      return { score: exactMatch(String(testCase.expect), actualOutput) };
    }

    if (scoringMethod === "json") {
      const result = validateJSON(testCase.expect, actualOutput);
      return { score: result.score, error: result.error };
    }

    if (scoringMethod === "semantic") {
      return this.runSemanticScoring(testCase, actualOutput, providerName);
    }

    throw new Error(`Unknown scoring method: ${scoringMethod}`);
  }

  private async runSemanticScoring(
    testCase: TestCase,
    actualOutput: string,
    currentProviderName: string
  ): Promise<{ score: number; error?: string }> {
    const embeddingCapable = ["openai", "openrouter"];

    const scoringProvidersToTry = [
      ...(embeddingCapable.includes(currentProviderName) ? [currentProviderName] : []),
      ...embeddingCapable.filter((p) => p !== currentProviderName),
    ].filter((p) => this.providers.has(p));

    if (scoringProvidersToTry.length === 0) {
      throw new Error("No embedding-capable providers available for semantic scoring");
    }

    let lastScoringError: any;
    for (const scoreProviderName of scoringProvidersToTry) {
      try {
        const scoreProvider = this.providers.get(scoreProviderName);
        if (!scoreProvider) continue;

        const scorer = new SemanticScorer(scoreProvider);
        const score = await scorer.score(String(testCase.expect), actualOutput);
        return { score };
      } catch (err) {
        lastScoringError = err;
        continue;
      }
    }

    throw new Error(
      `Semantic scoring failed. Last error: ${lastScoringError?.message || "Unknown error"}`
    );
  }
}

