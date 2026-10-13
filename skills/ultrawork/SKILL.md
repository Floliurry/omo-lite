---
name: ultrawork
description: Optional evidence-driven execution for Codex. Use when the user explicitly requests ULW/ultrawork, or when the main agent chooses it after one bounded local exploration shows a concrete need for structured criteria and evidence. Mentions, filenames, quoted examples, and skill discovery are not activation; honor user opt-outs. Reuse the first exploration and judge subagent delegation separately.
metadata:
  short-description: ULW execution after main-agent admission
---

<ultrawork-mode>

# Admission

Use ULW when the user asks for it, or when your first look at the work shows it
needs explicit criteria and evidence; say why in a sentence. Routine edits,
unfamiliar files or several steps are not reasons by themselves. On activation,
announce `ULTRAWORK MODE ENABLED!` once. ULW adds no authority: commits,
installs, publication and native goals still need the user's request.

When a `ulw-execute` plan already owns the work, its state, evidence and gates
apply instead of this skill. Keep selected Visual QA and strict-plan reviews;
ULW self-review does not replace them. `review-work` can supply the independent
acceptance gate.

# Define the outcome and risk

State the requested end result, scope, acceptance criteria and a short approach.
Name checks that can distinguish success from plausible failure. Keep simple
work inline; larger projects may use existing specs and plans.

Use LIGHT for known-pattern work without material open design or high-risk
boundaries: applicable tests/surface checks and self-review suffice. Use HEAVY
for new layers or domain models, security/auth/session/permission changes,
external-integration changes, schema/migration work, concurrency/transactions/
cache invalidation, cross-domain refactors, or explicitly requested rigorous
review. Judge the actual change, not file count, vague adjectives, or the size
of work assigned to another session. Unresolved material risk calls for HEAVY;
upgrade when such risk emerges and close the resulting evidence gaps.

HEAVY requires independent acceptance. Read [Independent acceptance](references/heavy-review.md)
when that gate applies (or the user requests it), not for routine LIGHT work.
For browser, GUI, TUI, API or data-boundary scenarios, read only the applicable
section of [Surface evidence](references/surface-evidence.md) when preparing QA.
Neither reference is a prerequisite for unrelated work.

# Execute and establish evidence

1. Inspect the relevant implementation and consumers. For a reproducible bug,
   capture a failing regression test or faithful reproduction before fixing it.
   For other behavior changes, choose checks against the intended outcome and
   realistic failure modes; use failing-first proof where it adds discrimination,
   not a manufactured failure for every edit. Preserve relevant passing baselines
   for behavior-preserving work. Test-only coverage should demonstrably catch the
   named regression; a targeted mutation can establish that when otherwise unclear.
2. Implement within scope, preserving others' changes. Run checks suited to the
   changed boundaries, including applicable diagnostics/compiler checks. Missing
   optional tools do not authorize installation or invalidate sound alternatives;
   report what was actually used. Never suppress failures to produce a green result.
3. Exercise executable user-facing outcomes on their real surface, using concrete
   inputs and an observable expected result. Unit tests alone do not establish
   unexercised integration or UI behavior. Tool results are evidence; save separate
   artifacts when the surface or delivery requires them. Prose/research without an
   execution seam uses review and supporting sources, not invented runtime proof
   or sentence/heading/length assertions. Test machine-consumed grammar and shipped
   copy parity where relevant; parity is not proof of model adherence.
4. Inspect decisive evidence, including delegated results. Reuse valid evidence;
   rerun only when changed inputs or new uncertainty affect its claim. Do not require
   the lead to replay every worker check, or an extra full suite as a closing ritual.
   Independent acceptance still checks evidence against the actual delivered revision.
5. Clean up resources created for QA while preserving user-owned state and requested
   artifacts. Disclose any remaining resources or verification gaps; do not claim
   complete acceptance while a required outcome or gate remains unverified.

# Delegation and evolving projects

Delegation follows the lead rule. Do not start dependent work or report it
complete before the child evidence it needs is integrated. A timeout is not
evidence and does not justify a duplicate assignment.

For long-running work, keep the full destination, decisions, evidence and remaining
work recoverable in existing project documents. Keep architecture (boundaries,
owners, interfaces and rationale), evidence (observations, conditions and limits),
and plan (dependencies and work state) distinguishable without prescribing extra
files. Update affected code and local docs together. Reuse existing contracts and
helpers where appropriate; do not invent an abstraction merely for similar syntax.
Changes to acceptance premises require reassessing affected dependents and required
reviews, not resetting unaffected approvals. Reserved decisions, conflicting
cross-scope contracts or scope expansion return to the user/lead before dependent
work. After compaction, reopen missing or uncertain context, not the whole history.

# Acceptance and stopping

LIGHT: inspect the diff and evidence against each criterion; summarize self-review
and why the risk classification holds. HEAVY: obtain the independent
verdict and resolve outcome-blocking findings. Honor any separately selected gates.
If required independent review is unavailable or prohibited, report the conflict
and incomplete acceptance rather than silently substituting self-review.

Report the outcome and decisive checks, plus the independent verdict when
required. Stop once the requested outcome and necessary verification are
complete; no extra polish, retrieval or process pass. If progress is blocked,
report what was tried and the missing decision, capability or evidence. Retry only
with a changed hypothesis or meaningful new information, within authorized scope;
do not continue an unchanged failed approach or hide partial results as success.

</ultrawork-mode>
