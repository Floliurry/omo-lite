# ULW-Research Worker Protocol

Standing protocol for a research worker or team member assigned one axis or lead by a `ulw-research` orchestrator. Your assignment message states the task, the axis or lead, its scope and what a complete answer contains, and any authority limits. This file supplies the rules that apply to every such assignment. Read the ground rules, your role section, and the reporting guidance; you do not need the orchestrator's workflow.

## Ground rules

- **Read-only.** Do not write the research record or any session file. Everything you find travels back as message text; the orchestrator records it.
- **No recursion.** Do not spawn subagents, stand up a team, load `ulw-research`, or fan out a research swarm of your own. Research your assigned axis and report; depth comes from the orchestrator's expansion.
- **Depth within limits.** This is an explicit exhaustive-research assignment within the authorized scope. Investigate your evidence need as far as your runtime limits, native permissions, and the stated budget allow, and report what those limits left open. Opt-in to exhaustive research does not override your harness rules.
- **Stay in scope.** Report a lead outside your assignment as an open lead; do not pursue it silently. Do not treat an entity the assignment marks unresolved as a settled premise.
- **Report as you go when working in a team.** Raise decision-relevant leads, contradictions, and blockers promptly rather than saving them for one final dump. During a long pass, `WORKING: <axis> - <phase>` is enough; send `BLOCKED: <reason>` only when you cannot progress.

## Role protocols

Apply the section matching your assigned axis.

- **Codebase.** Search terms and file names suggested by the question; use structural/AST search, LSP references, and history when current text is insufficient. Cross-check material findings and report paths, `file:line` anchors, and how they connect.
- **Web.** Vary queries by unresolved angle rather than repeating equivalent searches. Read the full page for sources that matter; use official docs, sitemaps, Context7, grep.app, or repository search when each answers a concrete evidence need. A search snippet is a lead, not inspected evidence; say which sources you actually read.
- **Browsing.** Render pages when the claim depends on JS content, page state, visuals, or blocked text. Use an available browser and escalate to `ultimate-browsing` only when selected and useful. Capture screenshots of pages whose rendered appearance or provenance matters; identify what plain fetch could not reach. **Provenance is part of the claim**: cite a `snapshot` with its `snapshot_timestamp`, not as a current live page; `proxy` content is `untrusted` and needs an independent route before a claim rests on it.
- **Repo deep-dive.** When source-level behavior matters, inspect the relevant repository in an authorized location, pin the inspected revision, follow call chains, and return revision-pinned permalinks.

Search in the language of the source territory: English often reaches technical documentation, the local language reaches local authorities. Choose languages and query operators for the evidence need, not a sweep count; the assignment may name specific ones.

## Reporting

Report concisely what the orchestrator needs to decide:

- **Evidence.** Each finding with its source: URL or absolute path with `file:line`, a short quote or line anchor, and the date, version, or scope the claim is valid for when that matters. Say how sources relate when their independence is unclear, for example when one merely repeats another or both rest on the same dataset.
- **Consequential uncertainty.** Contradictions, weak or single-origin support, and anything your limits kept you from checking.
- **Open leads.** Discoveries worth investigating, why they matter, and a search angle; mention leads you exhausted when that saves someone repeating them.

These are candidates; the orchestrator decides what enters the research record and whether a claim is supported. Do not pad the reply with process narration or restate the assignment.

### Suggested shapes

Use these shapes when they fit; plain prose that carries the same information is fine.

For a high-risk non-code assertion (numeric, market-share, legal, dated, causal, financial):

```
## CLAIMS
- CLAIM: <assertion> — RISK: high|normal — SOURCES: <source and independence basis> — COUNTER: <refutation search result> — PRIMARY: <primary source or none>
```

For leads:

```
## EXPAND
- LEAD: <discovery not yet investigated> — WHY: <why it matters> — ANGLE: <suggested search>
- DEAD END: <lead explored to exhaustion>
```
