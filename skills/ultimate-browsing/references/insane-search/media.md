# Media Extraction — yt-dlp

> yt-dlp is not limited to YouTube: it is a general media extractor supporting **1,858 sites**.
> Video, audio, podcasts, and live streams: try yt-dlp first for media URLs.

## Check Installation

```bash
which yt-dlp || python3 -m yt_dlp --version
```

- Use `yt-dlp` directly when it is on PATH.
- Otherwise substitute `python3 -m yt_dlp` in the commands below.
- If not installed: `pip install yt-dlp`.

## Core Commands (Shared Across Supported Sites)

### Extract Metadata (Most General)

```bash
yt-dlp --dump-json "URL"
```

Returns structured JSON including title, uploader, duration, view_count, description, and tags.
Approximately 95% success on sites with dedicated extractors.

### Extract Subtitles

```bash
yt-dlp --write-sub --write-auto-sub --sub-lang "en,ko" --skip-download -o "/tmp/%(id)s" "URL"
cat /tmp/VIDEO_ID.*.vtt
```

YouTube supports automatic subtitles in 100 languages. Other sites work only when they provide their own subtitles.

### Search

```bash
# YouTube
yt-dlp --dump-json "ytsearch5:{검색어}"

# SoundCloud
yt-dlp --dump-json "scsearch5:{검색어}"

# Dailymotion
yt-dlp --dump-json "dailymotionsearch5:{검색어}"

# Yahoo
yt-dlp --dump-json "yahoosearch5:{검색어}"
```

### List Channels/Playlists (Without Downloading)

```bash
yt-dlp --flat-playlist --dump-json "채널_URL"
```

Returns title, id, url, and duration. Quickly collects the complete video list for a channel.

### Extract Comments (YouTube)

```bash
yt-dlp --write-comments --skip-download --write-info-json \
  --extractor-args "youtube:max_comments=20" \
  -o "/tmp/%(id)s" "URL"
```

## Supported Platform Categories

### Video

| Site | Metadata | Subtitles | Search | Notes |
|--------|----------|------|------|------|
| YouTube | O | O (including automatic) | `ytsearch` | Best support |
| Vimeo | O | O (when provided) | X | Extensive academic/documentary content |
| Twitch | O (VOD/clips) | X | X | Technical streams |
| TikTok | O | X | X | Public accounts only |
| Dailymotion | O | O | `dailymotionsearch` | |
| Rumble | O | X | X | |
| PeerTube | O | X | X | Decentralized |

### Audio/Podcasts

| Site | Metadata | Search | Notes |
|--------|----------|------|------|
| SoundCloud | O | `scsearch` | Search also supported; strongest support |
| Apple Podcasts | O | X | RSS-based |
| TuneIn | O | X | |
| acast | O | X | Channel-level support |
| Spreaker | O | X | |
| Audius | O | X | Blockchain-based |

### Korean Platforms

| Site | Extractor | Notes |
|--------|-----------|------|
| Naver TV | `Naver`, `Naver:live` | |
| Kakao | `Kakao` | |
| SBS | `SBS`, `sbs.co.kr` | |
| JTBC | `JTBC`, `JTBC:program` | |
| Chzzk | `chzzk:video`, `chzzk:live` | Naver streaming |
| Soop (formerly AfreecaTV) | `soop`, `soop:live` | |
| Daum | `daum.net`, `daum.net:clip` | |
| Weverse | `Weverse`, `WeverseLive` | K-pop fandom |

### News VOD

| Site | Notes |
|--------|------|
| BBC | Public VOD |
| ABC (Australia) | iview |
| CBS News | |
| NBC News | Frequently blocked |

> For news sites, **official YouTube channels** are more reliable than direct URLs.
> Example: `ytsearch:BBC News {키워드}`

## Caveats

- Automatically generated subtitles can repeat text across lines; postprocessing is needed.
- Generic extractors have approximately 30% success; prefer sites with dedicated extractors.
- Most paywalled or login-required sites fail.
- `--dump-json` is the safest general command: metadata only, with no media download.
