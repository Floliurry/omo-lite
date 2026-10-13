---
name: ulw-execute
description: "Executes a selected work plan with Boulder state, evidence and verification. Use when the user selects ulw-execute or its Boulder-backed execution workflow; a plan path alone does not activate it."
---

# ulw-execute

Execute the selected work plan through its final verification gate. The main agent owns the plan, its state, dependencies and evidence integration, and decides what to delegate under the lead rule. This skill pairs with the harness's ulw-execute continuation hook: a matching active or paused Boulder work with a readable checklist continues until the work is finalized, including when every checkbox is already checked.

## Usage

```text
$ulw-execute [plan-name] [--worktree <absolute-path>] [--make-pr] [--ship]
```

- `plan-name` (optional): a full or partial file stem under `.omo/plans/`.
- `--worktree` (optional): use the specified task-owned worktree. Otherwise use the current checkout when safe, or create an isolated worktree when the task requires it; phases may reuse that workspace.
- `--make-pr` (optional): deliver each phase's worktree as a pull request — push the branch, open a reviewer-readable PR, hand off with the URL, and merge only if the user asks.
- `--ship` (optional): full delivery lifecycle; implies `--make-pr`. After the PR opens, stay on the job until it is MERGED: watch CI and review gates, fix failures and address feedback from the worktree (fresh QA evidence for behavior changes), merge per the repository's merge policy, then remove the worktree and sync `.omo/` state back.

## Objective and progress ownership

Before implementation dispatch, record the plan path, concrete end state, delivery mode, and verification criteria in the existing execution ledger. The main agent keeps the plan checklist and Boulder status consistent as work is verified.

1. **Native goals require their own admission.** Use `create_goal` only when the user explicitly requested a native goal and the active tool instructions permit it. Reuse a matching active goal; do not replace an unrelated one. Selecting ulw-execute alone creates no native goal or budget. Without a native goal, the ledger objective is sufficient.
2. **Keep one progress owner.** The selected plan's checkboxes track task completion; Boulder tracks the active work and the ledger records evidence. A native todo/plan view may summarize this state when useful and available, but is not another prerequisite or source of truth. Update completion only after the applicable verification passes.
3. **Keep discoveries within scope.** Work the authorized outcome needs enters the plan through a [plan revision](#living-plan). Report unrelated pre-existing defects separately. A worker reports defects outside its assigned files; the main agent decides relevance and assigns any necessary follow-up to its owner before work starts.

## Living plan

Once handed off, the plan belongs to the executor. Keep it true to what the evidence shows rather than forcing the work to match a stale plan. Only unfinished tasks change; completed tasks and their evidence stay as recorded.

| Operation | Use when |
| --- | --- |
| Append | the authorized outcome needs work the plan lacks |
| Split | a task holds independently verifiable parts, or one part is blocked |
| Reorder | a dependency or risk calls for a different order |
| Rewrite | a task's method, files or verification steps are wrong but its outcome and acceptance thresholds stand |
| Supersede | a task is no longer needed or other tasks replace it |

New and split tasks take the next unused number; never reuse a number, so ledger references stay unambiguous. A split supersedes the original row, and each part is marked HEAVY by its own facts. Move a superseded row unchanged and unchecked under a `### Superseded` heading, with one line naming its replacements or reason. Keep that heading as the last subsection of `## TODOs` and insert new rows above it: the continuation hook stops counting at any `Superseded` heading. Append one `plan-revised` ledger entry per revision naming the affected tasks, the operation, its `basis` (the evidence that prompted it) and its `reason`.

Default: revise the plan yourself and keep going. Boundary: before dependent work, bring the change to the user when it alters the plan's outcome or success criteria, weakens an acceptance threshold, changes a reserved decision, or goes beyond authorized scope, risk or spend. Superseding a task whose criteria the plan's outcome no longer needs is yours, with the evidence recorded. When only such pending decisions remain, end the turn with the continuation hook's external-blocker marker. Counterexample: splitting a task that touches two independent modules is yours; rewriting a task so that a failing latency threshold no longer applies weakens acceptance and goes to the user.

| Change | Response |
| --- | --- |
| Wording, formatting or evidence links without changing decisions or proof | Maintain the record; no reapproval or renewed review |
| Task status within accepted work | Record actual supporting evidence; completion still requires verification |
| Reversible implementation detail within the contract | Owner chooses and validates; update consequential local docs |
| Evidence invalidates a reviewed technical premise within authority | Revise affected tasks and dependents; renew affected verification and any review the plan requires, keeping unrelated valid results |
| Changed outcome/acceptance, reserved decision or scope/risk/spend beyond authority | Obtain the user's decision before dependent work or completion; never weaken acceptance silently |
| Failed launch, missing or mismatched result | Recover the affected lane; it is not approval and does not erase other valid results |

Unchanged bytes do not keep stale proof valid, and a cosmetic edit does not invalidate it. Unrelated ready work continues while a user decision is pending, without presuming its answer.

## Phase 1: Select the plan

1. Read `.omo/boulder.json` if it exists.
2. List Prometheus plan files under `.omo/plans/`.
3. If `plan-name` was provided, select the matching plan.
4. If exactly one active or paused Boulder work exists for this session, resume it.
5. If no active work exists and exactly one plan exists, select it.
6. If no active work exists and there is no selectable plan, enter **No-plan bootstrap**.
7. If multiple plans remain possible, ask one focused selection question.

Stop condition: exactly one plan is selected, or the bootstrap below starts.

### No-plan bootstrap

When the user selected ulw-execute but no selectable plan exists, the main agent prepares an execution plan for the already authorized task. A bare "start work" does not select this skill. A brief without actionable steps and acceptance criteria needs completion before implementation.

1. Ground the requested outcome in the repository. Record scope, relevant files, dependencies, implementation constraints, success criteria, and applicable verification. Resolve discoverable details locally; ask only for a missing decision that materially affects correctness, scope, safety, or reversibility.
2. Save `.omo/plans/<slug>.md` with `## TODOs` and `## Final Verification Wave` sections. Number each executable TODO checkbox `- [ ] 1. ...`, `- [ ] 2. ...` and each final-verification checkbox `- [ ] F1. ...`, `- [ ] F2. ...`; start these rows at column zero so the continuation reader can count them. For substantial work, group dependent tasks into phases and define each phase's handoff, evidence and stop condition. This is execution preparation, not activation of ulw-plan, its interview, or its planning reviewers.
3. Assign independent work only when beneficial; serialize shared-file mutations and dependent steps. Keep each worker's scope, method, checks, and stopping condition explicit.
4. Invoke `ulw-plan` only if the user separately requested that planning workflow. In that case retain its approval and planner-to-executor handoff; execution selection does not waive a pending planning gate.
5. Once the execution plan is ready and no user-required planning gate remains pending, continue to Phase 2 under the existing execution authorization.

Minimal executable plan shape (replace the example tasks with the authorized work):

```markdown
## TODOs

### Phase 1: Implementation
- [ ] 1. Implement the authorized change and record its evidence.

## Final Verification Wave

- [ ] F1. Run the final-verification lanes and record their verdicts.
```

## Phase 2: Create or update Boulder state

Write `.omo/boulder.json` before implementation starts. Prefix session ids with `codex:` so the continuation hook can identify its own session.

```json
{
  "schema_version": 2,
  "active_work_id": "<work-id>",
  "works": {
    "<work-id>": {
      "work_id": "<work-id>",
      "active_plan": ".omo/plans/<plan-name>.md",
      "plan_name": "<plan-name>",
      "session_ids": ["codex:<session_id>"],
      "status": "active",
      "worktree_path": null
    }
  }
}
```

Record each phase's goal, acceptance criteria and one-sentence stop condition in the ledger: "stop when <the observable state that ends this phase>". When it holds, the phase is done; work past it is scope creep, not diligence. Use the current checkout when it safely supports the task. Use a task-owned worktree when separate branch execution is needed to protect user work or isolate conflicting checks; record its path in `worktree_path`. Do not create a worktree per phase merely to satisfy a template.

Stop condition: Boulder names this session's work and the ledger holds the objective and current phase.

## Parallel delivery lanes

Choose decomposition from actual dependencies and coordination cost. Independent bounded tasks may use parallel workers; tightly coupled tasks stay together. A team or another harness's workflow engine is optional, not an additional prerequisite for this plan.

If the user requested branch or PR delivery, choose the integration order explicitly. Commits, publication, merges, and cleanup each remain subject to the user's authorization and native Git safety. Workers do not push the base branch or resolve another worker's conflicts without an assigned integration responsibility.

## Phase 3: Execute the next ready task

1. Read the full selected plan and the ledger. A task with implementation evidence but no passing verification is verified before new work starts.
2. Select the next unchecked column-zero task in `## TODOs` whose dependencies are satisfied; plan order breaks ties. Final-verification rows start once every live TODO is complete.
3. Ignore nested checkboxes under acceptance criteria, evidence, and definition-of-done sections, and rows under a `Superseded` heading.
4. Mark the task HEAVY when it carries a fact you can point to: a new module, abstraction or domain model; auth, security or session; an external integration; a DB schema or migration; concurrency, transaction or cache-invalidation boundaries; a cross-domain refactor; or the plan marks it `HEAVY:` or the user asks for care. Record the mark and its fact in the task's ledger entry; a HEAVY task is verified on its own (Phase 4). Other tasks carry no tier. When unsure whether a candidate fact applies, mark HEAVY and name that fact; add the mark when such a fact surfaces mid-task, and never remove it. Size is not the test: a one-line change to session-expiry logic is HEAVY, a twelve-file rename inside one layer is not.
5. Identify independent bounded work and the verification needed for the task. Do not split shared reasoning or invent work to meet a worker quota.
6. Execute locally or delegate according to the ownership policy above. For justified workers, use the role router below and give each a completion condition. Integrate evidence before dependent work.

Stop condition: the task is marked complete (Phase 5), or the stuck-task rule below stops it.

### Stop a stuck task

Default: stop working a task when the same hypothesis has failed three times, or after five rounds without its verification passing. Record the diagnosis in the ledger, then revise the plan within authority (split, rewrite or supersede) or bring the blocker to the user. Boundary: a genuinely different hypothesis starts a new count; the five-round limit still applies. Counterexample: rerunning the same fix with a longer timeout is the same hypothesis.

### Research tasks

A task whose deliverable is a cited answer rather than an artifact uses the ledger as its research notes. Before each investigation, read the task's prior findings and hypotheses and extend them; never reinvestigate an answered question. Record each finding with its source (`file:line`, command output, URL) and track each hypothesis as `open`, `confirmed` or `refuted`, changing its status only on an observed source. Such a task passes on a cited answer: real-surface QA does not apply, but every conclusion still needs an observable source. Keep hypotheses inside the task's question; a scope-widening one is a plan revision. Exhaustive `ulw-research` needs its own selection.

### Track delegated outcomes

Use the active runtime's completion notifications and waiting tools. An external CI or service condition may need its own bounded check, but do not layer a watcher over a child's existing completion notification. A timeout is not a failed task or approval. Clean up only watchers or resources this task actually created.

### Delegation router — recommended task executor category

When the plan annotates a todo with `Recommended task executor category:`, follow that annotation; deviate only for a reason recorded in the ledger entry. Otherwise route by shape. Plans use these category names; the last column is the role to spawn:

| Category | Route here | Role |
| --- | --- | --- |
| `quick` | mechanical, single-file, boilerplate, config/copy | `lazycodex-worker-low` |
| `unspecified-low` | small tasks that fit no other category | `lazycodex-worker-low` |
| `writing` | documentation and prose | `lazycodex-worker-low` |
| `git` | git operations | `lazycodex-worker-low` |
| `unspecified-high` | standard features across a few files with known patterns | `lazycodex-worker-medium` |
| `visual-engineering` | frontend, UI/UX, styling, animation | `lazycodex-worker-high` |
| `deep` | hairy debugging, research-heavy or subtle cross-module work | `lazycodex-worker-high` |
| `ultrabrain` | ONE genuinely hard, logic-heavy problem — hand it the goal, not step-by-step instructions | `lazycodex-worker-high` |

Sizing is a two-branch decision made per task, before dispatch:

- **Independent work may split.** Delegate bounded pieces when parallel progress or specialist expertise outweighs startup, context transfer, and integration cost; simple pieces can stay local.
- **Cohesive hard work stays whole.** When splitting would sever shared reasoning (one algorithm, one migration, one subtle bug), send the WHOLE problem to one `deep` or `ultrabrain` worker. Never force-split work whose parts share one insight.

Give each worker its outcome, owned paths, authority, essential restrictions, acceptance needs and stop condition. Reference existing plan, project and evidence files instead of repeating standing role instructions or a fixed briefing template. Specify a QA invocation when a fragile setup or exact reproduction requires it; otherwise the worker chooses the faithful check and records the actual invocation. Follow up with the task delta rather than a full re-brief.

## Phase 4: Verify and record evidence

Verify at a coherent changed-surface boundary, not automatically on every worker return. Default: adjacent tasks may share one verification when its inputs and assertions cover each of them; map its evidence to each task. Boundary: a HEAVY task is verified on its own — its own evidence and its own independent confirmation, never folded into another task's batch. Counterexample: one green test run after a HEAVY auth change and two copy edits does not confirm the auth change. Before dependent work, validate the handoff contract; at integration, check the combined behavior and any dependency boundary isolated proofs did not exercise.

- Confirm the affected acceptance criteria and inspect the actual changes and decisive artifacts. A worker report is a claim, not the evidence itself.
- Select tests, typecheck, lint, build or diagnostics for plausible failures in the changed surface and the plan's required checks. Reuse applicable results; rerun when content, dependencies, environment or a concrete concern invalidates them. A return notification alone does not require full tests or LSP.
- Capture real-surface QA for each observable deliverable; one scenario may prove several criteria. Automated tests alone do not replace it. Pure prose uses artifact review, not phrase-pinning tests. For runtime and visual channels, read [verification channels](references/verification.md#channels).
- Probe the applicable adversarial risks using [the trigger map](references/verification.md#adversarial-risks). Shared probes may cover several tasks, but a HEAVY task's risks get their own; record coverage and justified non-applicability rather than repeating them per task.
- Clean up task-owned QA resources and record outcomes in the ledger. Preserve borrowed resources; unresolved owned resources block the affected completion. Do not manufacture a separate cleanup artifact when the existing record suffices.

Append evidence to `.omo/ulw-execute/ledger.jsonl`, one JSON object per line, with `event`, `plan`, `task`, `session_id`, `commands`, `artifact`, `adversarial_classes`, and `cleanup`. Identify the checked content and scope; a shared artifact may be referenced by several entries. Record the actual commands/results, applicable risk coverage and owned-resource teardown (or none created). Keep evidence valid across resume; changed inputs invalidate affected proofs, not unrelated completed work.

### Independent completion verification

Every implementation done claim needs independent confirmation before checkbox completion. The verifier may review a batch of tasks not marked HEAVY, but must identify the covered tasks and judge their decisive evidence, actual changes, acceptance and applicable risks. It must perform a targeted probe where evidence is missing, suspect or fails to establish the claim; it need not replay valid tests or QA just because the executor ran them.

Use the harness gate reviewer or an appropriately configured fresh reviewer; root may verify only tasks it did not implement or materially rewrite. Record the claim and verdict with evidence references in the ledger. `confirmed` alone passes; `false-positive`, `needs-fix`, and `needs-human-review` block affected completion. Feed concrete failures back to the executor, renew affected proof/review and retain unrelated valid results.

## Phase 5: Mark progress

Only after verification passes:

1. Edit the plan checkbox from `- [ ]` to `- [x]`.
2. Re-read the plan and confirm the remaining count decreased.
3. Append a `task-completed` ledger entry.
4. Continue with the next ready task. Do not ask whether to continue.

## Final verification wave

After every live TODO is complete, the final-verification rows judge the integrated result. Together they must cover four responsibilities (F1–F4 in a scaffolded plan):

- **Requirements traceability:** each requirement and acceptance criterion maps to decisive evidence.
- **Code review:** the actual changes are correct, maintainable and consistent with the codebase.
- **Real-surface QA:** the integrated deliverable works on its real surface.
- **Scope fidelity:** nothing outside the authorized boundary changed, and nothing inside it was dropped.

Run one independent lane per responsibility, in parallel; every lane returns its own verdict with supporting evidence, and all must approve. Boundary: a lane reuses valid executor evidence and probes gaps or suspect claims instead of repeating every earlier check, and it judges a superseded task by the basis recorded for it. Counterexample: a code reviewer who "also covered QA" by reading test logs has not covered real-surface QA.

## Completion

When all live top-level checkboxes in `## TODOs` and `## Final Verification Wave` are complete:

1. Confirm the final verification wave passed against the delivered content. Run missing or invalidated final checks; do not repeat commands already completed in that wave without a new reason.
2. For PR/branch work, finish the lifecycle from the last phase's worktree: sync `.omo/` state back to the main repo, create or update a PR only when requested, satisfy its review/verification gates, merge only when separately authorized, and remove the worktree only after successful merge or explicit handoff.
3. Remove or mark the Boulder work as completed.
4. Report `ORCHESTRATION COMPLETE` with the plan path, decisive verification/artifact references, delivery status, plan revisions made, and any open item that affects the user's next decision.

## Hard rules

- Pure-prose changes use artifact review without artificial RED or prose-string tests. For requested runtime behavior changes, capture a failing-first proof of the intended behavior before production edits (unit test at a seam, otherwise the failing Manual-QA scenario). For behavior-preserving changes, establish applicable passing baseline evidence first and preserve it through the change. Protect unaffected contracts without freezing the defect as the desired result.
- No `--dry-run` as completion evidence.
- No tests-only completion claim. A Manual-QA artifact is required, except for a pure-text change or a research task, whose artifact review or cited sources are its evidence.
- No completion claim while an applicable class from [the adversarial trigger map](references/verification.md#adversarial-risks) was never probed. Each applicable class needs a captured observable result; each skipped class needs a one-line not-applicable reason in the ledger.
- Do not disturb user work to switch branches or run destructive checks; use isolation when necessary.
- No unprefixed session ids in Boulder state. Sessions are always recorded as `codex:<session_id>`.
- No stale-memory execution. The plan and ledger are the durable source of truth.
