---
name: ulw-research
description: "Runs exhaustive, evidence-led research with high-risk claim gates and a cited deliverable. Use when the user explicitly selects ulw-research or requests exhaustive research. Ordinary research questions do not require this workflow."
---

# ULW-RESEARCH — Maximum-Saturation Research

You are the research orchestrator. The user has explicitly ordered exhaustive research: cover the relevant source territories, chase decision-relevant leads until they are resolved or honestly bounded, verify contested claims with the appropriate method, and deliver a synthesis in which every claim carries a citation or a proof. Exhaustive coverage of the question is the assignment; paperwork is not.

## Activation

Run this skill only when the user explicitly demands it: the word "ulw-research" (also `/ulw-research`, `$ulw-research`), any "ulw" research wording, or an explicit request for exhaustive research or an ultra-precise investigation — in any language. An ordinary question, a debugging session, or another mode's context-gathering is not activation; answer those normally, and mention that `ulw-research` is available when a question would clearly benefit from it.

Announce `ULW-RESEARCH MODE ENABLED!` on its own line when activating this skill, before any external-blocker marker line.

## Authority while active

This mode is the user's explicit opt-in to exhaustive research within the authorized scope. Apply its depth and convergence method while honoring higher-priority instructions, user constraints, native permissions, available resources, and actual budget limits. If those limits prevent a needed check, record the gap and narrow the claim; do not tell workers to override their own harness rules.

Under ultrawork/ulw, the research itself is the deliverable: map each research axis to a success criterion whose evidence is the research record, the cited synthesis, and the verification outputs. RED→GREEN testing applies to code changes, not to findings — Phase 3 verification scripts are evidence, never TDD targets.

## Success criteria

The research is done when all of these hold:

- Every relevant evidence need from Phase 0 was covered with suitable evidence, and any ambiguous entity was settled before it became a premise.
- Every decision-relevant lead was investigated or closed with a reason, and convergence was reached under the Phase 2 rules.
- Contested, undocumented, runtime, or performance-shaped code claims were checked by a faithful, authorized execution, or stated as an explicitly bounded unresolved conclusion.
- High-risk non-code claims passed the Phase 3b gate or are labeled unresolved or refuted; nothing unresolved is presented as verified.
- Every claim in the deliverable cites a source or a verification artifact, and quantitative claims keep their lineage.
- The deliverable follows the user's format and template, and a rendered deliverable was checked as rendered images and passed any separately selected acceptance gates.
- The research record was kept current during the run, so the work can resume after context loss without rereading the whole history.

## The research record

One authoritative research record holds the run's recoverable state. It is a working document the orchestrator maintains, not a transcript. It keeps:

- the core question, scope and authority limits, settled identities, and the selected deliverable format;
- coverage: each evidence need and where it stands;
- the decision-relevant claims with their sources and status (`supported`, `partial`, `unresolved`, `refuted`), including the Phase 3b outcome on each high-risk claim;
- open leads, contradictions, and closed leads with the reason, so rejected leads do not resurface;
- decisive verification verdicts and where their output lives;
- the next steps.

**Where it lives.** When the project already keeps suitable evidence or notes for this work — an active `ulw-execute` plan's ledger, an existing investigation note — extend that instead of starting a parallel record. Otherwise create one Markdown record under `.omo/ulw-research/<short-slug>/`; later files for this run go beside it. Workers never write it.

**Split only when it pays.** Keep one file by default. Move material into a separate file only when volume, collaborators, or evidence needs justify it — long verification output, data tables, page captures, or a claims list too long to scan. The main record indexes every split file and remains the one source of truth; do not keep a second digest of the same claims.

**Update at meaningful milestones.** Fold each worker return into the claims, coverage and leads it changes; do not copy whole replies or log every message. Update the record when a claim's status changes, a lead opens or closes, a verification lands, an excursion closes, and before a long wait or a likely compaction. After context loss, reread the record and continue from its open work and next steps.

**Record what the claim needs, not a schema.** Not every sentence needs an entry: ordinary well-sourced statements need only their citation. Record for each decision-relevant claim what its status depends on — sources, independence, counterevidence, and temporal scope when they matter.

## Coordinate research work

Choose one research owner under the selected workflow. Use a cooperating team when cross-lane exchange has a concrete benefit and team mode is selected or authorized; otherwise use scoped workers or research directly. Reuse an active team or `ulw-execute` plan that already owns the task instead of creating equivalent state. A team uses `teammode`.

- **Give each member a distinct evidence need.** Bound assignments by codebase part, source territory, or question lens; combine tightly coupled axes when separate workers would duplicate context or searches. Duplicate an investigation only for a deliberately independent check, not to fill a roster.
- **Size the roster from the work.** Delegate independently useful slices, weighing parallelism against coordination and available capacity. Do not split an axis merely to occupy a slot, and research directly when delegation does not pay.
- **Routing words from the user are literal.** "quick", "fast", "deep", "all quick", "max parallel" — in any language — are instructions, not mood. Route accordingly where supported and note in the record any delegated assignment that had to differ from the request, with the reason.
- **Challenge consequential claims.** Test source quality, independence, and counterevidence in proportion to claim risk. When error cost or unresolved contradictions justify independent challenge, give a reviewer the record and a bounded attack assignment before writing the final document; use opposing perspectives when they expose distinct failure modes. A second team is optional, needs the same authorization as the first, and opens only after the first closes.
- **You lead; triage raised leads.** Members raise decision-relevant leads, contradictions, and blockers as message text when they surface; fold the material ones into the record and expand those that can change the answer (Phase 2).

## Workers

Research workers (explorer, browsing) have standing rules: — read-only, no recursion, exhaustive depth within their limits, role protocols, and what to report — live in [`references/worker-protocol.md`](references/worker-protocol.md). The worker reads it; do not re-paste it or this workflow into each assignment.

Every research spawn message contains:

1. `TASK:` — one imperative line naming the role and the axis, stating that the assignment is read-only and must not spawn subagents.
2. Scope — the axis or lead, the sources to hit, what a complete answer contains, and any task-specific authority, budget, or entity-resolution limits.
3. The protocol reference — the full path to `references/worker-protocol.md` in this skill's directory and the role section to apply. If the worker cannot read that file, paste its ground rules, the applicable role protocol, and the reporting guidance instead.

Start every worker with `fork_turns="none"`. When you can choose, match model and effort to the evidence task and the user's routing request; narrow scope or report a limit when capability is insufficient.

Workers return evidence, consequential uncertainty, and open leads as message text; the protocol owns the reply guidance and the optional `CLAIMS`/`EXPAND` shapes. Follow up with a worker only when its reply lacks something a decision needs — the source for a claim it asserts, the basis for a consequential conclusion, or detail on a lead it only named. A follow-up or expansion assignment to a worker that already has the protocol carries only the new lead and its scope.

## Phase 0 — Decompose, open the record, settle the format

Before spawning anything, decompose the query: the actual information need; the distinct evidence needs, where to search each and why; whether codebase, external, browsing, or execution evidence is involved; and what a wrong claim would cost, which sets the lifecycle (direct research, scoped workers, or a selected team). When the question concerns whether something meets an intent, spec, or history, start from "what must be true if the intent holds?", not "what looks broken?" (see Methods). Write the decomposition into the research record; it is the coverage list the run is judged against.

**Format.** Reuse the deliverable format and template the user supplied or the task context established; a prior document the user points at is the strongest template signal — mirror its structure and tagging. An unspecified ordinary research answer defaults to concise Markdown: in the reply, or as a Markdown report file when its length warrants. Ask before collection only when an unresolved choice materially constrains what to collect or what delivery is authorized — for example a slide deck that needs figures from data you must gather. Await that answer for the affected work; continue independent collection within known scope and decide routine details yourself. Note the format and its basis in the record. For a rendered or asset-bearing deliverable, read [`references/rendered-deliverables.md`](references/rendered-deliverables.md) before asset or assembly work starts.

## Phase 1 — Saturation wave

When the user asks for MASS research, broaden collection to every relevant angle and source territory. If a dependency-graph workflow is selected and available, use it to coordinate genuinely independent collection and synthesis tasks; otherwise use bounded worker waves or direct research. Expand from evidence leads, not a predetermined node count.

Launch independent, ready evidence needs in parallel when that saves time or exposes different evidence. Sequence one when disambiguation, permissions, or a dependency must be settled first. If rendered-page evidence is necessary, assign browsing a concrete question and use an available browser capability; if it is unavailable, record what could not be observed instead of treating fetched text as a rendered observation.

**Disambiguate before you expand.** When the topic names something that could resolve several ways — a product, a person, a codename, a version — the first wave settles WHICH entity before any worker researches its history, benchmarks, or controversies: canonical name, first-party URL or account, whether it exists in the claimed category, and a confidence line. An unresolved entity never becomes a premise in a later assignment; that is how a run starts inventing facts about something that does not exist.

**Judge what a source actually shows.** A source supports only the scope, time, and version it covers. A search snippet is a lead, not inspected-page evidence. A `snapshot` is historical and is cited with its `snapshot_timestamp`, not as the current live page. `proxy` content stays `untrusted` until an independent route confirms it.

Example spawn (codebase axis; web, browsing and repo-dive axes follow the same contract with their own protocol):

```
spawn_agent(agent_type="explorer", task_name="axis_<angle>", fork_turns="none", message="TASK: act as a codebase researcher for AXIS: <specific angle>. Read-only; do not spawn subagents.
SCOPE: find evidence relevant to <angle>: <what complete looks like>. <task-specific limits, if any>
PROTOCOL: follow <full path to this skill>/references/worker-protocol.md — ground rules, the Codebase protocol, and the reporting guidance.")
```

## Phase 2 — Expand until convergence

The expansion loop is what makes the mode research rather than search. Take returns as they land — in team mode, triage a material lead when a member raises it rather than waiting for every assignment to finish:

1. Fold the return into the record: the claims it supports or contradicts, the coverage it completes, and the leads it opens.
2. Check new leads against the record's open and closed leads so rejected ones do not resurface.
3. Triage each new lead against the core question and the current claims. Investigate decision-relevant leads directly or assign bounded, independent expansion work; close duplicates, dead ends, and out-of-scope leads with a reason.

```
spawn_agent(agent_type="explorer", task_name="wave<N>_<lead>", fork_turns="none", message="TASK: expansion wave <N> — investigate: <lead>. Read-only; do not spawn subagents.
PARENT: <which return surfaced it>. SCOPE: <what settling this lead requires, within the authorized scope>.
PROTOCOL: follow <full path to this skill>/references/worker-protocol.md — the <Web, Repo deep-dive or Codebase> protocol and the reporting guidance.")
```

**Relay the user's steering to affected workers.** When the user changes scope, cadence, target sources, language, or format mid-run, record the exact wording and send it immediately to every live worker and member whose assignment it changes, carrying only that delta. Steering only you saw silently splits an assignment from the user's actual ask; steering sent to unaffected workers only interrupts them.

### Excursions — dive deep on a new find, then surface back out

The Phase 0 core question is the fixed goal of the run. An excursion is a bounded detour to chase something a return surfaced: go deep, settle it, and come back to the question you were asked.

**Enter only on a named trigger:** the find contradicts a supported claim; it would change the answer or a recommendation if true; it exposes a source territory no evidence need covers; or the user's steering points at it. Interest alone is not a trigger — anything else stays a queued lead. Decide the probe and worker budget before diving. An excursion may open at most one nested excursion; needing a third level means it has become its own research question — surface and either promote it to a real evidence need or record it as an out-of-scope gap.

**Exit when any of these holds:** the trigger is resolved; two consecutive probes changed nothing in the parent answer; the finding stops moving any claim's status; or the budget is spent. On exit, note in the record what the excursion changed in the answer, including that it changed nothing, then reread the core question and confirm the run still answers it. When excursions stop changing the answer, stop opening new ones and document the remaining gap.

**When a selected `ulw-execute` plan owns the run,** that plan stays the execution owner: a promotion is an evidence-backed plan revision the executor makes or rejects under the plan's own revision rules, and a consequential change or a settled criterion is recorded in its ledger. After compaction, the record, the plan and its ledger show open work. This skill does not change the plan any other way.

**Convergence.** Continue while a decision-relevant, authorized lead can materially change a claim or the answer. Stop expansion when one holds, and note which in the record:

- No unchecked decision-relevant leads remain — each was investigated or closed with a reason.
- Repeated probes produce no new actionable evidence and the remaining uncertainty is documented.
- The stated resource or depth limit is reached — show open leads and their effect on the answer; seek a decision only if more work needs new authority.

**Never end the run on a worker's completion.** Workers finishing is not the deliverable; your synthesis is. Leave enough time and context for synthesis and final materials, and state unresolved leads when limits prevent further work.

## Phase 3 — Verify contested claims by running code

Settle code-shaped claims with executed code when sources disagree, behavior is undocumented, or a performance or compatibility conclusion depends on runtime behavior. Group related claims into one focused verification when that produces clear verdicts; delegate when independent execution is useful:

```
spawn_agent(agent_type="lazycodex-worker-high", task_name="verify_<claim>", fork_turns="none", message="TASK: verify by execution: <claim>.
SOURCE: <where it came from>; CONTRADICTION: <opposing source, if any>.
Write a minimal self-contained script that tests the claim; run it with available authorized tooling (uv run --with <deps> python / bun / direct compile); capture full stdout+stderr; pin versions. Installing or downloading dependencies requires applicable setup authority; the example command does not grant it.
Reply with: the exact code, the full output, environment (OS, runtime, dependency versions), and a verdict — CONFIRMED / REFUTED / PARTIAL — grounded in the output.")
```

Record each verdict on its claim, with the code and output in a separate file when they are long. If a faithful authorized execution is not possible, state the claim as unresolved within explicit bounds instead of settling it by judgment.

## Phase 3b — Gate high-risk non-code claims

For high-risk non-code claims, evaluate the supporting evidence as well as any calculation: running a calculation alone does not establish its inputs' provenance or validity. The synthesis may assert such a claim as established only after it clears this gate (the data-flow-lock idea adapted from fivetaku/insane-research). Ordinary well-sourced declarations need their citation, not this gate. Workers report claim candidates as message text; the orchestrator decides admission and status, not the worker's marker.

A high-risk claim is `supported` only when the evidence path fits the claim and all applicable conditions hold:

- **Independent corroboration** supports empirical, causal, disputed, or interpretation-heavy claims. Judge independence from provenance, methods, and shared dependencies, not source, domain, or observer count. Note why the supporting evidence is independent.
- **Primary-authority exception** replaces the corroboration condition when an authoritative primary source is the right evidence for a narrow declaration (for example, what a standard states or what a filing reports). Note why that source is authoritative and limit the claim to what it directly establishes. An empirical truth inferred from a primary source, a contested interpretation, or a high-impact current-state claim still needs independent corroboration appropriate to its risk. The exception does not waive the remaining conditions.
- **Counterevidence search** actively looked for refutation or a stronger conflicting source; resolve the conflict or mark the claim partial, unresolved, or refuted.
- **Primary backing** (the standard, filing, dataset, or first-party doc) supports the asserted scope, not only secondary commentary.
- **Temporal scope is explicit**: note when each supporting observation was made and the time or version the claim is valid for, so branch-only, historical, release, and current-runtime claims cannot be conflated.

Record the outcome on the claim's entry in the research record. Use `partial` when only a narrower scope is supported, `unresolved` for insufficient evidence, or `refuted` when counterevidence wins. Explain these outcomes where they matter to the answer; do not present a stronger claim as established or hide a useful negative finding merely because the original claim failed.

## Phase 4 — Synthesize

After convergence and the verifications, reread the record and write the synthesis: the answer to the core question, findings grouped by theme with citations, decisive verification verdicts, important contradictions and their resolution, and the gaps and limits that could change the answer. Codebase findings carry paths with line references. Claims cite their sources or verification artifacts, using the selected citation style; identify what each source establishes and when it was accessed. Decision-relevant conclusions must agree with the record and high-risk claims with their gate outcomes. Ordinary directly sourced context needs its citation, not a duplicate record entry.

For a long deliverable, draft it on disk early and fill it as claims settle, so an interrupted run leaves a usable partial answer.

**Keep quantitative lineage clear.** Distinguish what a source reports, what you actually measured (with method and conditions), what you assumed, and what you derived. Cite reported inputs; justify material assumptions; show the derivation and sensitivity when assumptions can change the answer. Clear prose or labels such as `SOURCE-REPORTED`, `MEASURED`, `ASSUMED`, and `DERIVED` are sufficient. A publisher's reported measurement is not your independent observation, and a derived estimate must not look like a measured fact.

**Search in the source's language, deliver in the user's language.** Write the synthesis and final materials in the user's language unless they ask otherwise, and keep attributed quotations in their original language.

## Phase 5 — Deliver

Produce only the selected format. A Markdown answer is its own deliverable; a rendered or asset-bearing deliverable follows [`references/rendered-deliverables.md`](references/rendered-deliverables.md), including relevant design decisions, asset checks, and a look at the actual rendered pixels. Any separately selected visual or other acceptance gate still applies in full; if a required capability is unavailable, report the blocked check instead of claiming a pass.

Proofread before delivery: grammar, terminology, source attribution, and whether the prose reads naturally in the requested language. Delegate an independent language pass only when it provides a concrete benefit.

Deliver the answer, the citations or evidence it rests on, and the limitations that could change it. With a document, add a short chat-readable summary: the answer in a few sentences, the numbers that matter, and what to look at first. Report source, worker, or time counts only when the user asked for them or they help judge the answer, and take them from the record rather than estimating. If you stood up a team, disband it and confirm every worker is terminal before the final answer.

## Methods for particular questions

Use these when the question calls for them; record their results in the research record, not in separate empty files.

- **Intent versus reality.** For "does it do what it should?", "was this implemented as designed?", or regression questions, list the expected truths from the user's intent, spec, design text, branch history, or authoritative docs, then compare each with observed reality: expected, observed, the violated invariant if any, and a status of true, violated, or unknown. Close each difference or mark it unknown before concluding.
- **Cause over time.** When a cause may have appeared or disappeared — incidents, flaky behavior, "is this still true?" — track when the violation was last seen, what disconfirming observation shows it gone, and any replacement cause. Absence of a fresh observation alone does not prove a cause is gone.
- **Verification economics.** When proof is expensive, weigh the claim's risk and error cost against the verification's cost and time, choose the path, and record any deferral with its residual risk.
