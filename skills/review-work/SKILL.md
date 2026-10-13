---
name: review-work
description: "Post-implementation gate review: run manual QA on the real surface yourself, then launch ONE gate reviewer (never a panel) to audit goal, constraints, code quality, security, missed context, and QA evidence. Use before a PR handoff or when the user explicitly asks to review completed work. Committing finished work is not a handoff and does not call for it."
---

# Review Work - Gate Review Orchestrator

Review completed implementation work through exactly two lanes: your own hands-on manual QA on the real surface, and ONE gate reviewer sub-agent that audits the whole change set against the goal, the constraints, and your QA evidence. The review passes only when the QA matrix has no failing row AND the gate reviewer returns APPROVE.

One reviewer, not a panel. A single gate reviewer holding the full context (goal, diff, history, QA evidence) catches what a fan-out of narrow reviewers misses between their seams, and it costs one agent instead of five. Never add review lanes; widen the gate reviewer's checklist instead.

Keep the QA matrix, reviewer findings, commands, outcomes and evidence inline in messages, unless the caller assigned an ulw-execute report path or evidence directory; then follow that workflow's report contract.

| Lane | Who runs it | Question it answers |
|------|-------------|---------------------|
| Manual QA | You, the orchestrator, on the real surface | Does it actually work? |
| Gate review | One gate reviewer sub-agent (the harness's configured gate reviewer) | Did we build what was asked - correctly, safely, well, and without missing context? |

---

## Phase 0: Gather Review Context

Before running anything, collect these inputs. Extract from conversation history first - the user's original request, constraints discussed, and decisions made are usually already in the thread. Only ask if truly missing.

<required_inputs>

- **GOAL**: The original objective. What was the user trying to achieve? Pull from the initial request in this conversation.
- **CONSTRAINTS**: Rules, requirements, or limitations. Tech stack restrictions, performance targets, API contracts, design patterns to follow, backward compatibility needs.
- **BACKGROUND**: Why this work was needed. Business context, user stories, related systems, prior decisions that informed the approach.
- **CHANGED_FILES**: Auto-collect via `git diff --name-only HEAD~1` or against the appropriate base (branch point, specific commit).
- **DIFF**: Auto-collect via `git diff HEAD~1` or against the appropriate base.
- **FILE_CONTENTS**: The full content of each changed file plus the neighboring files that show the established patterns. Required verbatim when the selected reviewer cannot read files; when your surface's gate reviewer can read files and run commands, pass the paths and the diff instead of pasting everything.
- **RUN_COMMAND**: How to start/run the application. Check `package.json` scripts, `Makefile`, `docker-compose.yml`, or ask the user.
- **CONTEXT_MINING**: Relevant prior decisions or warnings that could change this review, with the question each search answered.

</required_inputs>

Review the actual requested diff, including uncommitted work when applicable. Use the existing checkout when safe; use an isolated review worktree only when checking another branch or running checks would disturb user work. Do not switch or clean a dirty user checkout. State the reviewed revision or working-tree scope inline so evidence is not reused after relevant changes. Review does not authorize commits, publication, or merging.

**Auto-collection sequence:**

```bash
# 1. Get changed files
git diff --name-only HEAD~1  # or: git diff --name-only main...HEAD

# 2. Get diff
git diff HEAD~1  # or: git diff main...HEAD

# 3. Detect run command
# Check package.json -> "scripts.dev" or "scripts.start"
# Check Makefile -> default target
# Check docker-compose.yml -> services

# 4. Resolve concrete missing-context questions
# Start with nearby code, tests, docs, and relevant history. Search an issue, PR,
# tracker, or chat only when it may answer a specific unresolved question.
git log --oneline -- <relevant changed path>
rg -n "TODO|FIXME|HACK" <relevant changed paths>
# Trace callers or consumers when the changed contract affects them.
```

Record CONTEXT_MINING as a short list: question -> source -> finding -> why it matters for this change. Search external trackers or chat only when they can answer a relevant unresolved question; tool availability alone is not a reason to search them.

For GOAL, CONSTRAINTS, BACKGROUND - review the full conversation history. The user's original message almost always contains the goal. Constraints often emerge during discussion. If anything critical is ambiguous, ask ONE focused question - not a checklist.

---

## Phase 1: Manual QA (you run it)

You are the QA lane. Do not delegate hands-on QA to a sub-agent: the orchestrator owns the real-surface proof.

1. **Reuse first.** Reuse real-surface evidence whose code, inputs, configuration, and relevant environment still match the FINAL tree. Record the covered scope and why it remains applicable. Re-run rows affected by a fix or uncertain provenance; a commit or unrelated edit alone does not stale a capture. For visual QA, pass the main-defined surface and evidence provenance through [its coverage and freshness contract](../visual-qa/SKILL.md).
2. **Pick the channel that faithfully exercises the surface** and retain its concrete output:
   - HTTP: `curl -i` (or an API request context) - status line, headers, body.
   - CLI / TUI: a real pty - drive the command and keep the transcript; for color or layout evidence render through a browser-based terminal, never a `tmux capture-pane` dump.
   - Web: the real page in a connected browser selected through [browser capability and session selection](../ultimate-browsing/references/browser-session.md) - action log plus screenshot.
   - Desktop / GUI: OS-level automation against the running app - action log plus screenshot.
   - Library / SDK: a script that imports and exercises the public API - transcript.
   - Configs and generated files: inspect the resulting artifact. For database migrations, also exercise the required schema/data behavior on an owned isolated database; apply/reversal checks follow the migration contract. A source diff alone does not prove runtime migration behavior, and production mutation requires its own authorization.
3. **Cover the affected contracts**: exercise each stated success criterion, its main intended path, and plausible failure or regression paths for the changed surface. Choose scenarios from actual risk and inputs; explain when a path cannot be exercised.
4. **Build the QA matrix** - one row per scenario, inline by default:

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Evidence |
|---|----------|------------------------|----------|----------|---------|----------|

A PASS row must cite concrete source, tool output, or a necessary artifact. A browser or desktop UI row must cite its screenshot. If the application cannot even start, that is an immediate FAIL.

Any FAIL ends the review here: return **REVIEW FAILED** with the failing rows and skip the gate reviewer - reviewing code that does not work wastes the reviewer. Fix first, then re-enter at Phase 0 with the delta.

---

## Phase 2: Launch the Gate Reviewer (one agent)

Launch exactly one reviewer, in the background, then keep doing independent root work while it runs.

Use `lazycodex-gate-reviewer`. It reads files itself, so pass the diff, QA matrix and source paths rather than full file contents.

```
spawn_agent(
  agent_type="lazycodex-gate-reviewer",
  task_name="gate_review",
  fork_turns="none",
  message="""
<review_type>GATE REVIEW</review_type>

<original_goal>
{GOAL - paste the user's original request and any clarifications}
</original_goal>

<constraints>
{CONSTRAINTS - every rule, requirement, or limitation discussed}
</constraints>

<background>
{BACKGROUND - why this work was needed, broader context}
</background>

<changed_files>
{CHANGED_FILES - list of modified file paths}
</changed_files>

<file_contents>
{FILE_CONTENTS - full content of every changed file plus neighboring files that show existing patterns; or the paths, when the reviewer can read files}
</file_contents>

<diff>
{DIFF - the actual git diff}
</diff>

<context_mining>
{CONTEXT_MINING - git history, related issues and PRs, docs and config that reference the changed behavior, warnings from previous authors}
</context_mining>

<manual_qa_matrix>
{QA MATRIX - every row with its source, tool-output, or artifact evidence}
</manual_qa_matrix>

Role: final gate reviewer. You do not implement fixes. Assume every success claim is unverified until you reproduce it from artifacts or source/tool output: executors can be wrong, tests can be too narrow, success prose can be misleading.

Review from the user's perspective first: what did they originally want, what result did they expect to receive, and does the shipped change actually satisfy that outcome? Then work the checklist. Be obsessively thorough - the point of this review is to catch what the implementer missed.

REVIEW CHECKLIST:

1. **Goal completeness**: break the goal into every sub-requirement (explicit AND implied). Mark each ACHIEVED / MISSED / PARTIAL with code evidence. An implied requirement a reasonable engineer would have addressed counts.
2. **Constraint compliance**: list every constraint and verify each with specific evidence. A violated constraint is a blocker.
3. **Behavioral correctness**: trace scenarios that cover the changed contracts and plausible failure modes (such as empty, boundary, malformed, concurrent, or failure inputs when applicable). Check for logic errors, off-by-one behavior, null handling, races, leaks, and unhandled rejections where the code makes them relevant.
4. **Code quality**: pattern consistency with the neighboring files, naming, error handling (no swallowed errors), type safety (no `as any` or suppressions), performance on hot paths, abstraction level, tests that are meaningful rather than tautological or implementation-mirroring, API and breaking-change hygiene.
5. **Security**: input validation and injection vectors (SQL, XSS, command, path traversal, SSRF), authentication and authorization, secrets in code or logs, data exposure, new dependencies and lockfile consistency, unsafe file and network handling.
6. **Missed context**: does the change respect the reasons recorded in history, issues, PR reviews, and docs? Does anything that imports or documents the changed behavior need to move with it?
7. **QA evidence audit**: for every matrix row, does the cited source, tool output, or artifact prove what the row claims? Name any success criterion that has no covering row. UI rows require their screenshot.
8. **Scope**: anything added that was not asked for - unnecessary abstraction, speculative generality, unrequested hardening - is a NOTE unless it breaks a constraint.

APPROVE unless you can cite a specific goal item, constraint, or QA row that the artifact fails, with the evidence that proves it (including an artifact a criterion requires but that is missing). A gap you cannot tie to the stated goal - style preference, alternative design, a scenario the goal never named - is a NOTE, not a blocker. You do not judge approach optimality or hypothetical future requirements.

OUTPUT FORMAT:
<verdict>APPROVE or REJECT</verdict>
<confidence>HIGH / MEDIUM / LOW</confidence>
<summary>1-3 sentence overall assessment from the user's perspective</summary>
<goal_breakdown>
  - [ACHIEVED/MISSED/PARTIAL] Requirement - evidence (file:line or artifact)
</goal_breakdown>
<constraint_compliance>
  - [ACHIEVED/MISSED] Constraint - evidence
</constraint_compliance>
<qa_audit>
  - [VERIFIED/UNPROVEN] Row # - what the cited evidence shows, or what is missing
</qa_audit>
<blocking_issues>
  - Violated goal item / constraint / QA row -> observation -> file:line or artifact pointer -> exact fix. Empty if APPROVE.
</blocking_issues>
<notes>Non-blocking findings, grouped by theme (quality, security, context). Keep them short.</notes>
""")
```

---

## Phase 3: Wait & Collect

Wait for the reviewer in bounded cycles while doing independent root work. Do not treat a timeout, an ack-only reply, or an empty result as APPROVE.

Store the lane verdicts independently:

| Lane | Verdict | Notes |
|------|---------|-------|
| Manual QA (Phase 1) | PASS/FAIL | rows and cited evidence |
| Gate review | pending/APPROVE/REJECT/INCONCLUSIVE | - |

A timeout or silence is not completion or a verdict. Inspect the actual child state before deciding whether a followup or replacement can recover the missing deliverable; do not duplicate a running review. If the required result cannot be obtained, report INCONCLUSIVE and name the missing evidence.

If this review created an isolated worktree, after the reviewer reaches a terminal state safely remove that owned worktree: run `git worktree unlock <path>` followed by `git worktree remove <path>`. The reviewer runs inside that worktree, so removing it earlier destroys its working directory; a crashed review leaves the locked tree as a recoverable marker for manual cleanup.

A re-review after fixes covers the delta, prior blockers, and any affected QA rows. Reuse unaffected evidence; provide the current diff and scope whether reusing a reviewer or starting a new one. Do not add another debugging audit unless a concrete unresolved failure warrants it.

---

## Phase 4: Deliver Verdict

<verdict_logic>

QA matrix has no FAIL row AND the reviewer returned APPROVE → **REVIEW PASSED**
Any QA row FAIL OR the reviewer returned REJECT → **REVIEW FAILED - criteria not met**
Reviewer INCONCLUSIVE and nothing failed → **REVIEW INCONCLUSIVE - not approved**

</verdict_logic>

Deliver the final verdict inline in this format. Write a report file only when the caller explicitly assigned a durable workflow destination:

```markdown
# Review Work - Final Verdict

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

| Lane | Verdict | Confidence |
|------|---------|------------|
| Manual QA (N rows) | PASS/FAIL | - |
| Gate review | APPROVE/REJECT/INCONCLUSIVE | HIGH/MED/LOW |

## Blocking Issues
[Failing QA rows first, then the reviewer's blockers - deduplicated, in fix order, each with its source, tool-output, or artifact pointer]

## Key Findings
[Top findings across QA and review, grouped by theme]

## Recommendations
[If FAILED: exactly what to fix, in priority order]
[If PASSED: non-blocking notes worth considering]
```

If FAILED - be specific. The user should know exactly what to fix and in what order: the problem, the source or evidence pointer, and the fix. No vague "consider improving X".

If PASSED - keep it short. Highlight the non-blocking notes worth considering, but don't turn a passing review into a lecture.
