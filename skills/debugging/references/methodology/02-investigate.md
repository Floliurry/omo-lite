# Hypothesis Investigation

Use this reference when the evidence supports competing explanations or the failing path is unclear.

## Choose a distinguishing observation

State the likely cause, the evidence supporting it, and the smallest observation that would disprove it. Consider alternatives only where they remain plausible. Do not invent a minimum number of hypotheses or read more code merely to fill a quota.

Useful axes include:

| Axis | Question |
| --- | --- |
| Application logic | Which branch or value differs from the expected behavior? |
| Library or protocol boundary | Does the dependency return an error as data, transform the input, or violate an assumed contract? |
| Build or environment | Is this the same build, configuration, module, and executable that the source analysis describes? |
| Async ordering | Can cancellation, an unawaited task, or an earlier response hide the failure? |
| Shared state | Does another request, test, or process mutate the same resource? |

If two hypotheses predict the same observation, that check cannot distinguish them. Choose a more discriminating input or inspect another boundary.

Record the relevant value and its source, then update the explanation. Use bounded excerpts; avoid copying large logs or secret-bearing payloads.

## Re-observe debugger state before mutations

A paused thread or breakpoint observation may be stale by the next action. Before continuing, stepping, evaluating an expression with side effects, or terminating a target, check the current thread state and stop reason. If it moved, adjust the action instead of replaying an old plan.

| Failure signature | Next check |
| --- | --- |
| Adapter fails to start | Check the selected binary and launch arguments before retrying. |
| Breakpoint never binds | Check source paths, build optimization, and symbol or source-map correspondence. |
| Attach is refused | Verify target identity and applicable permissions. Repeating the same call does not change access. |
| Expected stop never occurs | Check whether the target is running and whether the path can reach the breakpoint. |
| Debuggee exits unexpectedly | Preserve the exit or crash evidence before starting a replacement. |

## Investigation that stalls

When another pass would repeat the same evidence, change the question using [reframing](04-oracle-triple.md). If independent investigation would help, follow the active runtime's delegation policy and assign distinct evidence sources. Do not let multiple investigators independently mutate the same debuggee.
