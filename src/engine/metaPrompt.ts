export interface MetaPromptInput {
  originalPrompt: string;
  testInput?: Record<string, any>;
  expectedOutput: string;
  actualOutput: string;
  errorType: string;
  errorMessage: string;
}

export function generateOptimizationPrompt(input: MetaPromptInput): string {
  const {
    originalPrompt,
    testInput,
    expectedOutput,
    actualOutput,
    errorType,
    errorMessage
  } = input;

  return `You are an elite LLM Prompt Engineer with expertise in Claude, GPT-4, and advanced prompting techniques.

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

=== YOUR TASK ===

1. **Root Cause Analysis**: Identify WHY the prompt failed
   - Missing instructions?
   - Ambiguous wording?
   - Wrong output format specified?
   - Tone mismatch?
   - Missing constraints?

2. **Prompt Engineering Fixes**: Apply advanced techniques:
   - ✅ Chain-of-Thought reasoning (if logic is needed)
   - ✅ XML tags for structure (<instructions>, <output_format>)
   - ✅ Few-shot examples (if pattern recognition helps)
   - ✅ Explicit constraints (length, format, tone)
   - ✅ Role assignment ("You are a [expert]...")
   - ✅ Output format specifications (JSON schema, markdown, etc.)

3. **Generate TWO Candidate Prompts**:
   - Candidate A: Conservative fix (minimal changes)
   - Candidate B: Aggressive rewrite (best practices applied)

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
}

// Specialized prompts for different error types
export function generateJSONFixPrompt(input: MetaPromptInput): string {
  return `You are a JSON Schema expert. The following prompt failed to produce valid JSON.

Original Prompt:
"""
${input.originalPrompt}
"""

Expected JSON Structure:
"""
${input.expectedOutput}
"""

Actual Output (Invalid JSON):
"""
${input.actualOutput}
"""

Rewrite the prompt to GUARANTEE valid JSON output. Use these techniques:
1. Explicitly state: "Return ONLY valid JSON, no markdown, no explanations"
2. Provide the exact schema structure
3. Add output format examples
4. Use XML tags like <json_output> to delimit the response area

Return your improved prompt as plain text (not JSON).`;
}

export function generateSemanticFixPrompt(input: MetaPromptInput): string {
  return `The prompt failed semantic similarity testing (score: too low).

Original Prompt:
"""
${input.originalPrompt}
"""

Expected Meaning/Content:
"""
${input.expectedOutput}
"""

What the Model Actually Said:
"""
${input.actualOutput}
"""

The model's response was off-topic or missed key information.

Rewrite the prompt to ensure the model:
1. Stays on topic
2. Includes all required information from the expected output
3. Uses clear, specific instructions
4. Avoids ambiguity

Return your improved prompt as plain text.`;
}