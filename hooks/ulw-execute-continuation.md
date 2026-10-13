<ulw-execute-continuation>

Continue the selected `ulw-execute` work without asking whether to resume. The plan, Boulder state, and existing ledger remain the progress owner; this hook does not activate another workflow, goal, planning phase, or duplicate review.

# State

- Plan: `{{PLAN_NAME}}`
- Plan file: `{{PLAN_PATH}}`
- Boulder state: `{{BOULDER_PATH}}`
- Remaining top-level checkboxes: `{{REMAINING_COUNT}}` of `{{TOTAL_COUNT}}`
- Next incomplete task: `{{NEXT_TASK_LABEL}}`
- Hook workspace: `{{CWD}}`
{{WORKTREE_BLOCK}}
- Ledger: `{{LEDGER_PATH}}`
- Your session id in boulder.json: `codex:{{SESSION_ID}}`

# Selected execution contract

{{SKILL_REFERENCE}}

Use the selected `ulw-execute` skill for implementation, delegation, verification, cleanup, and review methods. Already-loaded valid instructions need not be reread. If context was lost, recover the actual selected contract from the package reference above or an authoritative supplied skill, not a same-named file in the task's cwd.

If neither valid loaded instructions nor an authoritative selected source can be recovered, stop execution and report the dependency gap through the external-blocker protocol below: identify the missing contract and the observable condition that restores it. Leave the work incomplete. Do not substitute a weaker method, downgrade or waive verification gates, mark completion, or auto-install a dependency.

# Continue or finalize

Reconcile the current plan, Boulder state, and ledger before acting; reuse evidence only where its inputs and coverage remain valid. Use the recorded worktree for task edits and commands when set, while accessing state and evidence at the paths above. Otherwise retain the authorized workspace under the selected skill's isolation rules; this hook does not require creating a worktree.

When work remains, continue under the selected contract with the next top-level task whose dependencies are satisfied. Nested acceptance/evidence checkboxes are not separate continuation tasks. Complete the applicable verification, including every required independent review, before marking a task done. Record its evidence and completion in the existing ledger, update the plan, and confirm the current checklist state. Worker claims and inconclusive reviews are not approval.

When the remaining count is `0`, skip task execution and run the selected final gate. A fully checked plan is not completion: all applicable final checks, required reviews, cleanup, and the authorized delivery mode must be satisfied. Reuse valid final-wave evidence instead of adding equivalent review lanes. Record final evidence and verdicts in `{{LEDGER_PATH}}`, then mark the Boulder work completed before the final answer. Keep written session ids prefixed `codex:`. Report completion using the selected skill's finalization format only after these conditions pass.

# External blocker protocol

For a conclusive blocker only the user or external state can clear, make one authoritative check, stop unchanged retries and reviewer dispatch, and preserve incomplete state. Start the answer with `<ulw-execute-blocked-external>` alone on its line (only mode banners such as `ULTRAWORK MODE ENABLED!` may precede it), followed by the exact blocker and the observable resume condition; a marker anywhere else or without that explanation does not end continuation.

For other failures or safety boundaries, follow the selected execution contract without claiming completion or bypassing required gates. Surface material progress, evidence, or blockers; do not ask whether to continue. The hook re-evaluates current state at Stop.

</ulw-execute-continuation>
