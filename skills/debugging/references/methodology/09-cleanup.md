# Cleanup and Completion

Use this reference after adding temporary instrumentation or creating debugging resources.

## Restore only what this task owns

Review the resource handles, paths, and temporary edits recorded during the investigation. Compare against the starting state, including pre-existing uncommitted and untracked work.

| Resource | Cleanup |
| --- | --- |
| Temporary source instrumentation | Remove the exact added hunk while preserving the fix and all pre-existing or concurrent edits. Re-read the file before applying the inverse edit. |
| Child process or debugger | Stop the owned handle/session, or the recorded PID after confirming it is still the same process. Detach from a pre-existing target instead of terminating it. |
| Scratch file or directory | Remove only the exact path created for this task once it is no longer needed. |
| Environment or configuration override | Restore the recorded prior value or absence in the scope that was changed. |
| Trace, screenshot, or reproduction | Retain requested delivery evidence; remove only temporary captures that are no longer needed. |
| Optional investigation notes | Keep them for an unfinished handoff or requested deliverable; otherwise remove only this task's own file. |

Do not use whole-file Git restoration to remove instrumentation from a file containing other edits. Do not kill processes by a broad name pattern or delete shared temporary directories, wildcard matches, or another session's journal. If ownership is unclear, leave the resource intact and report it.

A dirty working tree is not itself a cleanup failure. The desired result is the requested change plus the user's pre-existing and concurrent work, with this task's temporary artifacts accounted for. Do not edit Git ignore files solely to hide a debug journal.

## Finish with supported claims

Review the scoped diff when applicable, and report the diagnosis or fix, the checks actually run, and any relevant limitations. No fixed suite, evidence count, reviewer, journal, or output template is required by this reference.

If cleanup changes the exercised path or could alter its scheduling, data, or environment, the affected check must run on the final state before that behavior is reported as verified. If it cannot run, mark that evidence changed-since-check and state the remaining boundary. Removing an unrelated scratch capture does not invalidate runtime evidence; reuse checks whose inputs and behavior are unchanged.

Commit and publication remain governed by the user's request and the active workflow. This reference adds no separate confirmation step.
