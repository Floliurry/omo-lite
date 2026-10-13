# Cache & Archives (Surrogate Routes)

> Access a cached or archived **copy** when the original site is blocked.
> Ordered by probes conducted on 2026-08-09. These routes are short-lived; this file
> should also be revalidated every 90 days. (That day, four of six previously expected routes were dead or returned stubs.)

## Dependencies

None beyond curl. These are manual routes; engine Phase 2.5 (`engine/surrogates.yaml`) handles automation.

## Automatic Engine Fallback (Phase 2.5)

`fallback_when_challenge` in `waf_profiles.yaml` prioritizes `surrogate_wayback`,
so archive routes are tried after grid failure and before launching a browser.
On success, the result contains `FetchResult.provenance = "snapshot"`,
`snapshot_timestamp` set to the archive timestamp, and `trust = "archive"`.
**This is a copy: always cite it with its date.** Entries with `kind: proxy`
never run without `--allow-proxy`; Cookie/Authorization headers are not sent
to proxies, which act as intermediaries by design.

## 1. Wayback Machine (Internet Archive) — First Choice

**2026-08-09 probe: working.** The `available` API returns HTTP 200 JSON with
a snapshot URL and timestamp, making it the best primitive for establishing provenance.

```bash
# Snapshot availability and latest snapshot URL/timestamp (use this entrypoint)
curl -sL "https://archive.org/wayback/available?url={URL}"

# Open archived_snapshots.closest.url from the returned JSON
curl -sL "https://web.archive.org/web/{timestamp}/{URL}"
```

> **CDX API caveat:** `web.archive.org/cdx/search/cdx`, recommended in earlier
> versions, returned 503 in the 2026-08 probe. Use only `available` unless snapshot enumeration is needed.

**Works for:** public URLs that were crawled.
**Fails for:** sites blocked by robots.txt, URLs without snapshots, and SPA snapshots without rendering.

## 2. archive.today — Second Choice

User-submitted archives, particularly useful for paywalled articles and deleted content.
**2026-08 probe: frequent 429 rate limits and rotating domains** (archive.ph → archive.md observed).
When one is blocked, try the other domains, matching the engine's `host_rotation` pattern.

```bash
# Find the latest snapshot; domain rotation is part of the normal route, not exception handling
for domain in archive.ph archive.md archive.li archive.is; do
  resp=$(curl -sL -o /dev/null -w "%{http_code}" "https://$domain/newest/{URL}")
  if [ "$resp" = "200" ] || [ "$resp" = "302" ]; then
    echo "Success: https://$domain/newest/{URL}"
    curl -sL "https://$domain/newest/{URL}"
    break
  fi
done
```

**Caution:** a 429 response can include several KB of content; validate the body rather than relying on the status code.

## 3. AMP Cache — Demoted (Effectively Unusable)

Previously the first choice, but **effectively unusable in the 2026-08 probe**:
`{host}.cdn.ampproject.org/c/s/...` returns HTTP 200, but the body is a
**322-byte `<TITLE>Redirecting</TITLE>` meta-refresh** pointing back to the
**original blocked page**. Treating it as success creates a loop back to that page.

The engine classifies this pattern as CHALLENGE through
`engine/validators.py:is_redirect_stub`: under 3 KB, a meta-refresh/JS redirect,
and the target host appearing again. Manual use is not recommended either.

## 4. Google Cache — Confirmed Discontinued

Even after its **July 2024 shutdown**, `webcache.googleusercontent.com` returns
HTTP 200 with tens of KB of content. It is actually a `<title>Google Search</title>`
interstitial with a JS redirect, reconfirmed in the 2026-08 probe.
**It is the search homepage, not a cache.** The engine identifies it through
`INTERSTITIAL_TITLE_MARKERS` and excludes it from successful results.

## Attempt Order (Based on Probes)

```
1. Wayback available API → snapshot URL and timestamp, including provenance
2. archive.today domain rotation (account for 429; body validation required)
3. AMP cache: do not try (redirect stub points back to the original)
4. Google Cache: do not try (discontinued; returns a search interstitial)
```
