# Playwright — MCP vs Local Chrome

Use [browser-session.md](../browser-session.md) for actual provider discovery, authorization and session ownership. The engine's WAF capability tags describe requirements; they do not discover or grant access to a host tool. Retain the serialized `playwright_mcp` / `playwright_mcp_mobile` names for existing profiles, but interpret them as caller-owned browser handoffs rather than literal MCP tool prefixes.

## The two paths

| Path | Execution owner | Prerequisites and result |
| --- | --- | --- |
| Host browser handoff | Calling agent and its exposed runtime/project browser | JS/DOM observation plus requested device/selector context. Engine returns UNKNOWN and no HTML until the caller obtains evidence; it cannot call MCP tools itself |
| Local real Chrome | `engine/templates/playwright_real_chrome.js` or mobile template | Installed Node, resolvable Playwright dependencies and Chrome; subprocess HTML is validated by the engine |

## Host browser handoff

Inspect the active tools and their schemas. Tool prefixes, browser binaries, device controls and session semantics vary by host; MCP is a transport, not a fixed Chromium build or TLS fingerprint. Do not run another product's MCP setup commands, invent `browser_*` calls, or infer a tool's capabilities from its name.

For an UNKNOWN host-browser attempt, retain the target URL, device context and success selector. Use a connected available browser to navigate, wait for actual target content, and inspect DOM/AX state or obtain HTML as the task requires. Fresh snapshots guide element input. Network/console observations can diagnose failed loading; screenshots establish visual claims. A generic text snapshot alone does not validate rendered fidelity.

If no appropriate browser is available, keep the handoff unresolved and name the missing observation. A permission denial is not grounds to switch providers to bypass it. Browser/server setup is separate, authorized work; it is not an automatic step of the engine's failure path.

## Approach 2 — Local Node + Real Chrome

### Dependencies

Reuse the installed Node/Chrome environment and verify module resolution from the template's execution context. The templates require locally resolvable `playwright`. They use `playwright-extra` and `puppeteer-extra-plugin-stealth` when both are present, otherwise warn and use plain Playwright; that fallback does not prove equivalent stealth. The mobile path also needs the selected device descriptor. A working native browser tool does not imply those local dependencies exist.

Only install dependencies or download Chrome when environment setup is authorized. Prefer the project's package manager and an approved local/tool environment; do not assume global npm modules will resolve from the template directory. If prerequisites are missing, report this local path unavailable and use a connected host browser only when it supplies the required evidence.

### Invocation (Inside the Engine)

```python
from engine.executor import run_playwright_fallback

attempt, html = run_playwright_fallback(
    "https://example.com/path",
    profile_id="akamai_bot_manager",
    success_selectors=["article"],
    device_class="desktop",   # "desktop" | "mobile" | "auto"
)
```

Internally, it runs `engine/templates/playwright_real_chrome.js` or `playwright_mobile_chrome.js` with Node and retrieves the HTML. Templates accept generic URL, wait-selector, timeout, profile and device parameters; no site-specific branches.

### Desktop Template (`playwright_real_chrome.js`)

```js
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',        // ← Key: real Chrome, not bundled Chromium
  headless: false,          // Template's headed diagnostic configuration
  viewport: { width: 1366, height: 900 },
});
```

### Mobile Template (`playwright_mobile_chrome.js`)

```js
const { chromium, devices } = require('playwright-extra');
const iPhone = devices['iPhone 13 Pro'];

const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',          // Real Chrome TLS
  ...iPhone,                  // Automatically inject UA/viewport/isMobile/hasTouch
  headless: false,
});
```

**Device caveat**: combining `channel:'chrome'` with `devices[...]` keeps the Chrome TLS fingerprint while changing only the HTTP layer (UA/viewport) to mobile. Verify the actual target; this combination does not guarantee challenge resolution.

## Engine selection and context

The profile's capability tags select an executor requirement; `force_executor` selects an existing serialized executor explicitly. Mobile context or `needs_mobile_context` selects a mobile variant, while `needs_real_tls_stack` selects a local real-Chrome template. `needs_js_exec` without real-TLS requirements selects the host-browser handoff. The caller still checks real capability availability; no profile entry proves an installed server is reachable.

## Shared Validation

Local-template HTML is revalidated with `engine/validators.py:validate()`. A retrieved page can still be empty or a challenge; inspect its verdict and trace rather than treating a browser launch as success. The host-browser handoff returns UNKNOWN and empty HTML, so the caller must obtain and validate evidence separately. It must not rewrite that attempt into a success without actual content.

When visual-qa is the acceptance check, keep its capture, state and independent-review requirements.

## Profiles, retries and cleanup

The engine's default local invocation uses an owned temporary profile; it is removed after the subprocess finishes or fails. Supply `profile_dir` explicitly only when retaining that profile is intended and its use is authorized. The engine preserves a caller-supplied profile. Direct template callers must supply a nonempty `profileDir` and own its lifecycle; the templates do not choose a shared default profile. Do not point at a user's main profile or delete a profile merely to retry a blocked page.

For a fresh-state diagnostic, create an owned temporary profile and compare observations. Preserve an existing authenticated session; report missing permissions or state rather than clearing it. On failure, inspect the attempt's error and verdict. Only task-owned resources may be cleaned up.
