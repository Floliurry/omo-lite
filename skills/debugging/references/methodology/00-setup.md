# Environment and Temporary Resources

Use this reference when attaching a debugger or adding instrumentation. Logs and existing repros may answer the question without either.

## Identify the actual process

Check the manifest and launch command relevant to the failure. Confirm the interpreter or binary version, running build, working directory, and required configuration. Inspect only the environment values needed for the diagnosis; avoid dumping secrets.

Before attaching, establish:

- The target PID or owned session, and whether a debugger is already attached.
- Whether symbols and source maps match the running build.
- How wrappers such as tsx, poetry, cargo, or a supervisor pass debugger flags.
- Whether watchers will restart the process and invalidate the attachment.
- Which test or input reaches the failing path.

Read the matching runtime recipe if attachment details are unclear. Stop or reconfigure watchers only when they belong to this task or the user has authorized that action. Missing optional debugger support can be worked around with logs, a focused test, or other available observations.

## Bound inspection output

Request the value that distinguishes the hypotheses rather than dumping the whole process. Limit stack depth, collection size, and memory ranges. For example, use a bounded backtrace or inspect one variable before requesting more state.

## Track resources when you create them

Reuse the current task's notes or tool results. For a long investigation with many resources, a small record in a unique temporary directory can help a handoff. No root-level journal or Git ignore edit is required.

Record enough to undo temporary work without affecting other work:

| Resource | Ownership information |
| --- | --- |
| Temporary source instrumentation | Exact hunk and the pre-existing edits it must preserve |
| Child process, debugger, or terminal session | Handle or PID, launch command, and how this task started it |
| Scratch directory or fixture | Exact path created for this task |
| Environment or configuration override | Prior value or absence, and the scope of the override |
| Capture needed for delivery | Location and whether it must be retained |

Prefer process-local environment overrides and unique scratch paths. Check before creating or replacing a file. See [cleanup](09-cleanup.md) when these resources are no longer needed.
