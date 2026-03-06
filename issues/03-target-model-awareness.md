# Issue: Target Model Awareness in Shadow Tester

## Description
The `shadowTester.ts` file hardcodes the models used to validate fixes (e.g., `claude-sonnet-4-20250514`, `gpt-4o`). If a user's test configures the prompt to run on `Llama-3`, testing the fix on `Claude` provides false confidence.

## Goal
The shadow tester must dynamically extract the target `provider` and `model` from the test configuration and use them for validation.

## Tasks
1. Parse the `config` object from the original test file/data.
2. Pass the target `provider` and `model` down to `runShadowTest`.
3. Update the provider functions (`runAnthropicTest`, `runOpenAITest`, etc.) to accept and use the specified model string instead of the hardcoded defaults.

## Files to Modify
- `tuneprompt/src/engine/shadowTester.ts`
- `tuneprompt/src/commands/fix.ts`
