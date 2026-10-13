# Cause Confirmation and Regression Checks

Use this reference when deciding whether the evidence supports a fix and how to verify it.

## Support the causal explanation

Connect the failing input or state to the observed result through the affected code path. Prefer an experiment that changes the suspected cause while holding the rest stable. Existing failing tests, captured traces, or a deterministic reproduction may already provide this evidence.

To label a cause confirmed, the evidence must show the proposed mechanism causing the symptom and distinguish competing explanations that remain plausible. A controlled cause toggle is one route; a trace of the violated invariant or a deterministic reproduction can establish the same connection. Retain the decisive input, value, and outcome. Source analysis alone supports an inferred mechanism, not confirmation of execution in an unavailable environment. If the causal connection remains unresolved, label it a hypothesis and identify the missing observation.

For example, a configuration bug can be checked with two process-local values; an ordering bug can be checked with controlled task completion. A mutex making a race disappear is suggestive, but may merely change timing. Use an observation of the violated invariant or a deterministic schedule where practical.

Do not reintroduce a failure into a shared or production system solely to demonstrate a toggle. Reproduce in an isolated fixture or state the evidentiary limit. Failure to reproduce an intermittent issue on the next run does not establish that it was fixed.

## Choose a regression check

For a reproducible behavioral defect, prefer a focused test that fails for the reported cause and passes with the fix. Reuse an existing test when it already captures the contract. Keep setup small and exercise observable behavior.

A faithful CLI, request, configuration, or manual reproduction may be sufficient when a new automated test would add little confidence or require disproportionate infrastructure. Explain what it covers. For a diagnosis-only request, report the evidence without making a fix or adding tests merely to complete a workflow.

A before/after comparison is strongest when the input and environment are stable. If checking a test against the old implementation, preserve current edits and run the comparison in an isolated copy when necessary.

To report the defect as verified fixed, the check must exercise the reported failure condition, show the expected outcome with the fix, and be tied to evidence of the original failure. That evidence may be a captured failing run or an isolated comparison against the old implementation; describe material environment differences. A test that also passed before the fix cannot establish this on its own. If the relevant run is unavailable, report the implemented change and the unverified boundary instead.

Run relevant regression checks for affected callers and boundaries. Expand to the package or full suite when the scope, shared behavior, repository requirements, or new evidence warrants it. Distinguish a new regression from a pre-existing or environmental failure.

## Apply the scoped fix

Change what is needed to address the mechanism. Diff size alone does not decide whether a fix is correct. Keep unrelated refactors and speculative changes out of the patch.

If missing observability materially hindered this diagnosis, a focused log or error propagation change may belong in the fix. Use the existing logging conventions and avoid secret-bearing values. Temporary prints and breakpoints remain temporary; see [cleanup](09-cleanup.md).
