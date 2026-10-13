# Code Smells — Assessment and Cleanup Reference

Use these signals to assess code and, when cleanup is authorized, remove needless complexity while preserving behavior. Assess every category applicable to the assigned changes and its KEEP conditions; these are diagnostic criteria, not a requirement to change every category in every file. Change structure only when a concrete correctness, maintainability or requested-scope need justifies it; retain cohesive code and existing conventions otherwise. Counts, names and examples are review signals, not quotas or automatic defects.

## Applicability and scope

- **Review:** inspect the assigned diff/files and relevant callers, report evidence and KEEP decisions, and retain the reviewer's read-only boundary. Consulting this reference grants no edit authority and does not widen a review assignment to the whole branch.
- **Explicit cleanup:** an explicit file list or caller-supplied change scope takes precedence. For a requested code-cleanup or deslop pass without a specified scope, use the branch-diff default: files changed between `git merge-base main HEAD` and `HEAD`. If that base cannot be resolved, report the ambiguity rather than invent a replacement. Do not substitute this default for an assigned review or worker scope.
- **Eligible files:** exclude deleted, binary, generated/vendored files and lockfiles from manual cleanup. Do not edit out-of-scope files; report useful findings there with evidence and expected benefit. Reading a relevant caller is not permission to edit it.
- **Existing workflow:** the caller or selected workflow owns planning, dispatch, acceptance and any required reviewer assignments. This reference supplies criteria and evidence obligations, not another phase loop, todo system, agent roster, review gate or commit authority. None of its guidance waives a selected check or review gate.

### Information needed to assess a change

Substantial cleanup requires a pre-change assessment; broad structural rewrites require a preview before edits. The relevant information is:

| Assessment question | Required basis |
| --- | --- |
| What may change? | In-scope files and ownership; candidate changes, applicable categories, replacements, dependencies and risk |
| What must remain? | Observable behavior and relevant callers, KEEP decisions, trust/resource boundaries |
| What establishes preservation? | Applicable checks, their owner, supplied evidence and any missing baseline |
| Where does authority end? | Overlap, ambiguous scope, uncertain equivalence or out-of-scope work stops that change; investigation does not grant wider edit, delegation or commit authority |

This information can live in the existing assignment or review context; no additional plan or dispatch exchange is required. Integration and acceptance remain with their assigned owner. Waiting or a timeout is not evidence of failure or a transfer of ownership.

## Preservation and required evidence

**Cleanup must preserve required functionality, public APIs, return values, side effects, exception/edge-case behavior, type information, boundary safeguards, resource cleanup, useful abstractions and test coverage.** Do not remove functional behavior on an assumption that it is unnecessary. If equivalence is unclear, KEEP the original and report the concern. Cleanup-only work must not introduce new abstractions; a justified new abstraction needs an explicitly authorized structural change rather than being smuggled into cleanup.

Before changing each in-scope source file, identify the affected observable behavior and relevant callers. Run focused existing tests that observe it; if coverage is missing or weak, add and run the narrowest regression before cleanup. Broaden this baseline when the impact surface or project contract requires it. If executable coverage is impractical, another direct oracle must support the same preservation claim, with its limitation reported; otherwise keep the code or stop that change. Preserve existing coverage and assertions rather than deleting or weakening tests to get green.

Tests must observe behavior, not incidental implementation. Prose and other surfaces without an executable seam require direct review or a real parser for machine-consumed values, not text, phrase or word-count pins. Passing behavior tests does not establish that an explanatory comment is dispensable. Trust-boundary guard removal has the additional adversarial requirement in [Smell 6](#smell-6--redundant-defense-or-overbroad-error-handling); a happy-path check or source-only argument cannot replace it.

### Applicable checks and acceptance

A cleanup pass is complete only when checks appropriate to the changed behavior and the project's requirements are green, and the diff satisfies the preservation and KEEP criteria. A read-only review may instead report failures or gaps; it must not claim that unchecked work passed.

| Required check when applicable | Evidence / pass condition |
| --- | --- |
| Focused regression or direct behavioral oracle | Baseline and final observations establish that affected behavior is preserved |
| Parsing, compilation, diagnostics/typecheck | Available project tools show no new relevant errors; imports and type information remain valid |
| Lint/format | Changed files satisfy the configured project contract |
| Integration/build | Run when the changed surface can affect them; required integration/build checks pass |
| Static/security scan | Run when required or relevant to the change; report its actual result |
| Size/architecture check | Run when the project requires it for affected files; use its documented exception mechanism for an intentionally retained cohesive file |
| Diff review against KEEP criteria | No accidental logic loss, broken public APIs, orphaned references, unjustified new abstractions or subtle algorithm shifts; intentional patterns and project conventions preserved |

### Evidence interpretation and limits

| Observation | Meaning and required treatment |
| --- | --- |
| A tool fails or is unavailable | Not a PASS and not evidence that the code is wrong. Correct the invocation or obtain a faithful available observation; missing optional LSP neither requires installation nor waives necessary proof. Report any unresolved evidence gap. |
| A check or preservation condition fails after a change | Identify and explain the responsible change. Recovery is limited to repairing or reverting that hunk, preserving unrelated/concurrent work; the affected checks and review must run again. |
| Repeated repair attempts leave required checks failing | Dependent work stops. The useful evidence is the file, attempts, failure observations and current hypothesis, not another unsupported success claim. |
| A gate does not apply | `N/A` needs a reason. Failed, unread or unavailable results cannot support a PASS. |

### Evidence supporting a finding or completion claim

The caller's existing findings or handoff must make the following inspectable; this is not another output template or report:

| Claim | Supporting information |
| --- | --- |
| The requested scope was assessed | Selected scope/files, applicable category findings, KEEP decisions and intentional skips |
| A deletion or replacement preserves behavior | Removed/replacement behavior, preservation rationale, safeguards, baseline and final checks with actual outcomes |
| Verification supports acceptance | Applicable check results, issues corrected during verification, and reasons for inapplicable or unavailable checks |
| The result has a known boundary | Out-of-scope findings, unresolved risks, and material debt ceilings or upgrade triggers |

No separate audit directory, ledger, hash or fixed report format is required by this reference.

## Existence and replacement criteria

For each proposed changed unit, establish whether it needs to exist before choosing an in-place cleanup. The alternatives below require evidence of equivalent behavior and remain subject to the scope and KEEP rules:

| Candidate | Required basis |
| --- | --- |
| Delete entirely | The unit is dead, speculative or redundant and no required behavior or supported caller depends on it |
| Reuse existing code | A repository helper or established pattern already supplies the same contract |
| Use a platform/stdlib/native facility or installed dependency | Its actual semantics match the required behavior; availability alone is not equivalence and does not authorize a new dependency |
| Simplify in place | The unit must exist; the applicable smell criteria identify a safe, concrete improvement |

Examples such as replacing a query parser with `URLSearchParams`, a debounce with an existing utility, or a custom date input with a native control are candidates, not proof of compatibility. Assess inputs, errors, side effects and user-visible behavior before replacing them. Replacements and deletions still need the relevant KEEP review and evidence; they do not bypass safety merely because little code remains.

For an authorized bug fix touching a shared function, inspect its relevant callers and prefer a root-cause fix at the shared seam over duplicated caller guards. A sibling caller left broken is not a complete fix. A cleanup or read-only assignment does not authorize an out-of-scope shared-seam repair: report it or obtain the needed scope before editing.

Keep independently reviewable changes separate and consider lower-risk removals before structural or performance rewrites; actual dependencies and boundary risk determine the order. Required baseline evidence comes before code removal, not at a late "tests" stage. Preserve an existing project-approved debt marker when retaining a bounded simplification; add one only when project convention calls for it, and report material ceilings and upgrade triggers.

---

## Smell 1 — A module has unrelated responsibilities

Length can make review harder, but a fixed line count does not establish a design defect. Inspect cohesion, dependencies and the change being made. Split when it improves that change's contract or isolates independent responsibilities; do not split or ask permission merely because a file crosses a threshold. Generated files, tables, tests and cohesive algorithms need context-specific judgment.

**KEEP:** cohesive modules, established project structures, generated files and self-contained scripts whose split would add ceremony without clearer ownership. When a structural change is justified and in scope, extract along stable responsibilities and dependencies with descriptive concept names, not numbered parts or catch-all dumping grounds. A useful split outside a bounded cleanup remains a finding, not an edit. Preserve public behavior and run the affected checks, including an applicable project size/architecture checker and its documented exceptions. The examples below illustrate possible boundaries, not size quotas.

### Concrete split examples

#### Python — BEFORE (`user_service.py`, 412 pure LOC)

```python
# user_service.py — DOES TOO MUCH
class UserRepository: ...        # 90 LOC of SQLAlchemy
class UserValidator: ...         # 60 LOC of Pydantic + business rules
class PasswordHasher: ...        # 40 LOC of bcrypt wrapper
class EmailSender: ...           # 50 LOC of httpx2 client
class UserService: ...           # 130 LOC orchestrating the four above
def _build_query(...): ...       # 25 LOC helper
def _format_email(...): ...      # 17 LOC helper
```

#### Python — AFTER (split by responsibility)

```
src/myapp/users/
├── __init__.py              # barrel: re-exports UserService only (5 LOC)
├── repository.py            # UserRepository                 (~95 LOC)
├── validator.py             # UserValidator                  (~65 LOC)
├── password.py              # PasswordHasher                 (~45 LOC)
├── notifier.py              # EmailSender (renamed — the role, not the verb)
├── service.py               # UserService (orchestrator)     (~135 LOC)
└── _queries.py              # _build_query (private)         (~30 LOC)
```

#### Rust — BEFORE (`auth.rs`, 380 pure LOC)

```rust
// auth.rs — DOES TOO MUCH
pub struct Session { ... }                      // 40 LOC
impl Session { ... }                            // 90 LOC of methods
pub struct TokenIssuer { ... }                  // 30 LOC
impl TokenIssuer { ... }                        // 70 LOC
pub struct RateLimiter { ... }                  // 50 LOC
impl RateLimiter { ... }                        // 70 LOC
fn parse_authorization_header(...) { ... }      // 30 LOC
```

#### Rust — AFTER

```
src/auth/
├── mod.rs              # re-exports Session, TokenIssuer, RateLimiter (8 LOC)
├── session.rs          # Session + impl                         (~130 LOC)
├── token.rs            # TokenIssuer + impl                     (~100 LOC)
├── rate_limit.rs       # RateLimiter + impl                     (~120 LOC)
└── header.rs           # parse_authorization_header             (~35 LOC)
```

#### TypeScript — BEFORE (`api/orders.ts`, 510 pure LOC)

```typescript
// api/orders.ts — DOES TOO MUCH
export const OrderSchema = z.object({ ... })          // 30 LOC
type Order = z.infer<typeof OrderSchema>
export class OrderRepository { ... }                  // 110 LOC
export class PricingEngine { ... }                    // 130 LOC
export class TaxCalculator { ... }                    // 90 LOC
export class OrderService { ... }                     // 150 LOC
```

#### TypeScript — AFTER

```
src/orders/
├── index.ts                    # barrel (6 LOC)
├── schema.ts                   # OrderSchema + Order type      (~35 LOC)
├── repository.ts               # OrderRepository               (~115 LOC)
├── pricing.ts                  # PricingEngine                 (~135 LOC)
├── tax.ts                      # TaxCalculator                 (~95 LOC)
└── service.ts                  # OrderService (orchestrator)   (~155 LOC)
```

---

## Smell 2 — A hard-to-use parameter contract

### Assess the contract

Several independent inputs can make calls hard to understand. Group related inputs when they form a useful domain concept; do not add parameter objects solely to meet a numeric limit.

### Workaround detection — THESE COUNT AS THE SAME SMELL

Disguising parameter count does not fix the design. The following patterns are the same smell wearing a different hat:

**Dict/map smuggling:**
```python
# SMELL — hiding 6 args in a dict
def create_order(params: dict[str, Any]) -> Order: ...
```
```typescript
// SMELL — untyped options bag
function createOrder(opts: Record<string, unknown>): Order { ... }
```
```go
// SMELL — map instead of typed params
func CreateOrder(params map[string]any) (*Order, error) { ... }
```

**Variadic/kwargs catch-all:**
```python
# SMELL — hiding real params behind kwargs
def send_notification(recipient: str, **kwargs) -> None: ...
```
```typescript
// SMELL — rest params to avoid naming args
function sendNotification(recipient: string, ...args: unknown[]): void { ... }
```

**Config object that wraps positional args:**
```python
# SMELL — "options" object that exists only to bundle what would be positional args
@dataclass
class CreateUserOptions:
    name: str
    email: str
    password: str
    role: str
    department: str
    manager_id: int
    # 6 fields, used by exactly one function, no defaults

def create_user(opts: CreateUserOptions) -> User: ...
```

**When the options object is NOT a smell:** when it represents a genuine domain concept reused across multiple call sites with sensible defaults for most fields (e.g., `HttpClientConfig`, `DatabaseConnectionOptions`, `RetryPolicy`).

### The fix

Group related parameters into typed value objects with domain names:

```python
# CLEAN — grouped by domain concept
@dataclass(frozen=True)
class UserIdentity:
    name: str
    email: str

@dataclass(frozen=True)
class OrgPlacement:
    role: str
    department: str
    manager_id: int

def create_user(identity: UserIdentity, placement: OrgPlacement, password: str) -> User: ...
# 3 params, each a meaningful concept
```

```typescript
// CLEAN — typed grouping
interface ShippingDetails {
  readonly address: string;
  readonly city: string;
  readonly zip: string;
  readonly country: string;
}

function createOrder(customer: CustomerId, items: readonly LineItem[], shipping: ShippingDetails): Order { ... }
// 3 params, shipping is a reusable domain type
```

```go
// CLEAN — struct with domain meaning
type Placement struct {
    Role       string
    Department string
    ManagerID  UserID
}

func CreateUser(identity UserIdentity, placement Placement, password string) (*User, error) { ... }
```

Keep independent inputs explicit when grouping would obscure their meaning.

---

## Smell 3 — Verification that adds no independent evidence

Avoid repeating a deterministic local operation's already-established postcondition, such as assigning a variable and immediately asserting the same value. Keep checks that address an actual boundary or failure mode.

For database writes, distinguish successful execution from affected-row count, commit, constraints/triggers, concurrent changes and visibility on the intended reader. Use returned counts/rows or transaction results where they establish the contract; use a follow-up query or real integration test when it proves a required invariant those results do not establish. A successful DELETE may affect zero rows. A committed migration still needs the schema/data behavior required by its acceptance criteria.

Apply the same reasoning to files and remote operations: retain durability, transformation, eventual-state or integrity checks when those are the claims. Do not add routine read-backs or hashes without a concrete question, and do not remove meaningful verification merely because the operation returned without error.

---

## Smell 4 — Negative-form names and conditions

### Why positive form wins

Every negation forces the reader to mentally invert. One negation is tolerable. Two (`if !isNotReady`) is a logic puzzle. Codebases that default to negative naming accumulate double and triple negations that nobody can review confidently.

Positive form reads in the direction of intent: "is this ready?" rather than "is this not-not-ready?"

### Naming

| Negative (SMELL) | Positive (CLEAN) |
|---|---|
| `isNotValid` | `isValid` (invert branch) |
| `isDisabled` | `isEnabled` |
| `noErrors` | `isClean` / `errorsResolved` |
| `notFound` | `found` (invert branch) |
| `isNotEmpty` | `hasItems` / `isPopulated` |
| `missingAuth` | `hasAuth` / `isAuthenticated` |
| `cannotProceed` | `canProceed` (invert branch) |

Name the **presence** of the quality you care about, not the absence of its opposite.

### Conditions

```python
# SMELL — double negative
if not is_invalid(token):
    proceed()

# CLEAN — single positive check
if is_valid(token):
    proceed()
```

```typescript
// SMELL — negated boolean in branch
if (!user.isNotVerified) {
  grantAccess();
}

// CLEAN — positive name, direct check
if (user.isVerified) {
  grantAccess();
}
```

```go
// SMELL — inverted negative
if !config.DisableLogging {
    log.Info("starting")
}

// CLEAN — positive flag
if config.LoggingEnabled {
    log.Info("starting")
}
```

```rust
// SMELL — negated negative
if !skip_validation {
    validate(&input)?;
}

// CLEAN — positive gate
if should_validate {
    validate(&input)?;
}
```

### When negation IS appropriate

- **Early returns / guard clauses:** `if !authorized { return Err(...) }` — the negative form IS the intent (reject the bad case).
- **Filtering out:** `items.filter(|x| !x.is_expired())` — the negation describes the keep/discard decision directly.
- **Error state names:** `Error`, `Failed`, `Timeout` are negative concepts by nature — do not force them into positive wrappers like `isSuccessAbsent`.

The rule is not "never use negation." The rule is: **when you have a choice between naming the presence and naming the absence, name the presence.** The branch logic follows from the name, not the other way around.

---

## Smell 5 — Comments that add no useful information

**Signals:** comments that merely restate code, trivial docstrings, decorative section dividers, commented-out code, and vague TODOs/Notes without an actionable purpose.

**KEEP:** explanations of business logic, edge cases, workarounds, ticket links, regex/algorithm rationale, and required directives. Preserve BDD markers (`given`, `when`, `then`, `when/then`). A comment may describe an obvious operation and still explain a required invariant or consumer contract, such as report ordering; remove redundant phrasing only if that reason stays clear. Behavior tests do not justify deleting useful rationale.

## Smell 6 — Redundant defense or overbroad error handling

**Signals:** checks for values guaranteed by the real runtime contract, impossible exception paths, repeated validation, default values for required inputs, obsolete compatibility shims, and broad catches that swallow failures or merely log and continue. Static annotations alone do not prove that runtime inputs are trusted or non-null.

**KEEP:** validation at user-input/external-API boundaries, I/O error handling, nullable database fields, supported compatibility behavior and cancellation/resource cleanup. A top-level boundary catch-all with explicit logging and re-raise can be intentional. A guard without proof of redundancy is load-bearing.

**Required evidence for removal:** before deleting validation or error handling at a trust boundary, require an adversarial regression using malformed or hostile input that fails when the required boundary protection is absent. Establish that a supposedly redundant check already runs inside that boundary and that the candidate removal retains the protection. No adversarial regression or no proof of redundancy means the guard stays.

Narrow broad catches to the errors the code can actually handle, without changing the public error contract. In Python, inspect `except Exception` and especially `except BaseException`; retain propagation of unknown errors and cancellation. In JavaScript/TypeScript, an empty catch or logging-only catch needs a justified handling contract; use the project's reliable error discrimination (for example `instanceof` where appropriate), handle known cases and re-throw unknown ones. These are language-specific remedies, not permission to replace deliberate boundary handling.

## Smell 7 — Control flow or types that obscure the contract

**Signals:** deeply nested branches, nested ternaries, dense multi-predicate expressions, functions doing unrelated jobs, clever one-liners whose evaluation order is hard to see, or variant discrimination that silently misses cases. Nesting depth, predicate count and function length indicate where to inspect; they do not mandate a rewrite. Assess parameter contracts under [Smell 2](#smell-2--a-hard-to-use-parameter-contract), not a second argument-count rule.

**KEEP:** established patterns with a clear purpose, cohesive algorithms, intentional performance-critical idioms, and ordinary boolean/range checks. Prefer guard clauses, named intermediate values or explicit branches when they clarify the same behavior; preserve side-effect order and cleanup.

For variant handling, retain exhaustiveness with the language version and type checker the project actually supports. Python `match/case` and an available `assert_never` can express that contract for a closed union; they are not mandatory substitutions for every `if/elif`, and a cleanup does not authorize a runtime upgrade or typing dependency. Keep compatible exhaustive branches when they are clear. A Python `object` annotation is appropriate for a genuinely opaque or unrestricted value; use a `Protocol`, `TypeVar` or explicit union when structural operations, generic relationships or a closed variant set actually require it. Do not narrow accepted inputs merely to replace a type spelling.

## Smell 8 — Abstraction without a real responsibility

**Signals:** pass-through wrappers, single-use helpers with no meaningful operation or boundary, speculative indirection, interfaces that add neither substitutability nor testability, and factories that only call a constructor.

**KEEP:** real test seams, multiple-implementation contracts, framework-required boundaries and helpers that name a cohesive operation. A single caller or implementer alone is not proof that an abstraction is needless. Preserve useful seams rather than inlining them to reduce a count; cleanup is not an excuse to introduce new layers.

## Smell 9 — Boundary violations and hidden coupling

**Signals:** wrong-layer imports such as a UI importing its database driver, handlers taking on unrelated business rules, access to another module's private state, and hidden side effects in pure-named functions.

**KEEP:** pragmatic shortcuts deliberately established by the codebase when they do not violate required trust/resource contracts. If the intended boundary is unclear, flag it for judgment rather than inventing an architectural rewrite. Structural repairs must fit the authorized scope and preserve the actual API and side-effect contracts.

## Smell 10 — Apparently dead code

**Signals:** unused imports/private functions, unreachable branches, stale feature flags, debug leftovers (`console.log`, `print`, `dbg!`), and removed-but-still-referenced code.

**KEEP:** reflection, dynamic dispatch, string-based lookups, meaningful operational output, and intentional feature-flag rollback paths. Check callers and registration mechanisms; confirm a rollback path's intended lifetime with the user before deleting it. An empty static-reference search alone is not proof of dead code. Safe deletion must leave no orphaned imports or references and must preserve the covered behavior.

## Smell 11 — Duplication without distinct intent

**Signals:** copy-pasted branches with trivial differences, helpers implementing the same policy, and repeated literal or magic-number sequences.

**KEEP:** incidental similarity between code serving different intents that may diverge. Prefer separate cohesive implementations over a premature shared abstraction. Reuse an existing equivalent helper when it improves the contract; a justified new abstraction needs structural-change scope rather than a cleanup-only pass.

## Smell 12 — Avoidable cost with obvious semantic equivalence

**Candidates, not automatic rewrites:** repeated list scans where a set preserves the needed semantics; loop-invariant computation; unnecessary intermediate collections; string concatenation in a loop; redundant database/API calls; unnecessary deep copies/clones; and repeated length computation where that length is genuinely stable and nontrivial to obtain.

**KEEP / required evidence:** apply an optimization only when behavior equivalence is obvious and supported by the affected regression evidence. Check ordering, duplicates, laziness, side effects, exception timing, snapshot/ownership behavior and external-call semantics as applicable. Do not assume a generator, batch request, cached length or shared object is equivalent merely because it is cheaper. Do not micro-optimize a hot path without a benchmark. Algorithms with subtle correctness implications belong to separately scoped refactoring, not a cleanup disguised as optimization. If in doubt, skip and report it.
