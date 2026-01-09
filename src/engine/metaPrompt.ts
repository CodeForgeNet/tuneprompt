// src/engine/metaPrompt.ts

export const buildOptimizationPrompt = (
    originalPrompt: string,
    failedOutput: string,
    expectedCriteria: string,
    errorContext: string
) => {
    return `
    You are an expert LLM Prompt Engineer. A prompt has failed a unit test.
    Your goal is to rewrite the prompt to satisfy the test criteria while maintaining the original intent.

    === CONTEXT ===
    [Original Prompt]:
    "${originalPrompt}"

    [The Failure]:
    The model output was: "${failedOutput}"
    The test error was: "${errorContext}"

    [The Goal]:
    The output must match this criteria: "${expectedCriteria}"

    === INSTRUCTIONS ===
    1. Analyze why the original prompt caused the failure (hallucination, tone, format, etc.).
    2. Rewrite the prompt using techniques like Chain-of-Thought, Delimiters, or Role Prompting to fix the issue.
    3. Return ONLY the new prompt text. Do not include conversational filler, markdown code blocks, or explanations.
    `;
};
