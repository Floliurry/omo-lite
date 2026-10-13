---
name: debugging
description: "Investigate observed failures with targeted diagnostic references. Use for unclear crashes, incorrect results, hangs, leaks, and intermittent or async failures; includes a deep investigation path for complex faults or explicitly requested thorough debugging. Routine edits and already-understood fixes do not require this workflow."
---

# Debugging

Start from the observed failure and the closest available reproduction. If existing evidence already identifies the cause, make the scoped fix and verify it only when repair is authorized; a diagnosis-only request ends with the cause, evidence, and any proposed repair, not an edit. Do not expand a known cause into a separate investigation without a concrete need.

## Select the depth

Use a focused investigation by default. For a request such as "deep debug this", "thorough root-cause investigation", or "深入排查", open [Deep investigation](references/methodology/deep-investigation.md). You may also select it after initial inspection exposes a concrete need: unresolved interactions across modules, a race or leak that needs controlled experiments, or a costly failure whose fix needs coordinated verification. State the reason and reuse existing findings.

Deep investigation provides a structured brief, experiment checkpoints, and a verification matrix. It does not fix the number of hypotheses or agents, require a particular tool, or automatically start ULW. If an existing heavy workflow owns the task, reuse its plan and evidence and add only the relevant diagnostic work.

## Choose the next observation

Use the smallest check that can distinguish plausible causes: an existing failing test, a log entry, a specific input, or a value at the failing boundary. Add alternative hypotheses when evidence leaves competing explanations; there is no required count.

Separate observations from inferences. A successful exit or HTTP status may hide a failed operation; check the result the caller actually needs. Verify that the source, build, configuration, and running process are the ones under investigation.

Read a reference only when it resolves a concrete diagnostic question or supports a tool you need. The references are independent recipes, not sequential phases.

| Diagnostic need | Reference |
| --- | --- |
| Debugger attachment, runtime identity, or tracking temporary instrumentation | [Environment and resources](references/methodology/00-setup.md) |
| Competing explanations or stale debugger state | [Hypothesis investigation](references/methodology/02-investigate.md) |
| Intermittent, order-dependent, or CI-only failure | [Flaky failure triage](references/methodology/03-flaky-triage.md) |
| Repeated investigation produces no new evidence | [Reframing a stalled investigation](references/methodology/04-oracle-triple.md) |
| A missing product decision or access requirement blocks progress | [Decision escalation](references/methodology/05-escalate.md) |
| Choosing evidence that a fix addresses the cause | [Cause confirmation and regression checks](references/methodology/06-fix.md) |
| Checking a failure through its real interface | [Runtime verification](references/methodology/08-qa.md) |
| Removing temporary changes or processes after instrumentation | [Cleanup](references/methodology/09-cleanup.md) |
| The real operation cannot be run in this environment | [Partial runtime evidence](references/methodology/partial-runtime-evidence.md) |

## Runtime and tool references

Use existing project tooling and the active runtime's available interfaces. These references do not establish that a tool, GUI, MCP server, or debugger adapter is installed or callable. Choose another faithful observation when a specialist tool is unavailable; install or configure one only when the task needs it and the action is authorized.

The required observation remains necessary even when the tool is optional. An alternative must support the same claim; otherwise use [partial runtime evidence](references/methodology/partial-runtime-evidence.md) and leave that claim unverified.

| When needed | Reference |
| --- | --- |
| Python exceptions, asyncio tasks, or debugger attachment | [Python](references/runtimes/python.md) |
| Node/Bun/tsx execution, promises, or source maps | [Node](references/runtimes/node.md) |
| Rust panics, symbols, or async tasks | [Rust](references/runtimes/rust.md) |
| Go races, goroutines, or profiling | [Go](references/runtimes/go.md) |
| Binary inspection or reverse engineering is actually required | [Native binaries](references/runtimes/native-binary.md), [bundled applications](references/runtimes/bundled-js-binary.md) |
| Browser state or interaction is part of the failure and Playwright is the available choice | [Playwright](references/tools/playwright-cli.md) |
| Structured debugger control with an available DAP adapter | [Bundled DAP client](references/tools/dap.md) |

A binary's format alone does not justify decompilation. For Ghidra, Frida, pwndbg, and pwntools, use the optional recipes linked from the binary references only after choosing the tool for a specific question.

## Scope and completion

Follow the requested outcome: a diagnosis may end with evidence and an unresolved limitation; a fix needs checks of the changed behavior. Prefer a failing regression test for a reproducible defect when practical, or use a faithful reproduction and explain the coverage. Expand testing when the affected behavior or a new failure warrants it.

To report a confirmed cause or verified fix, apply the evidence conditions in [cause confirmation](references/methodology/06-fix.md). Source-only reasoning or a passing check that never exercised the defect must not be presented as runtime confirmation.

Keep temporary resource ownership explicit. Use the current task's notes or tool results; create a separate record only when many resources or a handoff make it useful. Restore only this task's temporary changes and retain requested evidence.

Use the active runtime and existing workflow for permissions, delegation, progress, and completion. Loading this skill does not create another goal, journal, agent team, review gate, or approval requirement.
