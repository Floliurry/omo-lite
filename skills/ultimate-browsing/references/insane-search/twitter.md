# X/Twitter Access Strategies

> WebFetch is blocked with 402. Use the methods below instead; none requires an API key or authentication.

## Search (Discover Tweets)

```python
<available web search tool>(query="site:x.com {검색어}")  # Claude Code: WebSearch; OpenCode variants: websearch_web_search_exa, etc. Tool names vary by harness; check the current session's tool list.
```

Web search tools return X posts in search results. They provide titles, snippets, and URLs, but not full tweet text or engagement counts.

## Retrieve Timelines — Syndication API

Provides approximately the latest 100 tweets for a handle, including engagement counts such as likes and retweets.

### Endpoint

```
https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}
```

### One-Shot Script

```bash
curl -sL "https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}" | \
python3 -c "
import sys, json, re, html
content = sys.stdin.read()
match = re.search(r'__NEXT_DATA__.*?>(.*?)</script>', content)
if match:
    data = json.loads(match.group(1))
    for e in data['props']['pageProps']['timeline']['entries']:
        if e['type'] == 'tweet':
            t = e['content']['tweet']
            print(f\"@{t['user']['screen_name']} ({t.get('created_at','?')})\")
            print(f\"  {html.unescape(t.get('full_text',''))[:300]}\")
            print(f\"  Likes: {t.get('favorite_count',0)} | RTs: {t.get('retweet_count',0)}\")
            print('---')
"
```

### Available Data

| Field | Path | Example |
|------|------|------|
| Full tweet text | `tweet.full_text` | "Give your agent the..." |
| Author handle | `tweet.user.screen_name` | "openclaw" |
| Author name | `tweet.user.name` | "OpenClaw" |
| Like count | `tweet.favorite_count` | 1929 |
| Retweet count | `tweet.retweet_count` | 169 |
| Creation time | `tweet.created_at` | "Mon Apr 06 04:04:08 +0000 2026" |
| Tweet ID | `tweet.id_str` | "2041003999856406714" |
| Media URL | `tweet.entities.media[].media_url_https` | Image/video URL |

### Limitations

- Returns approximately the latest 100 tweets; no pagination.
- Private accounts are inaccessible.
- No search capability; timelines only.
- **New accounts or accounts with few followers:** may return `hasResults: false`. Individual tweets may still work through oEmbed; fall back to the combined pattern below.
- Unofficial endpoint; X may change or block it.

## Retrieve Individual Tweets — oEmbed API

Retrieve full text when the specific tweet URL is known.

### Endpoint

```
https://publish.twitter.com/oembed?url=https://x.com/{user}/status/{tweet_id}
```

### Usage

```bash
curl -sL "https://publish.twitter.com/oembed?url=https://x.com/{user}/status/{tweet_id}"
```

### Response (JSON)

| Field | Description |
|------|------|
| `author_name` | Author display name |
| `author_url` | Author profile URL |
| `html` | HTML blockquote containing the full tweet |
| `url` | Original tweet URL |

## Combined Pattern (Search → Details)

```
Step 1: web search tool(query="site:x.com {키워드}") → obtain tweet URLs
Step 2: curl oEmbed API → obtain full tweet text
```

## Methods That Fail (Do Not Use)

| Method | Result | Cause |
|------|------|------|
| WebFetch | 402 Payment Required | Claude Code WebFetch restriction |
| Nitter | Empty response | Most Nitter instances have shut down |
| Wayback Machine | OG meta tags only | SPA not rendered |
| Mobile UA curl | OG meta tags only | SPA not rendered |
| RSS | No endpoint | X discontinued RSS support |
