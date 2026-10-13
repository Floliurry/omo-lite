# Access Failures — Adaptive Scheduler

> Run this when an indexed method fails or the site is not in the index.
> Escalate through Phase 0 → 1 → 2 → 3. Stop immediately when a phase succeeds.

## Principles

1. **Do not rule out any method in advance** — try it to find out whether it works
2. **Install missing dependencies and try** — do not skip a method because it is not installed
3. **Use signals to move between phases** — escalate according to the failure type
4. **Result selection priorities**: accuracy/confidence > freshness > completeness > structure > cost

---

## Phase 0: Specialized Endpoints (Index Matching)

If the site appears in the index, try its dedicated method **first**.
It takes priority over generic Phase 1 because it offers the best accuracy and cost.

Success → stop / failure → Phase 1

---

## Phase 1: Lightweight Probes (Parallel)

**Try first** (concurrently):
- WebFetch (built into Claude)
- Jina Reader (default / JSON / SPA mode)
- curl with a Chrome Desktop UA

**If none succeeds, also try**:
- curl with a mobile UA + mobile URL (`m.{domain}`)
- curl with a Googlebot UA
- URL variants: `.json`, `/rss`, `/feed`

**Sidecars** (alongside the first batch, low-trust):
- Google AMP Cache
- archive.today
- Wayback Machine
→ **If any original-source method succeeds, use sidecars only as references.** Adopt sidecar results only if all original-source methods fail (provenance tagging required)

**Also extract metadata from every response**: OGP, JSON-LD — see [metadata.md](metadata.md)

Details: [jina.md](jina.md), [cache-archive.md](cache-archive.md), [rss.md](rss.md)

---

## Escalation Signals

Conditions for moving from Phase 1 → Phase 2:

| Signal | Detection | Meaning |
|------|-----------|------|
| HTTP 403/430 | Status code | WAF/bot blocking |
| HTTP 429/503 | Status code | Rate limit (first retry briefly with jitter; escalate if that fails) |
| WAF headers | `cf-ray`, `server: cloudflare`, `x-datadome` | Cloudflare/Akamai/DataDome |
| WAF cookies | `__cf_bm`, `_abck`, `datadome` | WAF session |
| Challenge body | `captcha`, `verify`, `enable javascript`, `check your browser` | JS challenge |
| Empty SPA | No content beyond `<div id="root"></div>`, fewer than 200 characters | JS rendering required |
| Redirect loop | Three or more 302/307 responses | Challenge redirects |

**When login/paywall is detected**: a concentration of `login`, `sign in`, `로그인`, `subscribe`, `구독` → escalating to Phase 2/3 will not resolve it. **Stop with "authentication required".**

---

## Phase 2: TLS Impersonation (curl_cffi)

**Condition**: Phase 1 detected WAF/bot-blocking signals

**Ensure the dependency is available**:
```bash
python3 -c "import curl_cffi" 2>/dev/null || pip install curl_cffi -q
```
If installation fails → go directly to Phase 3.

**Try multiple targets in sequence**: safari → chrome → firefox

```python
from curl_cffi import requests

TARGETS = ["safari", "chrome", "firefox"]
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    "Referer": "https://www.google.com/",
}

for target in TARGETS:
    try:
        session = requests.Session(impersonate=target)
        session.headers.update(HEADERS)
        resp = session.get("{URL}", timeout=20)
        if resp.status_code == 200 and len(resp.text) > 300:
            # Success — also extract JSON-LD
            break
    except:
        continue
```

Success → stop / failure or JS challenge → Phase 3

Details: [tls-impersonate.md](tls-impersonate.md)

---

## Phase 3: Playwright MCP (Browser)

**Condition**: Phase 2 also failed, or a JS challenge/CAPTCHA was detected

```
browser_navigate → {URL}
browser_wait_for → "body" (3 seconds)
browser_evaluate → () => document.body.innerText  (Light Mode — try first)
If needed, browser_snapshot → full accessibility tree
```

**API discovery**: if `browser_network_requests` reveals a hidden JSON API, it can be reused through curl_cffi.

Details: [playwright.md](playwright.md)

---

## Response Validation

| Verdict | Condition | Result |
|------|------|------|
| **Success** | Enough content for its type + topic-relevant keywords | Adopt |
| **Partial success** | Only OG metadata/JSON-LD (no body) | Supporting source |
| **Failure — authentication** | Login/paywall detected | Stop with "authentication required" |
| **Failure — challenge** | CAPTCHA/JS challenge | Next phase |
| **Failure — error** | 4xx/5xx | Next phase |
| **Failure — empty SPA** | No content | Next phase |

**Content length guidelines** (apply flexibly):
- Article/blog: at least 500 characters
- Product page: JSON-LD is sufficient for success
- Tweet/short post: at least 100 characters
- Profile: JSON-LD Person is sufficient for success

## False-Positive Markers (HTTP 200 but Failure)

| Pattern | Detection | Handling |
|------|----------|------|
| X SPA shell (247KB) | 200 OK + `Sign in to X` or `hasResults: false` | Failure — web search tool + oEmbed fallback |
| CAPTCHA page | 200 OK + `captcha\|recaptcha\|hcaptcha\|cf-turnstile` | Failure — next phase |
| Soft paywall | 200 OK + `member-only\|subscribe to read\|구독하세요` | Partial success — adopt metadata only |
| DDG soft limit | 202 Accepted + body under 15KB | Failure — fall back to another engine |
| Empty JSON | 200 OK + `hasResults.*false\|"entries":\s*\[\]` | Failure — try another method |
| Regional restriction | 200 OK + `not available in your region\|geo-restricted` | Failure — report "region restricted" |
| WAF soft block | 200 OK + `checking your browser\|verify you are human` | Failure — escalate to Phase 2/3 |
| Akamai behavioral | 200 OK + `behavioral-content\|sec-if-cpt` + `_abck` cookie | Failure — JS execution required → go directly to Phase 3 (changing TLS targets is ineffective) |
| RSS Content-Type mismatch | RSS expected + `text/html` response | Failure — "RSS unsupported" |
| Error JSON | 200 OK + JSON `"error"` key present | Failure — log the error details |

## If Everything Fails

1. Record the phases attempted and each failure signal
2. If sidecar results exist, adopt them with provenance tags
3. If no sidecar results exist either, report the failure and attempted results to the user
