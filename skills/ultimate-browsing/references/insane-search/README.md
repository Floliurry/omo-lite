
# Insane Search

> Part of the **ultimate-browsing** skill (Tier 1). Routing and tier-escalation live in [../../SKILL.md](../../SKILL.md).
> The engine package it drives is at [../../engine/](../../engine/), invoked from the skill directory as `python3 -m engine "<URL>"`.
> Deep-dives in this folder: TLS impersonation, Playwright routing, fallback, metadata, Jina, cache/archive, RSS, JSON/public APIs, Twitter, Naver, media.


Use this specialist engine when the entry's capability routing selects it. Existing readers and browsers remain valid providers; reading this reference does not force engine execution or environment setup.

## Engine use and validation rules

**R1 — Diagnose the failed observation before retrying**: distinguish a page-level automation challenge from a connection error, login requirement, permission denial or paid-access response. Respect access restrictions; those failures do not all justify a bypass attempt. For an authorized blocked-page investigation with the engine prerequisites available, use its maintained entrypoint instead of duplicating the fetch grid:

```bash
python3 -m engine "<URL>" [--selector "<CSS>"] [--device auto|desktop|mobile] [--trace] \
                           [--no-retry] [--no-extract]
```

Read the result and existing trace before retrying. Request `--trace --json` when diagnostic detail is needed; change device/hints only for a concrete hypothesis. Missing dependencies leave this route unavailable until setup is authorized.

**R2 — Do not stop at the first 200**: HTTP 200 is the **starting condition for validation**, not success. Read `validate()`'s verdict, reasons and matched selectors. A weak result or unresolved cookie state cannot establish a stronger access/content claim without the missing evidence.

**R3 — No bias**: do not hardcode specific site domains, selectors, or brand names in `engine/**` or `waf_profiles.yaml`. `python3 engine/bias_check.py` is the CI gate. See the **No-Site-Name Rule** section for details.

**R4 — Runtime hints only**: pass site-specific information (success selectors, preferred Referer) only through CLI arguments or `user_hint`; do not embed it in the repository.

**R5 — Prefer official APIs in Phase 0**: for platforms with **official public endpoints**, such as X/Reddit/YouTube/HN/arXiv, check the Phase 0 table first and use the corresponding API. This is an agreed access route, not bias.

**R6 — Report the tested coverage**: preserve the engine's URL-transform × TLS-impersonation × Referer × browser fallback investigation. A configured `max_attempts` is a budget, not proof that every combination ran. Describe tried routes and missing capabilities from the trace. Exhaustion of the available budget supports "these attempts failed", not a universal "cannot access" claim. Stop on a decisive result, access restriction, or unavailable prerequisite; a broader run needs a remaining diagnostic question.

**R7 — API-first investigation on early WAF detection** (caller-driven; report which observed route supplied the result):
Trigger conditions (AND):
1. The first 2–3 attempts early in the engine run all return `verdict=challenge`
2. `profile_used` is identified as one of `akamai_bot_manager`, `cloudflare_turnstile`, `datadome_probable`, `perimeterx_human`, `f5_big_ip`, or `aws_waf`
3. **The user requests listing/collection/repetition** (multiple pages, at least N items, "전부" ["all"], "크롤링" ["crawling"], pagination, etc.). A single body lookup does not qualify.

When all three conditions hold, inspect the page's authorized network/API path alongside the grid when the runtime supports independent concurrent operations. Use the actual host's process handles, yielding/polling and browser schemas; there is no universal Bash background flag or MCP prefix. Otherwise perform the useful probes sequentially. Track and stop only owned background work after a decisive result; retain each route's evidence and provenance.

**Browser reconnaissance route**:
1. Use an available browser-navigation capability to load the target page.
2. Use its network-request inspection to observe XHR/fetch calls and identify candidate `/api/`, `/graphql`, or `.json` endpoints. If this capability is unavailable, report that branch untested; do not invent a tool or install a server automatically.
3. For endpoints accessible within the task's authorization, inspect the response with an appropriate existing reader or `python3 -m engine <API_URL>` when that engine route is needed. Do not assume a discovered endpoint grants access or needs weaker protections.
4. Validate response content/schema and pagination before repeated collection. Keep authentication private and preserve rate/access limits.

This branch retains the ability to retrieve structured data from an accessible application API when HTML loading is the obstacle. Its usefulness and timing depend on the target and available tools; there is no fixed success or duration guarantee.

**When not to use R7**: for a single lookup that only needs one page's body (one document or blog post), the engine alone is sufficient — trigger condition #3 excludes this case.

**R7 bias prevention**: do not hardcode internal API URLs or parameters in `engine/**`. Use discovered URLs only in runtime calls; do not embed them in the repository.

---

Core invariants of this skill:

- **Engine entrypoint**: when using this engine, use `python3 -m engine <URL>` or `from engine import fetch; fetch(...)`; ordinary reading follows the skill entry's provider selection.
- **No bias**: no site-specific hardcoding in `engine/**` or `waf_profiles.yaml`.
- **Runtime hints only**: pass site-specific information through CLI/`user_hint`.

## Intent Classification (Before Phase 0)

| User input | Route |
|------------|------|
| URL provided (`https://...`) | → Check Phase 0; if there is no match, use Phase 1 (generic fetch chain) |
| Handle provided (`@username`) | → Phase 0 syndication/API |
| Keywords only ("X에서 AI 검색" ["search X for AI"]) | → Use a web search tool (`site:{domain} {keyword}`) first → re-enter once a URL is available |

> **Limitation for new Korean content**: keyword searches on Naver/Daum/Korean communities must go through web search tools, and indexing of new content may be delayed.

## Phase 0 — Official Platform API Index

> Only dedicated APIs/CLIs **officially published** by platforms belong here. This is use of agreed endpoints, not bias.

### Dedicated Social/Community APIs

| Platform | Method | Details |
|--------|------|------|
| X/Twitter | syndication (timeline) + oEmbed (individual tweets) + keyword search: web search tool → oEmbed | [twitter.md](twitter.md) |
| Reddit | URL + `.json` + Mobile UA | [json-api.md](json-api.md) |
| Bluesky | AT Protocol (`public.api.bsky.app/xrpc/...`) | [public-api.md](public-api.md) |
| Mastodon | Instance-specific public API | [public-api.md](public-api.md) |
| Hacker News | Firebase API + Algolia Search | [json-api.md](json-api.md) |
| Stack Overflow | SE API v2.3 | [public-api.md](public-api.md) |
| Lobste.rs / V2EX / dev.to | Public JSON API | [json-api.md](json-api.md) |

### Media (CLI Tool Required)

| Platform | Method | Details |
|--------|------|------|
| 1,858 sites including YouTube/Vimeo/Twitch/TikTok/SoundCloud | `yt-dlp --dump-json` | [media.md](media.md) |

### Academic/Registries

| Platform | Method | Details |
|--------|------|------|
| arXiv | Atom API | [public-api.md](public-api.md) |
| CrossRef | REST API | [public-api.md](public-api.md) |
| Wikipedia | REST API | [json-api.md](json-api.md) |
| OpenLibrary | JSON API | [public-api.md](public-api.md) |
| GitHub | gh CLI / REST API | [public-api.md](public-api.md) |
| npm / PyPI | Registry API | [json-api.md](json-api.md) |
| Wayback Machine | CDX API | [public-api.md](public-api.md) |

### Korea-Specific Official APIs

| Platform | Method | Details |
|--------|------|------|
| Naver Search | `search.naver.com` (integrated/blog/news tabs) | [naver.md](naver.md) |
| Naver Finance quotes | `api.finance.naver.com/siseJson.naver` (unofficial JSON) | [naver.md](naver.md) |

**Phase 1 (generic fetch chain) automatically handles all other sites.**

## Phase 1 — Generic Fetch Chain

### Single Entrypoint

```python
from insane_search.engine import fetch

result = fetch(
    "https://example.com/path",
    success_selectors=["article", "[class*='product-card']"],  # Positive proof (optional)
    device_class="auto",      # "auto" | "desktop" | "mobile"
    user_hint=None,           # {"referer_strategy": "self_root", "impersonate_first": "safari"}
    timeout=25,
)

if result.ok:
    print(result.verdict)     # strong_ok | weak_ok
    html = result.content     # Raw body, or structured text when content-rescue activates
    # v0.10.0 content-rescue: PDF responses become pypdf-extracted text; SPA shells
    # with sparse visible text may be replaced by JSON-LD articleBody / rendered innerText.
    # Check result.extraction_source: "raw" (unchanged original) | pdf | json_ld | *+inner_text.
    # Successful ordinary HTML is always raw. Disable: enable_extraction=False / --no-extract.
    # 429/502/503/504 trigger backoff retries during probing (honoring Retry-After, capped at 10 seconds total);
    # disable: enable_retry=False / --no-retry.
else:
    # Phase 3 manual intervention (Playwright MCP) needed — diagnose using result.trace
    pass
```

### Internal Stages (Exposed for Debugging)

`fetch()` is a single API, but it is divided into internal phases. Inspect each attempt in `result.trace`.

```
probe      — first attempt with curl_cffi + safari + self-referer
validate   — four-layer validation (marker / size / cookie / success_selectors)
detect     — identify WAF products (ranked [(profile_id, confidence)])
plan       — build the profile's tls_candidates × url_transforms × referer grid
execute    — try the full grid (do not stop at the first 200)
fallback   — capability-tag-based Playwright routing (MCP or local+chrome)
report     — FetchResult(ok, verdict, profile_used, trace, summary)
```

### Validation Principles

- HTTP 200 is the **starting condition for validation**, not success.
- `validate()` checks challenge markers, surrogate dead ends, known bad sizes, caller-supplied selectors and cookie state. Treat the actual verdict/reasons as the result; these checks are not a uniform all-four-layers AND.
- A matching success selector can establish `strong_ok` even for a small body, after the negative checks; an unresolved `_abck` demotes it to `weak_ok`. Without selectors, acceptable heuristic content is only `weak_ok`.
- A missing requested selector is a challenge; an unavailable selector parser is UNKNOWN. Preserve these distinctions and examine actual requested content before concluding the task succeeded.
- Local browser HTML does not carry response cookies/status through the shim. It cannot by itself prove authenticated session acceptance; obtain that observation from the browser when the task requires it.

### Grid Axes (Profiles Recommend Priority; Attempts Are Budgeted)

| Axis | Values | Notes |
|----|-----|------|
| `url_transforms` | `original`, `mobile_subdomain` (`www.→m.`), `am_prefix`, `drop_www` | Rules only, no site names |
| `tls_impersonate` | `safari`, `safari_ios`, `chrome99`, `chrome119`, `chrome131`, `chrome_android`, `firefox`... | Profiles have their own avoid lists |
| `referer_strategy` | `self_root`, `google_search`, `none` | |

**device_class**:
- `"auto"` (default) — follow the profile strategy
- `"desktop"` — desktop TLS only + disable `mobile_subdomain`
- `"mobile"` — mobile TLS only + enable `mobile_subdomain`

### Playwright Fallback (Capability-Matched)

`engine/executor.py` reads the profile's `capabilities_needed` and selects an executor requirement. Host-browser branches return an unresolved handoff; they do not dispatch a tool:

| Tags | Runner | When |
|------|--------|------|
| `needs_real_tls_stack` + `needs_js_exec` | `playwright_real_chrome.js` (local Node) | Akamai Bot Manager, etc. — bundled Chromium TLS is detected |
| `needs_js_exec` only | Host-browser handoff (`playwright_mcp` identifier) | Basic Cloudflare defenses, etc. |
| `needs_mobile_context` (+ real_tls) | `playwright_mobile_chrome.js` | Mobile device emulation required |

Detailed selection criteria: [playwright.md](playwright.md).

### Host-browser handoff

An attempt whose executor is `playwright_mcp` or `playwright_mcp_mobile` remains UNKNOWN with no HTML. The calling agent uses the actual available browser tools, carrying URL, device and success-selector context. These executor identifiers are not literal host tool names. Follow [playwright.md](playwright.md) and [browser-session.md](../browser-session.md); do not install a server or call a foreign host's CLI because this branch was selected.

## Phase 2 — Manual Intervention (Optional)

If Phase 1 returns `ok=False`, retry with user hints:

```python
result = fetch(
    url,
    success_selectors=[...],
    user_hint={"impersonate_first": "safari_ios", "referer_strategy": "none"},
)
```

Hints apply **only to the current call** and are not persisted.

## Dependency check and authorized setup

Check existing dependencies before invoking the specialist engine:

```bash
python3 -c "import curl_cffi, bs4, yaml"
```

A failed check means prerequisites are missing; it does not run an installer.
If setup is within the task scope, install `curl_cffi`, `beautifulsoup4` and
`pyyaml` in the approved Python environment. Otherwise use an already available
reader/browser when it can establish the same requested evidence, or report the
engine path unavailable. Local Playwright prerequisites and module resolution
are described in [playwright.md](playwright.md); a missing local Chrome is
separate from the availability of a runtime browser integration.

## Quick Reference — Phase 0 Commands

```bash
# General web (Jina Reader — ordinary HTML only, ineffective on WAF-protected sites)
curl -s "https://r.jina.ai/{URL}"

# yt-dlp — media metadata for 1,858 sites
yt-dlp --dump-json "URL"

# Reddit
curl -sL -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" \
  "https://www.reddit.com/r/{sub}/hot.json?limit=10"

# X/Twitter timeline
curl -sL "https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}"

# Hacker News
curl -sL "https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=10&orderBy=%22%24key%22"

# YouTube subtitles
yt-dlp --write-sub --write-auto-sub --sub-lang "en,ko" --skip-download -o "/tmp/%(id)s" "URL"
```

## No-Site-Name Rule

Do **not hardcode specific site domains/URLs/selectors/brand names** in `engine/**`, `waf_profiles.yaml`, or `engine/templates/**`.

### Prohibited

- Site-specific registry entries such as `"coupang.com": {...}`
- Domain branches such as `if "coupang" in url: ...`
- Embedding specific site names or empirically observed byte sizes in WAF profile `notes`

### Allowed

- Site-name examples in **explanatory prose** in `SKILL.md` / `references/*.md` (to help readers)
- The `Phase 0` official API index (endpoints officially published by platforms)
- `observations/*.jsonl` logs (append-only observations — no effect on code paths)
- Caller-provided `success_selectors` and `user_hint` (valid only for the current call)

### Borderline Cases

> "Would this entry generally apply to another site using the same WAF?" → YES: `waf_profiles.yaml`; NO: runtime hint.

### When a New Site Cannot Be Accessed

1. First check `result.trace` to identify the failing phase
2. Retry once with the user's `user_hint`
3. If a repeated success pattern emerges, log it in `observations/` (not yet automatic — manual recording)
4. After 3+ repeated confirmations, if it **also applies to other sites using the same WAF**, tune `tls_impersonate_candidates` / `url_transform_order` for that profile in `waf_profiles.yaml` (never include site names)
5. If it still fails, consider a new WAF profile candidate (e.g., more granular DataDome profiles, Kasada)

## Related Documents (references/) — What to Read When

This section is a **reference selection guide**. Use it to decide which `references/*.md` file to open when a problem arises. Claude should `Read` only the relevant file when needed, not all files in advance.

### A. Engine Extensions and Diagnostics (Harness Internals)

| File | When to read | Coverage |
|------|-------------|-----------------|
| [`tls-impersonate.md`](tls-impersonate.md) | When the entire curl_cffi grid ends in `challenge`/`blocked`, or when adding a new impersonation target to `waf_profiles.yaml` | Replicating Safari/Chrome/Firefox TLS (JA3/JA4) fingerprints with curl_cffi, optimal target combinations by WAF (Akamai/Cloudflare/F5, etc.), impersonation target version list, empirical basis for `tls_impersonate_avoid` |
| [`playwright.md`](playwright.md) | When the engine enters Playwright fallback and you need to check whether it should use MCP or Local Chrome | Host-browser handoff versus local real-Chrome execution, capability checks, template parameters, validation and owned profiles |
| [`fallback.md`](fallback.md) | When the `verdict` is ambiguous or you need to decide when to move between phases | Engine Phase 0→1→2→3 escalation principles, detailed response success/failure criteria, exit conditions for each phase |
| [`metadata.md`](metadata.md) | When the full body is unavailable but essentials such as title, summary, price, or author are still needed | OGP meta tags, JSON-LD (Schema.org), Twitter Card parsing, structured-data extraction patterns |

### B. Lightweight Alternatives (When Another Tool Is Better Than the Engine)

| File | When to read | Coverage |
|------|-------------|-----------------|
| [`jina.md`](jina.md) | When clean Markdown is needed from ordinary web pages without WAFs (blogs/news/wikis) | Puppeteer-based JS SPA rendering and Markdown conversion with one `r.jina.ai/URL` line, free 500 RPM, no API key required |
| [`cache-archive.md`](cache-archive.md) | When the original site is blocked but a historical snapshot would suffice | Wayback Machine CDX API, archive.today, AMP Cache (Google Cache ended in 2024-07) |
| [`rss.md`](rss.md) | When structured time-series updates from news/blogs/communities are needed | RSS/Atom autodiscovery, feed parsing, no authentication required — the cleanest time-series data source |

### C. Platform-Specific Official/Public APIs (Linked to the Phase 0 Index)

| File | When to read | Coverage |
|------|-------------|-----------------|
| [`json-api.md`](json-api.md) | Sites such as Reddit/Wikipedia/HN/npm/PyPI that return JSON through **URL transformation alone** | Reddit `/json` suffix + Mobile UA, HN Firebase, Algolia Search, Wikipedia REST, npm/PyPI Registry API |
| [`public-api.md`](public-api.md) | When using official APIs from Bluesky/Mastodon/arXiv/Stack Overflow/CrossRef/GitHub/OpenLibrary/Wayback | Official public REST/AT/Atom API endpoints without authentication, request formats, common parameters |
| [`twitter.md`](twitter.md) | X/Twitter access — profile timelines, individual tweets, keyword search | `syndication.twitter.com` timelines, oEmbed for individual tweets, web search tools to obtain URLs before oEmbed |
| [`naver.md`](naver.md) | Naver blogs, news, securities, and search | Service-specific bypasses (convert blogs to `m.blog.naver.com`, unofficial JSON for securities, `search.naver.com` for search), Korean search-query patterns |
| [`media.md`](media.md) | When media metadata, subtitles, or audio are needed from YouTube/Vimeo/Twitch/TikTok/SoundCloud, etc. | `yt-dlp --dump-json` coverage of 1,858 sites, subtitle downloads (`--write-sub`), format selection, live streams/podcasts |

### D. When to Read Engine Code Directly

| File | When to read |
|------|-------------|
| `engine/fetch_chain.py` | Chain-stage logic and `Attempt`/`FetchResult` schemas |
| `engine/validators.py` | Four-layer validation details (Verdict classification, challenge-marker list) |
| `engine/waf_detector.py` | Ranked WAF detection algorithm and `_LAST_LOAD_ERROR` handling |
| `engine/waf_profiles.yaml` | Per-profile detectors, tls_candidates, capabilities_needed |
| `engine/url_transforms.py` | When adding URL transformation rules |
| `engine/executor.py` | Playwright MCP vs local capability-matching logic |
| `engine/templates/*.js` | Playwright template tuning (warmup, reload, devices) |
| `engine/bias_check.py` | Bias-linter rules — brand denylist, URL_PATTERN, excluded dirs |
