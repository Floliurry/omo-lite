# Browser capability and session selection

Use this reference when a task needs a rendered page, interaction, screenshots, browser diagnostics, or authenticated navigation. It owns browser provider selection and session boundaries; visual-qa owns visual acceptance.

## Select the observation before the provider

Inspect the active tool catalog and relevant configured project tooling. Use exposed discovery tools when available; a skill name, executable name, or installed file is not evidence of a connected browser. Prefer an existing runtime browser integration that supplies the required observations. Verify connection with a bounded operation on the authorized target or an owned isolated test page. A declared tool that returns a connection error is unavailable for that run, not a completed observation.

| Required evidence | Capability to look for | What it cannot substitute for |
| --- | --- | --- |
| Static page content | Existing web reader/search or platform API | A text fetch does not prove rendered layout or interaction |
| Click, type, keyboard, hover and state changes | Browser navigation, fresh element snapshots, input and DOM inspection | API names and element identifiers differ between providers; use the exposed schema and current snapshot |
| Visual/reference fidelity | Real screenshots with controlled viewport, scale, state and scroll | DOM/AX text is not a pixel comparison; capture and inspect actual pixels |
| Network, console and performance diagnosis | Browser request/log inspection and trace capabilities | Read the trace for the question asked; it is not a Lighthouse score |
| Authenticated work | An appropriate authorized browser session or isolated test login | Needing login does not establish anti-bot failure or authorize profile/cookie export |

Use the actual tool names and parameters in this runtime. A code orchestration cell is not necessarily Node, Bun, a persistent kernel, or a browser. A host-specific in-process browser is usable only when the runtime exposes and documents it. Local Playwright/Puppeteer and browser CLIs remain alternatives when already configured or when setup is within the task's authorized scope; their dependencies are separate from runtime browser availability.

## Preserve session ownership

- For tests and unauthenticated work, prefer an isolated context or an owned temporary profile. Track only the pages, sessions and temporary files created for this task.
- For an existing user session, confirm the target/account from the task context. Preserve unrelated tabs, downloads and storage. Reuse authorized authentication when possible instead of copying a whole profile.
- Close owned pages/contexts in failure cleanup as well as on success. For a borrowed browser, disconnect or close only owned pages; do not close its entire browser/session. If the integration cannot remove an owned resource, report the remaining resource rather than acting on unrelated state.
- Never clear the user's main cookies, cache or site data. Profile cloning or cookie extraction/injection needs a concrete task requirement and authorized access to the relevant account/profile. Use only the necessary domain, a private task directory, and owner-only cookie files; retain the protections in [chrome-stealth.md](chrome-stealth.md).
- An occupied port is not permission to kill its listener. Reuse an endpoint only when its identity and ownership are established; otherwise choose another free port for an owned browser. Stop only the process/session this task launched.

## Escalation and unavailable tools

If existing tools cannot establish the required observation, record the specific missing capability or failed operation. Try another already available provider only when it can supply equivalent evidence and access remains authorized. A permission or access denial does not authorize bypassing that restriction through another tool.

Use [chrome-stealth.md](chrome-stealth.md) for an observed automation/fingerprint challenge that ordinary authorized browsing cannot resolve, or when the user explicitly selects that integration. A connection failure or ordinary login is not itself a stealth requirement. Use the engine's [Playwright fallback](insane-search/playwright.md) for validated HTML extraction with the required JS/device/TLS context.

Installation, browser download, user-level configuration changes, and authentication changes have their own scope. Reuse authorization already present; do not infer global setup from a request to inspect or capture a page. If setup is outside scope, report the missing prerequisite and continue independent work. Do not pretend a weaker fallback clears the blocked gate.

## Evidence and completion

Record the target URL/build, provider actually used, viewport/device/scale, relevant state, artifacts and any limitation needed to interpret the result. Keep credentials out of evidence. For visual QA retain every required page/state, screenshot validation, image-diff and independent review gates.

A successful screenshot demonstrates capture capability, not a complete UI verdict. An unavailable browser leaves rendered claims unverified. Preserve valid evidence for unchanged scope and hand it to the selected QA/review workflow without creating a second review chain.
