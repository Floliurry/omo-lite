# TLS Impersonation — curl_cffi

> A core method for bypassing WAFs that use TLS fingerprints (JA3/JA4).
> Ordinary curl/requests use OpenSSL fingerprints and are blocked immediately,
> whereas curl_cffi replicates real browser (Chrome/Safari/Firefox) TLS fingerprints.

## Dependency

```bash
python3 -c "import curl_cffi"
```

If the check fails, this route is unavailable until setup is authorized. Install
`curl_cffi` only in the approved Python environment; otherwise use an available
reader or browser that can establish the requested evidence, or report the
missing prerequisite.

## Try Multiple Targets in Sequence

If one impersonation target fails, retry with another.
**Attempt order: safari → chrome → firefox**

```python
from curl_cffi import requests

TARGETS = ["safari", "chrome", "firefox"]
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.com/",
}

def cffi_fetch(url, locale="ko-KR"):
    """Try multiple targets in sequence with identity spoofing. Return (response, target) on success."""
    from urllib.parse import urlparse
    origin = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    for target in TARGETS:
        try:
            session = requests.Session(impersonate=target)
            session.headers.update(HEADERS)
            session.headers["Accept-Language"] = f"{locale},{locale.split('-')[0]};q=0.9"
            session.headers["Referer"] = "https://www.google.com/"
            # Identity spoofing: warm up homepage cookies → Referer chain
            try:
                session.get(origin, timeout=10)
            except Exception:
                pass  # Try the main request even if the homepage fails
            session.headers["Referer"] = origin
            resp = session.get(url, timeout=20)
            # Detect sites requiring JS → other targets will not help
            if "behavioral-content" in resp.text or "sec-if-cpt" in resp.text:
                return None, None  # → Phase 3 Playwright
            if resp.status_code == 200 and len(resp.text) > 500:
                return resp, target
        except Exception:
            continue
    return None, None
```

## Impersonation Targets (v0.15.0)

Generic aliases always resolve to the latest version. **In 2026, WAFs consider old versions such as chrome99 suspicious, so generic aliases are recommended.**

| Alias | Resolves to (2026.04) | Use |
|-------|---------------|------|
| `safari` | safari260 | **Best for Korean sites** (Coupang, FM Korea) |
| `chrome` | chrome146 | General purpose (Cloudflare, Akamai) |
| `firefox` | firefox135 | Alternative when chrome/safari fail |
| `chrome_android` | chrome131_android | Mobile API endpoints |
| `safari_ios` | safari260_ios | iOS mobile |

<details>
<summary>All pinned versions (click)</summary>

```
chrome99, chrome100, chrome101, chrome104, chrome107, chrome110,
chrome116, chrome119, chrome120, chrome123, chrome124, chrome131,
chrome133a, chrome136, chrome142, chrome145, chrome146,
chrome131_android, edge99, edge101,
safari15_3, safari15_5, safari17_0, safari17_2_ios,
safari18_0, safari18_0_ios, safari260, safari260_ios,
firefox133, firefox135
```

</details>

## Best Strategy by WAF

| WAF | Best target | Additional conditions | Success rate |
|-----|-----------|-----------|--------|
| F5 BIG-IP (Coupang) | `safari` | `Referer: https://www.coupang.com/` | ~70% |
| Cloudflare (TLS only) | `chrome` | Add Sec-Fetch-* headers | ~80% |
| Akamai | `chrome` | Use a residential proxy alongside it | 80-90% |
| AWS WAF | `chrome` | — | ~80% |
| CloudFront (YOZM IT) | Not needed | Ordinary curl + Chrome UA is sufficient | 100% |

## Sessions and Cookies

```python
from curl_cffi import requests

# Maintain a session (automatic cookie management)
session = requests.Session(impersonate="safari")

# Acquire session cookies with the first request
session.get("https://www.coupang.com/")

# Cookies are sent automatically on subsequent requests
resp = session.get("https://www.coupang.com/np/search?q=키보드")
```

## Combination: nodriver/FlareSolverr → curl_cffi

For sites with JS challenges, acquire cookies through a browser, then use curl_cffi for fast processing:

```python
# 1. Acquire the cf_clearance cookie with nodriver
import nodriver as uc
browser = await uc.start(headless=True)
page = await browser.get("https://cf-protected-site.com")
await page.cf_verify()
cookies = await browser.cookies.get_all()

# 2. Pass cookies to a curl_cffi Session
from curl_cffi import requests
session = requests.Session(impersonate="chrome")
for c in cookies:
    session.cookies.set(c["name"], c["value"])
resp = session.get("https://cf-protected-site.com/api/data")
```

## Asynchronous Usage (async)

```python
import asyncio
from curl_cffi.requests import AsyncSession

async def fetch_many(urls):
    async with AsyncSession(impersonate="chrome") as session:
        tasks = [session.get(url) for url in urls]
        return await asyncio.gather(*tasks)
```

## HTTP/3 (v0.15.0+)

```python
from curl_cffi import requests
from curl_cffi.const import CurlHttpVersion

resp = requests.get(
    "https://www.cloudflare.com/",
    impersonate="chrome",
    http_version=CurlHttpVersion.V3,
)
```

WAF vendors do not yet actively use HTTP/3 fingerprints, making this an effective bypass.

## Alternative Libraries

Alternatives when curl_cffi fails:

| Library | Installation | Features |
|-----------|------|------|
| primp | `pip install primp` | Rust-based, up to Firefox 148, high performance |
| wreq/rnet | `pip install wreq` | Rust-based, 100+ device profiles |
| tls-client2 | `pip install tls-client2` | Go-based fork, synchronous only |

```python
# primp example
import primp
client = primp.Client(impersonate="chrome_146")
resp = client.get("https://example.com")
```

## What curl_cffi Cannot Bypass

| Defense | curl_cffi | Response |
|-----------|-----------|------|
| TLS/JA3 fingerprint | Can bypass | Core feature |
| HTTP/2 SETTINGS fingerprint | Can bypass | Included in impersonate |
| HTTP/3 QUIC fingerprint | Can bypass (v0.15+) | New |
| JS challenges (Turnstile, etc.) | **Cannot bypass** | → nodriver or Playwright |
| CAPTCHA | **Cannot bypass** | → 2captcha/CapSolver |
| IP reputation (datacenter) | **Cannot bypass** | → proxy/VPN |
| Behavioral analysis (mouse/timing) | **Cannot bypass** | → real browser |

For sites with JS challenges → hand off to [playwright.md](playwright.md).
