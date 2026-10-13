# General Web Extraction — Jina Reader

> Convert nearly any public URL to Markdown with `r.jina.ai/URL`.
> Real browser rendering through Puppeteer also handles JavaScript SPAs.
>
> The official Reader documentation supports anonymous access, subject to its
> provider limits. This engine's configured `jina_reader` fallback remains
> key-gated; when `JINA_API_KEY` is present, it sends the value only to the
> registered Reader endpoint as `Authorization: Bearer <key>` and omits it from
> traces. The route remains a live server-side rendering path. Do not infer a
> universal response status from a local failure or a mocked probe.

## Basic Usage

```bash
curl -s "https://r.jina.ai/{URL}"
# When using configured authentication:
curl -s -H "Authorization: Bearer ${JINA_API_KEY}" "https://r.jina.ai/{URL}"
```

## Advanced Features

### Structured JSON Output

```bash
curl -H "Accept: application/json" "https://r.jina.ai/{URL}"
```

Returns: `data.{title, description, url, content, metadata, external, usage}`

**Key feature:** `external.alternate` can **automatically discover a site's RSS URL**.

### CSS Selector Targeting

```bash
curl -H "X-Target-Selector: .article-body" "https://r.jina.ai/{URL}"
```

Remove navigation and footers to extract only the main content. Particularly useful for community forums.

### SPA Streaming Mode

```bash
curl -H "Accept: text/event-stream" "https://r.jina.ai/{URL}"
```

Wait for JavaScript to finish loading and return the final, fully rendered dynamic content.

### Screenshots

```bash
curl -H "X-Respond-With: screenshot" "https://r.jina.ai/{URL}"
```

Returns a signed GCS URL valid for four hours, for visual verification.

### PDF Processing

```bash
curl -s "https://r.jina.ai/https://example.com/file.pdf"
```

Automatically converts PDF to Markdown, including page-count metadata.

### Forwarding Cookies (Authenticated Sites)

This sends the named session cookie to the remote Reader service. Use it only
for the necessary authorized account and domain, following the session-transfer
boundary in [browser-session.md](../browser-session.md); the engine does not
forward browser cookies automatically.

```bash
curl -H "X-Set-Cookie: session=abc123" "https://r.jina.ai/{URL}"
```

### Preserving Links

```bash
curl -H "X-With-Links: true" "https://r.jina.ai/{URL}"
```

### Cache Control

```bash
# Bypass the cache when live content is needed
curl -H "X-No-Cache: true" "https://r.jina.ai/{URL}"

# Set cache TTL in seconds
curl -H "X-Cache-Tolerance: 600" "https://r.jina.ai/{URL}"
```

### Plain Text / Original HTML

```bash
# Only body.innerText
curl -H "X-Respond-With: text" "https://r.jina.ai/{URL}"

# Original HTML
curl -H "X-Respond-With: html" "https://r.jina.ai/{URL}"
```

## Sites with Recorded Success

| Site | Result | Notes |
|--------|------|------|
| Threads | Success | Profiles and posts |
| Clien | Success | Post lists and content |
| Ruliweb | Success | Post lists and content |
| Ppomppu | Success | Posts; RSS also available |
| Naver News | Success | Article lists and complete content |
| Naver Finance | Success | Live stock prices |
| GeekNews | Success | Topic lists and content |
| 44bits | Success | Article lists |
| Careerly | Success | Extraction through JS rendering |
| Brunch | Success | Full articles |
| Hankyung | Success | News articles |
| Daum News | Success | News articles |
| Medium | Success | Full articles, excluding paywalls |
| Substack | Success | Full newsletters |
| dev.to | Success | Full articles |
| PDF (any URL) | Success | Automatic conversion |

## Sites with Recorded Failures

| Site | Reason |
|--------|------|
| X/Twitter | 402: use Syndication/oEmbed (see twitter.md) |
| Reddit | Blocked: use the JSON API (see json-api.md) |
| DC Inside | Empty body returned |
| FM Korea | HTTP 430 |
| YojeumIT | CloudFront 403 |
| Naver Shopping | CAPTCHA |
| Coupang | WAF blocked |


## Automatic RSS Discovery

Jina JSON mode automatically exposes a site's RSS URL in `external.alternate`:

```bash
curl -H "Accept: application/json" "https://r.jina.ai/{URL}" | \
python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('external',{}))"
```
