# Issue: Multi-Turn Iterative Refinement loops

## Description
Currently, the `PromptOptimizer` takes a single shot at generating fix candidates. If the candidates fail the shadow test, it simply returns the "best" failing candidate.

## Goal
Implement an iterative refinement loop. If the shadow tester returns a low score, feed the failure reason back to the LLM and ask it to try again (up to a configured maximum number of iterations).

## Tasks
1. Implement a loop in `optimizer.ts`'s `optimize` method (e.g., max 3 iterations).
2. If the best candidate from a generation batch scores below the threshold, append a new message to the LLM context: "Candidate A failed because it did not output valid JSON. Please try again."
3. Update `shadowTester.ts` to return more descriptive failure reasons to be used as feedback.

## Files to Modify
- `tuneprompt/src/engine/optimizer.ts`
- `tuneprompt/src/engine/shadowTester.ts`
