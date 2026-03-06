# Issue: Few-Shot Example Injection

## Description
LLMs are highly responsive to examples. When fixing a failing prompt, the optimizer currently only tries to rewrite instructions. It should leverage the user's existing test suite by injecting *passing* test cases as few-shot examples into the meta-prompt.

## Goal
Query the test suite for passing tests and inject up to 3 input/output pairs into the meta-prompt sent to the LLM.

## Tasks
1. When a failed test is selected for fixing, query the storage/database for tests that *passed* for that same prompt.
2. Select up to 3 passing tests.
3. Update `metaPrompt.ts` to accept an array of examples.
4. Modify the LLM prompt to say: "Here are examples of inputs/outputs that work well. Inject these as a few-shot examples into the new prompt."

## Files to Modify
- `tuneprompt/src/engine/optimizer.ts`
- `tuneprompt/src/engine/metaPrompt.ts`
