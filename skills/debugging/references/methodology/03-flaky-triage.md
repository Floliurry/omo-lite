# Intermittent / Flaky Failure Triage

Use this when a failure is intermittent, changes between tests, passes in isolation, or appears only in CI. The failure pattern helps choose the next observation.

---

## Capture the failure signature

Choose the reruns that distinguish likely causes and record their outcomes in the current task's evidence. Reuse runs already observed; not every row is needed.

| Rerun | Command shape | Question it answers |
|---|---|---|
| Same scope, same command | exactly what just failed | Does the SAME test fail again, or a different one? |
| Failing test in isolation | single file / test filter | Does it pass alone? |
| Relevant scope with isolated resources | use an isolated fixture or pause only competing work this task owns | Does contention affect the result? |
| (When order is suspect) shuffled | `-shuffle=on` / `pytest-randomly` / runner's random seed | Does a specific order reproduce it? Record the seed. |

## Step 2 — Read the signature

| Signature | Dominant hypothesis | Next move |
|---|---|---|
| Same test fails intermittently, everywhere | Possible race in the code under test or async test bug (fixed sleep, unawaited promise, poll-for-time) | Use [hypothesis investigation](02-investigate.md); control task completion or inject a clock where useful |
| **A different test/file each run; each passes in isolation; quiet machine is green** | **Possible environment contention between concurrent runs** | Step 3 checklist; confirm the shared resource before attributing the cause |
| Always the same test, but only in the full suite; isolation green | Test-order dependence / fixture leak (unreset module state, leaked env var, shared singleton) | Bisect with the shuffle seed; find the test that leaks, fix its teardown |
| Fails only on CI, never locally | Resource ceilings (slower disk/CPU → timeouts), different parallelism defaults, container clock | Reproduce locally under constraint (`taskset`, low `--maxWorkers`); raise the *signal* not the sleep |
| Green on plain rerun of the same commit | A passing rerun does not explain the earlier failure | Preserve the failure evidence and choose another check only if it can distinguish a cause |

## Step 3 — Concurrent-run contention checklist

One possible cause is concurrent suites sharing a mutable resource, including runs from different worktrees or background agents. When the observed failure suggests contention, check the relevant resources:

- **Shared tmp roots** — a sandbox/cache dir derived from a *fixed* tmpdir path (`$TMPDIR/<project>-fixed-name`) instead of a per-run `mktemp`. Both runs read/write the same tree; the loser sees half-deleted state.
- **Fixed ports** — hardcoded listen ports in test servers. Two suites race to bind; the loser gets 404/ECONNREFUSED mid-run, in whichever file happened to be running.
- **Global env / config mutation** — tests writing process-external state (dotfiles, shared config, global env) the other run reads.
- **Shared containers / databases** — same-named containers, same schema, same volume.
- **Caches and locks** — package-manager caches, lockfiles, `.git` index contention.

Evidence to capture while it is live: `lsof -i :<port>` during the failure window, a listing of the shared tmp path, a process list showing the concurrent runners.

## Step 4 — Fix policy

- **Confirmed environment contention** → fix ownership of the shared resource in the test or infrastructure responsible: per-run temporary roots, ephemeral ports, or unique container names. Verify concurrent runs no longer interfere where that was the failure mechanism.
- **Order dependence** → find the leaking fixture via the recorded shuffle seed; reset at teardown; re-run shuffled until the seed class is clean.
- **Real race** → prefer a deterministic regression test or controlled reproduction that exercises the violated invariant. See [cause confirmation](06-fix.md).
- Do not present retry wrappers, enlarged sleeps, quarantine, or deletion as proof of a fix. If temporary mitigation is requested, describe the unresolved defect and preserve evidence for follow-up.

A flake outside the requested fix remains a finding to report: state the signature, evidence, and uncertainty without silently expanding the task.
