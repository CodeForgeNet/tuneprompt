export interface MetaPromptInput {
  originalPrompt: string;
  testInput?: Record<string, any>;
  expectedOutput: string;
  actualOutput: string;
  errorType: string;
  errorMessage: string;
  passingExamples?: { input?: Record<string, any>; output: string }[];
  failureFeedback?: string;
}

const COMMON_JSON_FOOTER = `
=== OUTPUT FORMAT ===

Return ONLY valid JSON (no markdown, no explanations):

{
  "analysis": "Brief explanation of why it failed (2-3 sentences)",
  "candidateA": {
    "prompt": "Your rewritten prompt here",
    "reasoning": "Why this approach works"
  },
  "candidateB": {
    "prompt": "Your alternative rewritten prompt here",
    "reasoning": "Why this approach works"
  }
}

CRITICAL: Return ONLY the JSON object. No preamble, no markdown backticks.`;

export function generateOptimizationPrompt(input: MetaPromptInput): string {
  const {
    originalPrompt,
    testInput,
    expectedOutput,
    actualOutput,
    errorType,
    errorMessage,
    passingExamples,
    failureFeedback
  } = input;

  let prompt = `You are an elite LLM Prompt Engineer with expertise in Claude, GPT-4, and advanced prompting techniques.

A prompt has failed a critical test case. Your mission is to rewrite it to pass the test while maintaining the original intent.

=== FAILURE ANALYSIS ===

[Original Prompt]:
"""
${originalPrompt}
"""

${testInput ? `[Test Input Variables]:
${JSON.stringify(testInput, null, 2)}
` : ''}

[Expected Output]:
"""
${expectedOutput}
"""

[Actual Output (FAILED)]:
"""
${actualOutput}
"""

[Error Type]: ${errorType}
[Error Details]: ${errorMessage}

${failureFeedback ? `[ITERATIVE FEEDBACK]:
The previous fix failed because: ${failureFeedback}
PLEASE ANALYZE THIS FAILURE AND ADJUST YOUR STRATEGY.
` : ''}

${passingExamples && passingExamples.length > 0 ? `### Successful Performance Examples
Here are examples of inputs/outputs that work well. Inject these as a few-shot examples into the new prompt.
${JSON.stringify(passingExamples, null, 2)}
` : ''}

=== YOUR TASK ===

1. **Root Cause Analysis**: Identify WHY the prompt failed.
2. **Prompt Engineering Fixes**: Apply advanced techniques like XML tags, Chain-of-Thought, and explicit JSON schemas.
3. **Generate TWO Candidate Prompts**:
   - Candidate A: Conservative fix (minimal changes).
   - Candidate B: Aggressive rewrite (best practices applied).
`;

  return prompt + COMMON_JSON_FOOTER;
}

export function generateJSONFixPrompt(input: MetaPromptInput): string {
  let prompt = `You are a JSON Schema expert. The following prompt failed to produce valid JSON.

Original Prompt:
"""
${input.originalPrompt}
"""

Expected JSON Structure:
"""
${input.expectedOutput}
"""

${input.failureFeedback ? `[FAILURE FEEDBACK]: ${input.failureFeedback}` : ''}

${input.passingExamples && input.passingExamples.length > 0 ? `### Successful Performance Examples
Here are examples of inputs/outputs that work well. Inject these as a few-shot examples into the new prompt.
${JSON.stringify(input.passingExamples, null, 2)}
` : ''}

Rewrite the prompt to GUARANTEE valid JSON output. Use these techniques:
1. Explicitly state: "Return ONLY valid JSON, no markdown, no explanations"
2. Provide the exact schema structure
3. Add output format examples
`;

  return prompt + COMMON_JSON_FOOTER;
}

export function generateSemanticFixPrompt(input: MetaPromptInput): string {
  let prompt = `The prompt failed semantic similarity testing. 

Original Prompt:
"""
${input.originalPrompt}
"""

Expected Meaning/Content:
"""
${input.expectedOutput}
"""

Actual Output:
"""
${input.actualOutput}
"""

${input.failureFeedback ? `[FAILURE FEEDBACK]: ${input.failureFeedback}` : ''}

${input.passingExamples && input.passingExamples.length > 0 ? `### Successful Performance Examples
Here are examples of inputs/outputs that work well. Inject these as a few-shot examples into the new prompt.
${JSON.stringify(input.passingExamples, null, 2)}
` : ''}

Rewrite to ensure the model stays on topic and includes all required information.
`;

  return prompt + COMMON_JSON_FOOTER;
}