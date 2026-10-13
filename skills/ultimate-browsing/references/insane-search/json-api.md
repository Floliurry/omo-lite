# Direct JSON API Calls

> Retrieve structured JSON directly through URL variants or public endpoints.
> No authentication required; faster and more precise structured retrieval than Jina Reader.

## Reddit

**A mobile User-Agent is required**; without it, requests return 403/429.

```bash
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"

# Hot subreddit posts
curl -sL -H "User-Agent: $UA" "https://www.reddit.com/r/{subreddit}/hot.json?limit=10"

# Search
curl -sL -H "User-Agent: $UA" "https://www.reddit.com/r/{subreddit}/search.json?q={query}&restrict_sr=1"

# Post and comments
curl -sL -H "User-Agent: $UA" "https://www.reddit.com/r/{subreddit}/comments/{post_id}/{slug}/.json"

# Sort options: hot.json / new.json / top.json?t=week
```

Data: `title`, `author`, `score`, `selftext` (full text), `num_comments`, `created_utc`.
Comments: a recursive tree in response array `[1]`.

## Hacker News (Firebase API)

Effectively no rate limit.

```bash
# Top story IDs
curl -sL "https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=10&orderBy=%22%24key%22"

# Individual item
curl -sL "https://hacker-news.firebaseio.com/v0/item/{id}.json"

# Variants: beststories / newstories / askstories / showstories
```

Data: `title`, `url`, `score`, `by` (author), `descendants` (comment count), `kids` (comment IDs).

Batch retrieval:
```bash
python3 -c "
import urllib.request, json
ids = json.load(urllib.request.urlopen('https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=5&orderBy=\"\$key\"'))
for id in ids:
    item = json.load(urllib.request.urlopen(f'https://hacker-news.firebaseio.com/v0/item/{id}.json'))
    print(f'[{item.get(\"score\",0)}] {item.get(\"title\")}')
    print(f'  {item.get(\"url\",\"N/A\")[:60]}')
"
```

## Lobste.rs

No rate limit. Smaller than HN, with high-quality curation.

```bash
# Hot stories
curl -sL "https://lobste.rs/hottest.json"

# By tag (ai, programming, web, security, etc.)
curl -sL "https://lobste.rs/t/ai.json"

# Latest
curl -sL "https://lobste.rs/newest.json"

# Individual story and comments
curl -sL "https://lobste.rs/s/{short_id}.json"
```

Data: `title`, `url`, `score`, `comment_count`, `tags`, `submitter_user`

## dev.to

```bash
# Latest by tag
curl -sL "https://dev.to/api/articles?tag=ai&per_page=5"

# Top this week
curl -sL "https://dev.to/api/articles?top=7&per_page=5"

# Specific user
curl -sL "https://dev.to/api/articles?username={user}&per_page=5"
```

Data: `title`, `user.name`, `public_reactions_count`, `reading_time_minutes`, `tags`

## npm Registry

```bash
# Latest package version
curl -sL "https://registry.npmjs.org/{package}/latest"

# Package search
curl -sL "https://registry.npmjs.org/-/v1/search?text={query}&size=5"

# Download statistics
curl -sL "https://api.npmjs.org/downloads/range/last-month/{package}"
```

## PyPI

```bash
# Package information
curl -sL "https://pypi.org/pypi/{package}/json"

# Download statistics
curl -sL "https://pypistats.org/api/packages/{package}/recent"
```

## Wikipedia

```bash
# Page summary
curl -sL "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
# Korean: https://ko.wikipedia.org/api/rest_v1/page/summary/{title}

# Search
curl -sL "https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=5&format=json"
```

## V2EX

```bash
curl -sL "https://www.v2ex.com/api/topics/hot.json" -H "User-Agent: insane-search/1.0"
```

## RSS Feeds

→ See [rss.md](rss.md) for detailed guidance on Korean news RSS, Google News RSS, and feedparser.
