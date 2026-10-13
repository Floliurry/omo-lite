# Execution verification detail

## Channels

Choose the real surface that exercises the criterion and retain its actual invocation and result:

- HTTP: request the live endpoint and capture status, headers and body.
- CLI/data: capture real stdout, state diff or parsed configuration; a dry run does not prove an effect.
- Terminal/TUI: drive a real pty for behavior. Visual color/layout/CJK claims need faithful rendered pixels, never `tmux capture-pane`. If available, use the project's `script/qa/web-terminal-visual-qa.mjs` with its supported runtime; otherwise an available faithful renderer. Retain invocation and rendering conditions.
- Browser: follow [browser capability and session selection](../../ultimate-browsing/references/browser-session.md), drive the actual page and retain actions/captures. Preserve borrowed sessions and obtain authorization for setup.
- Desktop: drive the running app through available OS-level automation and retain actions/captures.

Missing capture capability leaves that criterion unverified, not downgraded. Any selected visual-qa gates still apply; text dumps and code inspection are not pixel evidence.

## Adversarial risks

Apply each class when its trigger is present, using the cheapest faithful probe. Record the observable result or a scoped non-applicability reason in the ledger. A common probe can cover several criteria when it actually tests each relevant contract.

| Trigger | Class |
| --- | --- |
| New input parsing | malformed input |
| Untrusted external text | prompt injection |
| Resumable or long-running flow | cancel/resume |
| Generated or cached artifacts | stale state |
| Uncommitted user files in scope | dirty worktree |
| Long external command | hung or long commands |
| New or timing-sensitive tests | flaky tests |
| Log-based success claim | misleading success output |
| Mid-operation interruption | repeated interruptions |

Independent verification checks the applicable coverage, especially freshness of generated state, preservation of user work and whether reported success actually exercised the intended assertion. Add targeted probes for evidence gaps, not ritual reruns of already established results.
