---
name: ultimate-browsing
description: "Browser interaction, rendered evidence, authenticated sessions, and specialist page-access fallbacks. Use for JS-rendered pages, clicks/forms, screenshots, or blocked-page investigation; reuse available runtime tools. Ordinary search or static reading that existing tools handle does not need the specialist engine."
---

# Ultimate Browsing

Use the browser or reader that can establish the requested evidence within the task's scope. Begin with actual runtime capabilities, not a fixed tool stack. Read [browser-session.md](references/browser-session.md) for rendered/interactive work: it owns provider discovery, authentication, cleanup and unavailable-capability behavior.

## Route by the required capability

| Request / observed gap | Route |
| --- | --- |
| Ordinary search, article reading or static text/data that existing web tools can retrieve | Use those tools directly; no specialist engine or browser setup needed |
| JS-rendered content, clicks/forms, screenshots, web QA or persistent login | Existing runtime/project browser through `references/browser-session.md` |
| Static fetching is blocked/incomplete, or a media/metadata extraction needs specialist support | Tier 1 insane-search; read its engine reference first |
| A platform-native API/reader supplies the missing content more directly | Tier 1.5 agent-reach; read the relevant category and respect its prerequisites |
| Observed automation/fingerprint rejection that the available authorized browser cannot handle, or an explicitly selected stealth integration | Tier 2b Chrome stealth; read its setup/session reference, checking authorization and prerequisites first |

These are capability choices, not a mandatory ladder. A failed connection is not proof of bot detection. A login requirement is not permission to export cookies. If no available route supplies the required evidence, report the exact unverified claim; do not turn missing tools into an implicit global installation.

## Tier 1 — insane-search (headless extraction)

**When**: existing readers cannot supply the required content, or the request needs the specialist blocked-page/media/metadata path without browser UI.
**Capability**: lightweight extraction and fallback recipes using curl_cffi TLS impersonation, yt-dlp (1858 sites), official public APIs, mobile URL transforms, **Phase-2.5 surrogate archives** (Wayback / archive.today snapshots, provenance-tagged — see [`references/insane-search/cache-archive.md`](references/insane-search/cache-archive.md)), a key-gated Jina Reader (`JINA_API_KEY`), and a Playwright real-Chrome fallback. The engine lives **inside this skill** at `engine/` and is invoked as a module. Surrogate results are dated COPIES: a result whose `provenance` is `snapshot` must be reported with its `snapshot_timestamp`, never presented as the live page.

```bash
# Specialist command — after checking dependencies, detects WAF and runs the fetch grid (run from the skill dir):
python3 -m engine "https://example.com/blocked-page"
#   add --selector "<CSS>" for positive-proof validation, --device auto|desktop|mobile,
#   --trace to inspect every attempt, --json for machine-readable output.

# YouTube subtitles / metadata (no browser):
yt-dlp --write-sub --write-auto-sub --sub-lang "en,ko" --skip-download -o "/tmp/%(id)s" "<URL>"

# Reddit / HN / Bluesky / arXiv etc. use official public endpoints — see the Phase 0 index in
# references/insane-search/README.md (Twitter syndication, Reddit .json, HN Firebase, ...).
```

The full engine harness (rules R1-R7, the Phase 0 official-API index, the no-site-name rule, and the `references/insane-search/*.md` deep-dives for TLS, Playwright routing, Naver, media, etc.) is in [`references/insane-search/README.md`](references/insane-search/README.md). Read it before tuning the engine or adding a WAF profile.

### Escalate to Tier 1.5 or Tier 2 when
- The target is a Chinese / social platform with a native reader -> Tier 1.5.
- insane-search returns empty/partial, or the page needs JS interaction, a screenshot, a persistent login, or media playback -> Tier 2.

## Tier 1.5 — agent-reach (platform-native readers)

**When**: the target is a platform with a first-class API/CLI that beats generic fetching — especially Chinese platforms that stealth browsers still cannot reach cleanly. Several channels are zero-config (Douyin, V2EX, Reddit, RSS, YouTube); others need a one-time auth you supply via environment variables if you have access (`JINA_API_KEY` for the configured Jina Reader route, which the provider also supports anonymously under its own limits; see `references/insane-search/jina.md`; `TWITTER_*` for X; a transcription key for podcasts).

| Category | Platforms | Entry |
|---|---|---|
| social | xhs (Xiaohongshu), douyin, weibo, bilibili, V2EX, Reddit, Twitter/X | [references/agent-reach/social.md](references/agent-reach/social.md) |
| web | Jina Reader, WeChat articles, RSS | [references/agent-reach/web.md](references/agent-reach/web.md) |
| video | YouTube, Bilibili, podcast transcripts, Douyin video | [references/agent-reach/video.md](references/agent-reach/video.md) |
| career | LinkedIn | [references/agent-reach/career.md](references/agent-reach/career.md) |
| dev | GitHub (gh CLI) | [references/agent-reach/dev.md](references/agent-reach/dev.md) |
| search | Exa AI | [references/agent-reach/search.md](references/agent-reach/search.md) |

```bash
mcporter call 'douyin.parse_douyin_video_info(url: "<URL>")'   # douyin, zero-config
curl -s "https://r.jina.ai/https://weibo.com/<uid>/<pid>"      # weibo via Jina
yt-dlp --dump-json "<bilibili-url>"                            # Bilibili (overseas: add --cookies-from-browser)
curl -s "https://www.v2ex.com/api/topics/hot.json"            # V2EX public API
```

Routing table, per-platform auth (set `TWITTER_*` env vars, `gh auth login`, a transcription key — only if you have access), rate-limit notes, and known version quirks are in [references/agent-reach/README.md](references/agent-reach/README.md).

## Tier 2 — a real browser (real interaction)

**When**: real interaction is needed (clicks, forms, screenshots, video, persistent login), or Tier 1/1.5 failed.

### Tier 2a — available browser

Follow [browser-session.md](references/browser-session.md). Prefer a connected runtime browser integration for navigation, state inspection, screenshots and diagnostics when it provides the required evidence. Use a configured local Playwright/Puppeteer or browser CLI when needed; a host-specific code-cell browser is an option only when that interface is actually exposed. Do not require a particular skill, package or native tool prefix before attempting an available equivalent.

When the work calls for visual QA, follow `/visual-qa`. For a performance question, report what the trace or report actually measures.

### Tier 2b — specialist Chrome stealth

CloakBrowser plus agent-browser remains the maintained specialist route for observed automation/fingerprint blocks or an explicitly selected integration. It is not required merely because a page needs login, screenshots or a persistent session. [chrome-stealth.md](references/chrome-stealth.md) preserves the version pins, conditional setup, launch/CDP recipe, verification and owned cleanup. Other available providers may be used when they establish the same required access and evidence.

### Cookie login (cross-platform)

Use this only when the task requires and authorizes access to the specified profile/account and existing browser authentication cannot meet the need. Do not clear or copy the main profile as a routine browsing step.

`scripts/extract_cookies.py` reads cookies from a local Chromium-family or Firefox-family browser and optionally injects them into the running CDP session. It resolves browser profile paths and decrypts cookie values per-OS (macOS Keychain, Linux libsecret, Windows DPAPI):

```bash
# Authorized domain-scoped extraction to a private file:
COOKIE_DIR="<private-task-directory>"
mkdir -m 700 -p "$COOKIE_DIR"
python3 scripts/extract_cookies.py --browser chrome --domain youtube.com --output "$COOKIE_DIR/youtube.cookies.json"
# Extract and inject into the running CDP session:
python3 scripts/extract_cookies.py --browser chrome --domain youtube.com --inject --cdp "$CLOAK_CDP_PORT"
```

Cookie export files are written with owner-only `0600` permissions. Do not place live auth cookies in shared temp directories or commit them to a repo. Cookie injection sends values to CDP over stdin rather than argv. Cookies apply on next navigation — reload after injecting. Google services use fingerprint-bound tokens that may not transfer across browser profiles. Full detail in [references/chrome-stealth.md](references/chrome-stealth.md).

## Reference docs

| File | When to read |
|------|-------------|
| [references/insane-search/README.md](references/insane-search/README.md) | Tier-1 engine harness (R1-R7, Phase 0 API index, no-site-name rule) + its `*.md` deep-dives |
| [references/agent-reach/README.md](references/agent-reach/README.md) | Tier-1.5 routing table, platform auth, per-category `*.md` |
| [references/browser-session.md](references/browser-session.md) | Provider discovery, actual evidence, session ownership and capability gaps |
| [references/chrome-stealth.md](references/chrome-stealth.md) | Tier-2 CloakBrowser + agent-browser install, CDP flow, version pins, cookie login |

## Environment variables

```bash
CLOAK_CDP_PORT=9242              # CloakBrowser CDP port (default 9242)
AGENT_BROWSER_USER_AGENT="..."   # override UA to hide HeadlessChrome
AGENT_BROWSER_HEADED=1           # show the browser window
# agent-reach auth: set the channel-specific env vars from each tool's docs only if you have access
# Check engine dependencies before use; install only within authorized setup.
```

## Anti-patterns

- Do NOT launch Chrome stealth for ordinary text extraction; use an available reader, or Tier 1 when specialist extraction is needed.
- Do NOT pass an `--init-script` for the webdriver flag — CloakBrowser already patches it at source; a user-agent override is conditional on the observed target and compatible browser context.
- Do NOT run agent-browser before creating the first tab via `curl -X PUT .../json/new` — CloakBrowser launches tabless.
- Do NOT claim that an untested provider resolves an observed automation block; verify access and content after escalation.
- Close owned sessions and pages on success or failure; preserve a borrowed browser and its unrelated state.
- Do NOT inject cookies without reloading the page.
- Do NOT hardcode site domains/selectors into `engine/**` or `waf_profiles.yaml` — runtime hints only (see the no-site-name rule in the insane-search reference).
