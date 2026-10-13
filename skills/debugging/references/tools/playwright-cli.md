# Playwright CLI — Browser QA That Actually Drives a Browser

**https://playwright.dev/ · https://github.com/microsoft/playwright**

Playwright can exercise a browser-served web UI with a rendering engine, JavaScript, cookies, service workers, and a viewport.

Use a real browser when the reported behavior depends on rendering, browser state, client-side code, or viewport. Playwright is one suitable option when it is available; choose the project's existing browser test or automation surface when that is more appropriate. HTTP checks remain useful for API behavior.

> Note: `microsoft/playwright-cli` is the legacy repo; the current tooling lives in `@playwright/test` (npm) and `playwright` (pip), which include the `playwright` CLI. Use those — the legacy `playwright-cli` package is deprecated.

---

## When to reach for Playwright

| Bug symptom | Use Playwright? |
|---|---|
| Form submit produces wrong result | ✅ — Playwright drives the form exactly as a user does |
| Page blank in prod, fine locally | ✅ — hydration/env differences need a real browser |
| CSS looks wrong at a specific width | ✅ — use `--viewport-size` |
| Click doesn't fire / wrong handler | ✅ — Playwright fires real DOM events |
| Flash of unstyled content / loading glitch | ✅ — use trace viewer to see frames |
| API returns wrong data | ❌ — use curl, this isn't a browser bug |
| Backend returns wrong status code | ❌ — use curl |
| Client hits a URL that returns 500 | ✅ but also ❌ — Playwright shows the call + response + failure effect on UI |

---

## Availability and setup

Playwright installs browser binaries separately from the npm package. Use these setup commands only when Playwright is needed for the task and adding dependencies or browser binaries is authorized.

```bash
# In the project
npm init playwright@latest             # interactive; picks TS/JS + browsers + config
# Or if Playwright is already a dep:
npx playwright install                 # downloads browsers
npx playwright install chromium        # just chromium
npx playwright install --with-deps     # also installs OS deps (Linux)
```

Python:
```bash
pip install playwright
playwright install
```

---

## The four things you'll actually use

### 1. `codegen` — record a session, generate the script

The fastest way to create a repro. Opens a real browser; your clicks / typing become a Playwright script you can paste into a test.

```bash
npx playwright codegen https://your-app.local
npx playwright codegen --viewport-size=375,667 https://your-app.local    # iPhone SE size
npx playwright codegen --device="iPhone 14" https://your-app.local
```

Click, type, and navigate in the browser; the side panel builds a script that can become a focused reproduction.

### 2. A one-shot Playwright script — reproduce + capture

For a temporary reproduction, save a focused spec under a path you own, such as `/tmp/debug-repro.spec.ts`:

```ts
// /tmp/debug-repro.spec.ts
import { test, expect } from '@playwright/test';

test('refinement chat shows non-empty response when env var set', async ({ page }) => {
  await page.goto('http://localhost:3000/chat');
  await page.fill('textarea[name="message"]', 'Add a logging step');
  await page.click('button[type=submit]');

  // Wait for the response to appear (not just the spinner to disappear)
  const response = page.locator('[data-testid="assistant-reply"]');
  await expect(response).toBeVisible({ timeout: 30_000 });
  await expect(response).not.toBeEmpty();

  // Capture evidence
  await page.screenshot({ path: '/tmp/debug-after-fix.png', fullPage: true });
  console.log(await response.textContent());
});
```

Run it with tracing enabled for rich post-mortem:

```bash
npx playwright test /tmp/debug-repro.spec.ts --trace on --headed
```

### 3. `PWDEBUG=1` — step through the script with Playwright Inspector

```bash
PWDEBUG=1 npx playwright test /tmp/debug-repro.spec.ts
```

Opens the Playwright Inspector alongside the browser. You can step through Playwright actions, see the DOM state at each step, and edit selectors on the fly.

Use this when the script doesn't reproduce cleanly and you need to watch it run.

### 4. `show-trace` — post-mortem on a failed run

```bash
npx playwright show-trace trace.zip
# or from the test-results dir:
npx playwright show-trace test-results/<test-name>/trace.zip
```

Scrubs through a recorded session: timeline, DOM snapshot at each action, network, console, source. When a test failed on CI but passed locally, this is the single best artifact.

---

## Headless vs headed during debugging

Use headed mode when visual behavior or browser permissions may differ; headless mode is often sufficient for fast, repeatable checks. Capture a screenshot or trace when it helps establish the observed result.

```bash
npx playwright test --headed
npx playwright test --headed --project=chromium     # pin the browser
```

---

## Catching the silent-failure patterns Playwright is good at

```ts
// Toast that flashes and disappears
page.on('console', msg => console.log('[browser console]', msg.type(), msg.text()));

// Unhandled page errors (uncaught exceptions in the page JS)
page.on('pageerror', err => console.error('[page error]', err));

// Network failures — e.g., backend returned 500 but UI shows nothing
page.on('response', async resp => {
  if (!resp.ok()) {
    console.warn(`[network ${resp.status()}] ${resp.url()} — ${await resp.text()}`);
  }
});

// Request that never came back
page.on('requestfailed', req => {
  console.error('[request failed]', req.url(), req.failure()?.errorText);
});
```

Add these listeners to the top of the debug script. They surface a lot of the "UI showed nothing" class of bug.

---

## Viewport and device emulation

CSS bugs that only appear at specific sizes, or layout bugs on mobile:

```ts
// At test level
test.use({ viewport: { width: 375, height: 667 } });

// Per-page
await page.setViewportSize({ width: 375, height: 667 });

// Predefined devices
import { devices } from '@playwright/test';
test.use({ ...devices['iPhone 14'] });
```

---

## Gotchas

- **Wait for state, not for time.** `await page.waitForTimeout(2000)` is flaky. Use `await expect(locator).toBeVisible()` or `page.waitForResponse(urlPattern)`.
- **Stale selectors re-resolve.** Playwright's locators re-find the element on each action, unlike Puppeteer's handles. Don't over-think it.
- **Persistent browser state can affect a reproduction.** Use a disposable test context to isolate cookies, storage, and service workers when they are relevant to the failure. Do not clear the user's existing browser profile or login state.
- **CI images without browser shared libraries may need `--with-deps`** when their setup permits it.
- **Parallel tests share a browser process by default**; if one test polls a debugger port, others may interfere. Use `workers: 1` for debugging.

---

## Cleanup

```bash
# Remove only temporary specs, reports, traces, and captures that this session created,
# after checking their paths. Leave shared browser caches and project artifacts alone.
```
