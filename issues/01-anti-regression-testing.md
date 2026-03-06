# Issue: Implement Anti-Regression Testing in Fix Engine

## Description
The `tuneprompt fix` command currently shadow-tests candidate prompts only against the specific test case that failed. This is a critical flaw: fixing the prompt for one edge case can break it for other previously passing cases.

## Goal
Modify the shadow testing infrastructure to validate candidate prompts against the **entire test suite** associated with that prompt, ensuring that the aggregate score does not regress.

## Tasks
1. Update `shadowTester.ts` to accept an array of test cases instead of a single `FailedTest`.
2. Run the candidate prompt against all test cases (in parallel if possible).
3. Calculate an aggregate score (e.g., average score).
4. Update the optimizer logic to reject candidate prompts if their aggregate score is lower than the original prompt's score.

## Files to Modify
- `tuneprompt/src/engine/shadowTester.ts`
- `tuneprompt/src/engine/optimizer.ts`
- `tuneprompt/src/types/fix.ts`
