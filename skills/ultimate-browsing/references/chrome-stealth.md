# Tier 2 — Chrome stealth (CloakBrowser + agent-browser)

Use this specialist route for observed automation/fingerprint challenges that an available authorized browser cannot resolve, or when the integration is explicitly selected. First read [browser-session.md](browser-session.md). Ordinary clicks, screenshots and login should reuse an appropriate existing browser. These two runtime tools are not vendored; missing tools do not authorize installation:

- **CloakBrowser** (`pip`) — stealth Chromium with source-level C++ fingerprint patches. The Python wrapper source is MIT; the downloaded Chromium binary is covered by CloakBrowser's separate binary license and is not redistributed by this package. Provides fingerprint patches; verify the actual target and required content rather than assuming a detector result guarantees access. Pin **0.5.7**.
- **agent-browser** (`npm`, Apache-2.0) — native CDP automation CLI that drives CloakBrowser. AX-tree snapshots, `@eN` refs, click/fill/type/scroll, screenshots, video, cookie/state/session management. Pin **0.34.0**.

```
CloakBrowser (stealth Chromium) <- CDP port 9242 -> agent-browser CLI
  - 57 C++ fingerprint patches                  - AX-tree snapshots, @eN refs
  - Canvas/WebGL consistency                    - click / fill / type / scroll
  - navigator.webdriver = false at C++ source   - screenshot, video record
  - Humanize mode (mouse curves, timing)        - cookie / state / session mgmt
```

## Setup when authorized

Check for an existing compatible installation and reuse it. Keep the pinned versions below for this recipe; changing them is a separate compatibility decision. Installation may download dependencies and a browser, so use an approved environment and the project's package manager. Do not recreate an existing venv or silently upgrade shared tools. The following is for a new environment path, chosen within authorized setup:

```bash
CLOAK_VENV="<approved-new-venv-path>"
uv venv "$CLOAK_VENV" --python 3.13
uv pip install --python "$CLOAK_VENV/bin/python" "cloakbrowser==0.5.7"
"$CLOAK_VENV/bin/python" -c "import cloakbrowser; cloakbrowser.ensure_binary()"
```

Use the platform's venv interpreter path (`Scripts/python.exe` on Windows). Run the browser-download step only when that download is in scope. Missing prerequisites otherwise leave the specialist route unavailable.

For agent-browser, prefer an existing project/tool installation. If **global** CLI setup is authorized, the pinned recipe is:

```bash
npm install -g agent-browser@0.34.0
agent-browser install
agent-browser --version
```

Bun's equivalent global install is an alternative when already available and authorized. Neither browser installation nor changing another host's MCP configuration is a prerequisite for using a connected runtime browser.

Confirm the existing CloakBrowser installation and inspect the installed version's help/source when options differ:

```bash
"$CLOAK_VENV/bin/python" -c "import cloakbrowser; print(cloakbrowser.__version__, cloakbrowser.CHROMIUM_VERSION, cloakbrowser.binary_info()['installed'])"
```

The pinned [CloakBrowser v0.5.7 API](https://github.com/CloakHQ/CloakBrowser/blob/v0.5.7/README.md) documents async launch, Chrome args and browser close. The pinned [agent-browser v0.34.0 commands](https://github.com/vercel-labs/agent-browser/blob/v0.34.0/README.md) document named sessions, navigation, viewport, screenshot and close. These references establish the recipe's API shape, not success on every site.

## Launch + drive

Use an owned browser and an unused local debugging port. Port 9242 is only an example; if occupied, select another port instead of killing its listener. Never clear cookies/cache/site data in the user's main profile. Prefer an existing authorized login; cloning a selected profile or exporting domain-scoped cookies requires that access to be within the task scope. Use a private task directory for any authorized clone and delete only the owned clone when finished.

Start an owned long-lived process/session. This example keeps the async browser alive until the task stops that process, and closes it in `finally`; do not detach it and lose its identity:

```bash
export CLOAK_CDP_PORT=9242
"$CLOAK_VENV/bin/python" - <<'BROWSER_PY'
import asyncio
import os
from cloakbrowser import launch_async

async def main():
    port = int(os.environ["CLOAK_CDP_PORT"])
    browser = await launch_async(
        headless=False,
        stealth_args=True,
        args=[f"--remote-debugging-port={port}"],
    )
    try:
        await asyncio.Event().wait()
    finally:
        await browser.close()

asyncio.run(main())
BROWSER_PY
```

The `asyncio.Event` hold is lifecycle scaffolding around the documented API, not an upstream launcher. Keep the terminal/process handle so it can be interrupted and cleaned up. Do not assume this process or port belongs to the task without that handle.

From another tool call/session, inspect this owned endpoint, create its first tab if needed, then drive it with a unique task session:

```bash
curl --fail --silent "http://127.0.0.1:${CLOAK_CDP_PORT}/json/version"
curl --fail --silent -X PUT "http://127.0.0.1:${CLOAK_CDP_PORT}/json/new?https://example.com"
agent-browser --session omo-stealth-check --cdp "$CLOAK_CDP_PORT" snapshot -i
agent-browser --session omo-stealth-check --cdp "$CLOAK_CDP_PORT" click @e3
agent-browser --session omo-stealth-check --cdp "$CLOAK_CDP_PORT" screenshot out.png
```

Use the authorized target URL and a current snapshot's element reference; `@e3` is only an example. Environment variables must be provided to each execution context. Do not connect to an arbitrary listener on the example port. Confirm actual content/state and captured pixels, not just successful connection.

Close the named session only when it owns the browser, and stop the owned launcher so its `finally` runs. With a borrowed user browser, close only owned tabs or disconnect; never use whole-browser `close`. Apply the same cleanup on failed navigation/capture and report a remaining owned resource if cleanup fails.

agent-browser ships its own always-version-matched usage guide — load it instead of guessing flags:

```bash
agent-browser skills get core            # core workflows, patterns, troubleshooting
agent-browser skills get core --full     # + full command reference and templates
agent-browser skills get electron        # Electron apps (VS Code, Slack, Discord, Figma, ...)
agent-browser skills list                # everything available on the installed version
```

## Verify stealth

```bash
agent-browser --session omo-stealth-check --cdp "$CLOAK_CDP_PORT" eval 'navigator.webdriver'
```

`navigator.webdriver === false` checks one signal only. Verify the actual page is accessible, contains the required content, and supports the requested interaction; detector-page success does not prove target-page success. Historical blanket detector-pass claims are not a current acceptance criterion.

> **agent-browser 0.33.x behavior note:** the daemon now defaults to a 1-hour idle timeout (saves restore state, closes the browser, exits after 1 h of no commands). Set `AGENT_BROWSER_IDLE_TIMEOUT_MS=0` to restore the old always-persist behavior. External WebSocket stream consumers see latest-wins frame delivery; `record` (CDP) and the dashboard are unaffected.

## Cookie login (cross-platform)

Use cookie extraction/injection only when required and authorized for the selected account/profile, after checking whether existing browser authentication already meets the need. `scripts/extract_cookies.py` reads cookies from a local browser profile and optionally injects them into the running CDP session. Profile-path resolution and value decryption are per-OS:

| OS | Profile location | Cookie value decryption |
|----|------------------|--------------------------|
| macOS | `~/Library/Application Support/<app>/` | Keychain (AES-128-CBC, PBKDF2 salt `saltysalt`) |
| Linux | `~/.config/<app>/` (Chromium), `~/.mozilla/firefox/` (Firefox) | libsecret/SecretService, then PBKDF2 + AES-128-CBC |
| Windows | `%LOCALAPPDATA%\<app>\User Data\` | DPAPI (`CryptUnprotectData`) + AES-256-GCM (`os_crypt` key) |

```bash
# Extract to a file:
COOKIE_DIR="<private-task-directory>"
mkdir -m 700 -p "$COOKIE_DIR"
python3 ../scripts/extract_cookies.py --browser chrome --domain youtube.com --output "$COOKIE_DIR/youtube.cookies.json"
# Extract and inject into the running CDP session:
python3 ../scripts/extract_cookies.py --browser chrome --domain youtube.com --inject --cdp "$CLOAK_CDP_PORT"
```

Cookie export files are written with owner-only `0600` permissions. Do not place live auth cookies in shared temp directories or commit them to a repo. Cookie injection sends values to CDP over stdin rather than argv, so live cookie values do not appear in process listings. Cookies apply on next navigation — reload after injecting. Google services use fingerprint-bound tokens (SIDTS) that may not transfer across browser profiles. Firefox-family profiles store cookies unencrypted; Chromium-family profiles trigger a one-time OS-keyring prompt on macOS/Linux.

## Anti-patterns

- Do NOT launch CloakBrowser for plain text extraction — use Tier 1.
- Do NOT pass an `--init-script` for the webdriver flag — CloakBrowser already patches it at source; a user-agent override is conditional on the observed target and compatible browser context.
- Do NOT run agent-browser before creating the first tab via `curl -X PUT .../json/new` — CloakBrowser launches tabless.
- Verify the actual challenge and target after escalation; do not infer a universal provider requirement from a login prompt or connection failure.
- Close only owned sessions/processes, on success and failure; preserve borrowed browsers and unrelated tabs.
- Do NOT inject cookies without reloading the page.

## Troubleshooting

- **Port occupied:** inspect ownership without changing the listener. Select another port for the owned launcher; do not kill processes by port number.
- **Connection refused:** verify the owned launcher's status and endpoint. A failed connection is not a page-level automation block. Do not install a new stack or modify remote-debugging settings automatically.
- **Stale element reference:** take a fresh snapshot before input; do not reuse an `@eN` from an earlier navigation.
- **Authentication fails to transfer:** do not weaken account protections or repeatedly copy the whole profile. Use a supported authorized login/session or report the unavailable account state.
- **Version mismatch:** consult the installed version's usage guide. Upgrade only within authorized tool-maintenance scope, retaining the pins until compatibility is checked.
