# Access Strategies for Naver Services

> Access methods vary by Naver service: mobile URLs for blogs, Jina Reader for news and finance.

## Naver Blog

WebFetch is blocked. Convert to a mobile URL and use an iPhone User-Agent.

```bash
# Convert blog.naver.com/{ID}/{NO} → m.blog.naver.com
curl -sL \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" \
  -H "Accept-Language: ko-KR,ko;q=0.9" \
  -H "Referer: https://m.naver.com/" \
  "https://m.blog.naver.com/PostView.naver?blogId={ID}&logNo={NO}"
```

RSS is also available: the latest 50 posts, with approximately 300 characters of content:
```bash
curl -sL "https://rss.blog.naver.com/{BLOG_ID}.xml"
```

## Naver News

Full access is available through Jina Reader.

```bash
# Article list
curl -s "https://r.jina.ai/https://news.naver.com/"

# Individual article
curl -s "https://r.jina.ai/https://n.news.naver.com/article/{press_id}/{article_id}"
```

## Naver Finance

Access live stock prices and major news through Jina Reader.

```bash
curl -s "https://r.jina.ai/https://finance.naver.com/item/main.naver?code={종목코드}"
```

## Naver Finance Quotes (Unofficial, No Authentication)

No authentication required. Returns stock-price time series as JSON.

```bash
# Daily quotes (Samsung Electronics=005930)
curl -sL "https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=1&startTime=20240101&endTime=20241231&timeframe=day"

# Minute bars
curl -sL "https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=0&timeframe=minute&count=200"
```

Response fields: date, open, high, low, close, volume, foreign-investor trading ratio.
The original Korean field labels are `[[날짜, 시가, 고가, 저가, 종가, 거래량, 외국인거래율], ...]`.

## Naver Search (Direct Access with Browser Impersonation)

Use curl_cffi with session-cookie warmup to crawl Naver search results directly. No API key required.

```python
from curl_cffi import requests
from urllib.parse import quote

s = requests.Session(impersonate="chrome124")
s.headers.update({
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://www.google.com/",
})
s.get("https://www.naver.com/", timeout=10)  # Cookie warmup
s.headers["Referer"] = "https://www.naver.com/"

# Integrated search (blogs, news, and web results)
r = s.get(f"https://search.naver.com/search.naver?query={quote('검색어')}")

# Blog tab
r = s.get(f"https://search.naver.com/search.naver?where=post&query={quote('검색어')}")

# News tab
r = s.get(f"https://search.naver.com/search.naver?where=news&query={quote('검색어')}")
```

### Available Data

| Tab | URL Pattern | Extracted Data |
|---|---|---|
| Integrated | `search.naver?query=` | Blog URLs, external links, news |
| Blog | `where=post&query=` | blog.naver.com URL, title, snippet |
| News | `where=news&query=` | n.news.naver.com URL, title |

### Primary Route for Korean Keyword Search

Web search tools can lag in indexing new Korean content, while Naver Search is optimized for Korean.
**For keyword searches on Korean sites, direct Naver Search access is the most accurate and fastest route.**

## Naver Cafe

Login and iframes create two barriers; direct access to the body is unavailable.
Try Phases 1–3 of the fallback chain, but stop with "authentication required" when login or a paywall is detected.

## Naver TV

Access through yt-dlp (see media.md).

```bash
yt-dlp --dump-json "https://tv.naver.com/v/{video_id}"
```
