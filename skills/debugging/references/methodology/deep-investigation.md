# Deep Investigation

Use this path for explicitly requested thorough debugging or when initial evidence shows that a focused reproduction is insufficient. Keep the work bounded by the requested diagnosis or fix. General feature work and unrelated refactoring remain with the task's existing execution workflow.

## Establish an investigation brief

Reuse the current plan and evidence. Record:

- The observed failure, expected behavior, and affected callers or systems.
- What is already known, including the running build and relevant starting state.
- The unresolved questions and why they require deeper investigation.
- The checks that will distinguish a successful outcome from a remaining defect.

Keep the brief inline for a contained task. Use an existing work record, or a task-owned file, when the investigation needs durable handoff or resource tracking. Do not create competing journals or goal state.

## Run controlled experiments

Map the relevant boundaries before changing them. Separate application logic, dependency behavior, environment, async ordering, and shared state only where the evidence makes those explanations plausible.

For each chosen experiment, identify the hypothesis, controlled input or state, decisive observation, and resources it may change. Prefer deterministic scheduling for races, a bounded workload for leaks, and a minimized fixture for destructive or expensive failures. Do not repeatedly exercise production failures solely to obtain stronger evidence.

Use [hypothesis investigation](02-investigate.md) for competing explanations and [flaky triage](03-flaky-triage.md) for intermittent behavior. After each meaningful experiment, update the explanation and choose the next observation. When evidence stops improving, use [reframing](04-oracle-triple.md) rather than repeating the same run or increasing agent count by default.

Delegate only when a distinct evidence source or specialist question can be investigated independently under the active runtime's rules. Assign one owner for mutations to each debuggee or shared fixture. Integrate observations before a dependent experiment or fix.

## Verify the affected contracts

For a fix, maintain a small matrix sized to the actual failure and change:

| Contract or risk | Scenario | Evidence and outcome |
| --- | --- | --- |
| Reported failure | Original or faithful minimized reproduction | Before/after result and material differences from the original environment |
| Affected boundary | Relevant caller, integration, or error path | Observed behavior, including state and side effects |
| Regression risk | Checks justified by the changed dependencies or shared behavior | Test or runtime result, with pre-existing failures identified |

Add rows for the concrete risks, not to reach a quota. Prefer a failing regression test when practical; a controlled reproduction can provide stronger evidence for some runtime failures. Expand to a package or full suite when its coverage is relevant or required by the repository. Reuse unaffected passing evidence.

An independent review is useful when requested or when significant causal or verification uncertainty remains. Scope it to that uncertainty, reuse any reviewer already assigned by the owning workflow, and judge findings against the task's actual contracts. Review is not a fixed panel or a substitute for runtime observations.

## Close or identify the remaining boundary

For a diagnosis-only request, deliver the causal explanation and evidence without implementing a fix. For a fix, report the changed behavior and verification matrix outcomes. If access or environment prevents a check, use [partial runtime evidence](partial-runtime-evidence.md) and identify the unverified claim.

Do not stop merely because an arbitrary number of rounds has elapsed. Stop repeating an avenue when it yields no new evidence, and continue useful independent work. Ask for a missing decision or prerequisite when it is actually needed, without requiring prior specialist consultation.

Apply [cleanup](09-cleanup.md) to this task's temporary resources. Retain evidence needed for delivery or a handoff.
