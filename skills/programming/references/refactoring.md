# Refactoring — Contracts, Transformations and Evidence

A refactor changes the requested structure while preserving observable behavior and public contracts, unless the user explicitly requests a contract change. The useful unit is the smallest coherent transformation that achieves that result within the project's conventions and authorized scope. A bounded change is not a reason for a repository-wide process.

## What change is actually within scope?

| Question | Required context |
| --- | --- |
| What should be different afterward? | The target file, symbol or module and the intended structural result |
| What is owned, and what is excluded? | Exact file/symbol ownership, explicit exclusions and the boundaries of any existing assignment |
| Which consumers constrain the change? | Relevant definitions, callers, imports/dependencies, tests and applicable project instructions |
| What may not change? | Observable behavior, public APIs, compatibility constraints and any explicitly authorized contract change |
| What establishes completion? | Required previews, behavior-equivalence evidence, applicable project/selected-workflow gates and material stop conditions |

Routine details come from the codebase. Clarification is necessary only when an unresolved choice materially affects correctness, scope, safety or the requested API.

An already assigned slice supplies its target, scope, execution depth, owned checks and stop condition. It does not restart global intake, clarification, planning or delegation unless those actions are explicitly part of that assignment. Inspection of relevant callers does not grant ownership of them. Within an assigned slice, scope expansion, ownership transfer, a new workflow/team or a commit requires explicit assignment authority within the user's permissions. Ambiguity, overlap, failed checks and out-of-scope needs remain valid stop boundaries rather than invitations to expand the task.

## Which invariants must survive?

- Observable results and public contracts remain equivalent except for an explicitly requested contract change.
- Error handling, cancellation and cleanup remain intact at external and resource-owning boundaries.
- Type information and behavioral assertions remain meaningful: unsafe type escapes or deleted tests must not conceal defects or manufacture a green result.
- Unrelated user and concurrent changes remain untouched. Shared files must be re-read before editing and before resolving overlap; ownership cannot be silently transferred.
- Selected verification, review, integration and team-cleanup contracts remain in force. The existing execution owner retains integration and final acceptance; this reference neither chooses staffing nor creates a second orchestration loop.

## When does the dependency structure require more than a local edit?

| Observed condition | Necessary representation and limits |
| --- | --- |
| Known file/symbol, familiar transformation, limited impact | The intended transformation and stable behavior must be clear; a separate plan, codemap, coverage percentage or todo list is unnecessary unless useful for that change |
| Cross-module/public-boundary change, dependent migration, a change to persistence/concurrency behavior, or a diff unsafe to review as one unit | A staged plan must expose affected definitions/consumers, dependency order, ownership, compatibility and transitional states, reversible stages, equivalence checks, required gates, recovery points and acceptance criteria |
| Bulk or broad structural transformation | A preview before application is required; a small precise edit instead needs review of its proposed diff |
| Work requiring resumption or already owned by a durable workflow | Reuse existing workflow state where present; durable state is needed only when the selected workflow or the work's size calls for resumption, not for every refactor |

The staged representation belongs to the current assignment or selected plan; it is not a request for a second planning or dispatch cycle. No fixed team size, member category, external-verifier topology or prohibition on tests follows from the transformation's size. Any selected team still owns its recorded file ownership, non-overlap, evidence integration and exit-cleanup requirements.

## Which transformation fits the target?

| Transformation | Appropriate method | Preservation questions |
| --- | --- | --- |
| Symbol rename | Reference inspection; language-server rename when it can safely cover the entire owned surface | Which definitions and consumers change? Is the public name part of an external contract? |
| Repeated syntax shape | AST-aware search with a bounded target path; preview the rewrite and review every match | Do all matches share the intended semantics, or does context distinguish them? |
| Extraction, move or dependency change | Inspection of import direction, initialization order, side effects and all affected call sites | Does the new location preserve initialization, dependency and resource behavior? |
| Library migration | Version-appropriate official documentation and the project's existing migration constraints | Is the dependency change included in the request? An upgrade is not authorized merely because a recipe supports it. |
| Precise local restructuring | Direct edit and review of the resulting diff | Is this the smallest coherent change, with the same observable behavior? |

Text search is appropriate for literals; language-aware references help with symbols when available. Tools serve the transformation rather than forming a mandatory stack. A tool's availability does not justify a broader rewrite.

## What evidence supports equivalence?

Verification must address plausible failures of the actual change. Focused regression tests or another direct behavioral oracle must observe the behavior being claimed as equivalent. Add typecheck, lint, build, integration or broader tests when the changed surface or project rules make them relevant; selected gates cannot be dropped merely because a narrower test passes.

Low measured coverage is a risk input, not an automatic pause or a license to claim equivalence. A narrow behavioral test, another direct oracle, a reduced change or a clearly reported limitation can address the gap. Evidence that never observes the affected behavior cannot establish its preservation.

A meaningful risky stage needs its relevant checks before dependent work relies on it. A full suite after every text edit is not required. The proposed and resulting diffs remain part of the evidence, particularly for bulk transformations, ownership boundaries and accidental public-contract changes.

A completion claim requires all of these facts:

- The requested structure is present within the owned scope.
- Preserved behavior has appropriate observed evidence.
- Applicable checks and required reviews have actual outcomes.
- Unverified, skipped and out-of-scope effects are identified rather than hidden.

The handoff evidence is the changed files, achieved structural result, behavior-equivalence observations, checks run and outcomes, skipped issues and material remaining risks. An assigned slice supplies its owned evidence; it does not claim that verification retained by the existing execution owner has already passed.

## What does a failed or uncertain result mean?

A failed check blocks dependent work until its cause and effect are understood. Recovery must target the responsible change and restore a known-good state using a safe, recoverable edit or operation; unrelated or concurrent work must not be discarded. A repair requires rerunning the failed check. Reducing or skipping an optional stage is valid only with the resulting limitation reported; a required stage or gate cannot silently become optional.

When scope, ownership, migration order or equivalence remains unresolved, the safe outcome is a bounded finding or blocker with evidence, not an unreviewed global rewrite. Material decisions return to the existing assignment owner; the refactoring reference does not introduce another approval or dispatch workflow.
