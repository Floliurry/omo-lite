# Metadata Extraction — OGP / JSON-LD / Schema.org

> Supplementary techniques for extracting structured data from retrieved HTML.
> Even without the full body, key information such as titles, summaries, prices, and profiles may be available.

## Dependencies

None beyond curl and Python 3 standard-library modules.

## OGP (Open Graph Protocol) Meta Tags

Most sites include these for social sharing; they can provide a title, description, and image.

```bash
curl -sL -H "User-Agent: Mozilla/5.0 ..." "{URL}" | \
  python3 -c "
import sys, re
html = sys.stdin.read()
for m in re.findall(r'<meta property=\"og:(\w+)\" content=\"([^\"]*?)\"', html):
    print(f'og:{m[0]} = {m[1]}')
for m in re.findall(r'<meta name=\"description\" content=\"([^\"]*?)\"', html):
    print(f'description = {m}')
"
```

## JSON-LD (Schema.org Structured Data)

**The most valuable extraction target.** Contains structured JSON information about products, articles, profiles, and more.

```bash
curl -sL "{URL}" | \
  python3 -c "
import sys, re, json
html = sys.stdin.read()
blocks = re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.DOTALL)
for b in blocks:
    try:
        data = json.loads(b)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except:
        pass
"
```

### Examples

**Coupang search results** — `CollectionPage` + `ItemList`:
```json
{
  "@type": "CollectionPage",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "item": {
          "@type": "Product",
          "name": "...",
          "offers": { "price": 29900 }
        }
      }
    ]
  }
}
```

**LinkedIn profile** — `Person`:
```json
{
  "@type": "Person",
  "name": "...",
  "jobTitle": "...",
  "alumniOf": [
    { "@type": "Organization", "name": "..." }
  ]
}
```

**News article** — `NewsArticle`:
```json
{
  "@type": "NewsArticle",
  "headline": "...",
  "datePublished": "2026-04-16",
  "author": { "name": "..." },
  "articleBody": "..."
}
```

## Next.js RSC Payloads (YojeumIT and Similar Sites)

Next.js App Router sites include content in `self.__next_f.push()` scripts.

```bash
curl -sL "{URL}" | \
  python3 -c "
import sys, re
html = sys.stdin.read()
chunks = re.findall(r'self\.__next_f\.push\(\[1,\"(.*?)\"\]\)', html)
text = ''.join(chunks)
# Extract Korean text by decoding Unicode escapes
decoded = text.encode().decode('unicode_escape', errors='ignore')
print(decoded[:3000])
"
```

## When to Use

Metadata extraction is **a supplementary technique, not a standalone method**.
Use it alongside any phase that retrieves HTML:

- Phase 1 retrieves HTML with curl → also extract JSON-LD.
- Phase 2 retrieves HTML with curl_cffi → also extract JSON-LD.
- Phase 3 retrieves the DOM with Playwright → extract JSON-LD through `browser_evaluate`.

Even when the body is unavailable, JSON-LD may provide **product prices, article summaries, and profile information**.
