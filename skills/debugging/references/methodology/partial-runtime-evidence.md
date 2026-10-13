# Partial Runtime Evidence

Use this reference when access, hardware, network restrictions, cost, or missing inputs prevent the actual operation. A known limitation is enough to choose this route; do not make an unauthorized request just to demonstrate the blocker.

## Match the claim to the observation

| Available signal | What it supports | What it leaves unproved |
| --- | --- | --- |
| Request-building log before transmission | Values emitted by the observed code path | Later serialization, middleware changes, delivery, and remote behavior |
| Local proxy or transport capture | The request seen at that interception point | Receipt or processing by the remote service, especially if the proxy returns a stub |
| State file, cache, or build/version output | The specific recorded state or executable identity | Whether another path uses that state as inferred |
| Similar input through a shared path | Behavior of the path actually exercised | Branches and side effects unique to the unavailable input |
| Earlier service or vendor logs | The historical operation and fields actually retained | Current behavior or omitted payload fields |
| Source analysis | The implementation's apparent mechanism | Execution in the unavailable environment |

Use the program's documented logging options; illustrative environment variables are not universal APIs. Bound captures and avoid retaining secrets. A local interceptor is appropriate only when needed and available; keep configuration isolated to the target invocation and track the resources it creates.

## Combine evidence without overstating it

State the exact claim first, then identify observations that bear on it. Independent evidence can reduce uncertainty, but a fixed number of agreeing signals does not establish end-to-end correctness.

For example, a pre-send log and a unit test may establish the selected request parameter while leaving server acceptance untested. A help screen confirming the binary version does not independently prove that parameter.

A narrow fake can exercise real parsing or error-handling code when its contract is justified. Returning an assumed value from a stub does not verify the external service or the assumption itself.

Report:
- What was directly observed.
- What is inferred, and why.
- Which boundary was not exercised.
- What additional access or input would allow that check, if relevant.

A diagnosis or extraction can be complete within that scope while a runtime claim remains unverified. Do not convert it into a mandatory review loop or claim the whole fix works from partial signals.

## Optional independent check

If the active task warrants independent review, provide the specific claims and evidence paths under the runtime's existing delegation rules. Reuse a review already assigned by the current workflow. Reviewer agreement is not additional runtime evidence.

## Cleanup

Follow [resource ownership](09-cleanup.md). Stop only the proxy or shim process this task created, restore its scoped configuration, and remove only its exact temporary paths. Preserve requested evidence.
