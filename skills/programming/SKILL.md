---
name: programming
description: "Implementation guidance, behavior-preserving refactoring, requested code cleanup or deslop, and local commits: when they are authorized, how to group them and how to write their messages. Includes Python, Rust, TypeScript, and Go recipes; not a Git history, status, or rebase tutorial."
---

# Programming

Use the existing repository's language version, dependencies, conventions, and checks. This skill provides targeted recipes, not authorization to migrate a project, add tools, or refactor unrelated code. Read only the reference relevant to the changed surface; recipe defaults are suggestions when the project has not already chosen a working approach.

## Implementation

- Inspect the implementation and relevant callers before changing behavior.
- Make contracts explicit with useful types, exhaustive variant handling and typed errors where they fit the existing language and codebase; preserve meaningful error and cancellation behavior.
- Keep resource ownership, async lifetimes and cleanup visible. For unsafe Rust or FFI, read the safety-specific guidance and verify the affected invariants.
- Do not replace a project's package manager, formatter, library or runtime merely because a recipe prefers another. Dependency additions, upgrades and external installers require a task-specific reason and applicable authorization.

## Reviewable code and comments

- Make the changed behavior understandable without the implementation chat: use the domain's names and keep control flow, state changes, side effects and failure paths easy to trace. Prefer named intermediate values or explicit branches when a dense expression hides order or intent.
- Document caller-facing contracts that names and types do not convey, such as preconditions, mutation, ownership, errors or cancellation, following the project's documentation conventions.
- Keep existing comments unless the code they describe is gone or they are wrong: one that looks pointless may record a constraint or a past bug. Update the comments whose behavior you changed.

## Verification

Choose checks that distinguish plausible failures in the changed behavior. For a reproducible defect, prefer a focused failing regression test or faithful reproduction before the fix. Existing tests, type checks, and direct runtime checks may be sufficient for other edits; not every change needs all test tiers or a new harness.

Use real boundaries or narrow fakes where practical. Avoid tests coupled to incidental implementation details. Keep fixtures isolated, deterministic, and safe to run alongside other work. Re-run evidence when its inputs change, not as a completion ritual.

Review pure prose directly. Test machine-consumed structure, routing, or generated-copy consistency where relevant; do not pin natural-language sentences or word counts. Never weaken a behavioral assertion merely to obtain a green result.

When a language server or the project's type checker is available, check the changed files' diagnostics before reporting; its absence is not a failed edit, so use the project's other checks instead. Report checks actually run, observed outcomes, and any relevant limitations.

## Reference routing

Read the matching language index when its guidance is needed, then load only the relevant topic. Existing project choices and the scoped rules above take precedence over universal setup or process prescriptions in inherited recipes.

| Language / surface | Index |
| --- | --- |
| Python | [Python recipes](references/python/README.md) |
| Rust | [Rust recipes](references/rust/README.md) |
| Unsafe Rust, FFI, raw pointers, custom lock-free work | [Rust safety](references/rust-ub/README.md) |
| TypeScript | [TypeScript recipes](references/typescript/README.md) |
| Go | [Go recipes](references/go/README.md) |
| Justified structural change, extraction or migration | [Refactoring contracts and evidence](references/refactoring.md) |
| Preparing a local commit, writing its message, or checking whether it is authorized | [Local commit policy](references/commit-policy.md); ordinary edits need no commit planning |

For backend and operational database work, follow the matching language recipe while preserving the project's driver/ORM, migration tools and database contracts. `data-scientist` is for analytical queries and datasets, not a replacement application database stack. For code-quality review or explicitly requested cleanup, use [code-smell assessment and cleanup](references/code-smells.md): it owns the cleanup criteria, KEEP conditions and required preservation evidence. Consult [logging](references/logging.md) when that concern is part of the change.

Use `debugging` for an observed failure that needs investigation. Cleanup, structural-change methods and commit-policy questions use the applicable references above rather than requiring independent skills. Loading this skill does not require another workflow, review gate or commit.
