# httpx2 — Production Defaults

> **Source**: [pydantic/httpx2](https://github.com/pydantic/httpx2) — next-generation HTTP client for Python 3, continuation of HTTPX under Pydantic stewardship.
>
> **Selection**: Use this recipe when the project has selected `httpx2` or the task concerns its configuration. Preserve other working clients. Reuse connections and define cancellation, timeout and response/error behavior; tune protocol extras, limits, retries and redirects against the actual service rather than copying every value.

---

## 1. Dependencies for the selected client

```toml
# pyproject.toml
dependencies = [
    "httpx2[http2,brotli,zstd]",
]
```

| Extra | What it enables | When it helps |
|-------|----------------|--------------------|
| `http2` | HTTP/2 multiplexing via `h2` | Single TCP connection handles concurrent requests; eliminates head-of-line blocking |
| `brotli` | Brotli content decoding (`br`) | When the endpoint serves Brotli-compressed content |
| `zstd` | Zstandard content decoding | When the endpoint serves Zstandard-compressed content |
| `socks` | SOCKS5 proxy support via `socksio` | Install only if you route through SOCKS proxies |

Select extras needed by the endpoint or measured workload. Dependency changes follow the project's package manager and the task's authorization.

---

## 2. Example configuration

The values below illustrate one concurrent workload. Check the endpoint, request budget and pool behavior before adopting them.

```python
import socket
import httpx2

# Example values; size these to the service and workload.

LIMITS = httpx2.Limits(
    max_connections=200,           # concurrent connection budget
    max_keepalive_connections=40,  # idle connection budget
    keepalive_expiry=30.0,         # idle lifetime in seconds
)

TIMEOUT = httpx2.Timeout(
    connect=5.0,    # TCP + TLS handshake budget
    read=30.0,      # time to receive a response chunk
    write=10.0,     # time to send a request chunk
    pool=10.0,      # time to acquire a connection from pool
)

SOCKET_OPTIONS: list[tuple[int, int, int]] = [
    (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),   # disable Nagle; measure small-write latency
]
```

### Why each knob is set this way

| Setting | Library default | Example value | Consideration |
|---------|----------------|-------------|-----|
| `http2` | `False` | **`True`** | Use when the peer supports it and multiplexing helps |
| `max_connections` | `100` | `200` | Size for measured fan-out and server capacity; does not prevent exhaustion |
| `max_keepalive_connections` | `20` | `40` | Keeps warm connections alive; fewer TLS handshakes |
| `keepalive_expiry` | `5.0s` | `30.0s` | Tune to reuse patterns and server idle timeouts |
| `Timeout(5.0)` uniform | `5.0` all | Split | Choose separate budgets when connection and read behavior differ |
| `read` timeout | `5.0` | `30.0` | Slow APIs and streaming need breathing room |
| `pool` timeout | `5.0` | `10.0` | Pool exhaustion can require backpressure or capacity changes |
| `TCP_NODELAY` | Check transport | **on** | May reduce small-write latency; inspect existing transport settings |
| `retries` | `0` | `3` | Connection retries consume time; keep them within the request budget |
| `follow_redirects` | `False` | **`True`** | Choose redirect behavior for the endpoint and credential boundary |

---

## 3. Reusable client factory example

Adapt this when a shared factory fits the project. Keep any existing wrapper and its resource ownership.

```python
"""Example httpx2 client factory for a selected configuration."""

from __future__ import annotations

import socket
import typing

import httpx2

_LIMITS = httpx2.Limits(
    max_connections=200,
    max_keepalive_connections=40,
    keepalive_expiry=30.0,
)

_TIMEOUT = httpx2.Timeout(
    connect=5.0,
    read=30.0,
    write=10.0,
    pool=10.0,
)

_SOCKET_OPTIONS: list[tuple[int, int, int]] = [
    (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),
]


def create_async_client(
    *,
    base_url: str = "",
    http2: bool = True,
    retries: int = 3,
    limits: httpx2.Limits = _LIMITS,
    timeout: httpx2.Timeout = _TIMEOUT,
    headers: dict[str, str] | None = None,
    event_hooks: dict[str, list[typing.Callable[..., typing.Any]]] | None = None,
    **kwargs: typing.Any,
) -> httpx2.AsyncClient:
    transport = httpx2.AsyncHTTPTransport(
        http2=http2,
        retries=retries,
        limits=limits,
        socket_options=_SOCKET_OPTIONS,
    )
    return httpx2.AsyncClient(
        transport=transport,
        timeout=timeout,
        base_url=base_url,
        headers=headers or {},
        event_hooks=event_hooks or {},
        follow_redirects=True,
        **kwargs,
    )


def create_client(
    *,
    base_url: str = "",
    http2: bool = True,
    retries: int = 3,
    limits: httpx2.Limits = _LIMITS,
    timeout: httpx2.Timeout = _TIMEOUT,
    headers: dict[str, str] | None = None,
    event_hooks: dict[str, list[typing.Callable[..., typing.Any]]] | None = None,
    **kwargs: typing.Any,
) -> httpx2.Client:
    transport = httpx2.HTTPTransport(
        http2=http2,
        retries=retries,
        limits=limits,
        socket_options=_SOCKET_OPTIONS,
    )
    return httpx2.Client(
        transport=transport,
        timeout=timeout,
        base_url=base_url,
        headers=headers or {},
        event_hooks=event_hooks or {},
        follow_redirects=True,
        **kwargs,
    )
```

Usage:

```python
# Async — the common case
async with create_async_client(base_url="https://api.example.com") as client:
    r = await client.get("/users")

# Sync
with create_client() as client:
    r = client.get("https://api.example.com/health")
```

A direct client is also valid when its lifetime and defaults satisfy the request contract. Transport retries cover connection failures; broader retries need an explicit idempotency and total-budget decision.

---

## 4. Special case overrides

Examples of workload-specific choices:

| Scenario | Override |
|----------|----------|
| LLM streaming endpoints | `timeout=httpx2.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)` — no read timeout on streaming |
| Single-host API with low concurrency | `limits=httpx2.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=60.0)` |
| Ephemeral short-lived requests | `keepalive_expiry=5.0` — don't hold connections |
| Unix domain sockets | `httpx2.AsyncHTTPTransport(uds="/path/to/socket", ...)` |
| mTLS / client certs | Pass `verify=ssl_ctx` with `ctx.load_cert_chain(certfile=...)` |
| SOCKS proxy | `httpx2[socks]`, `proxy="socks5://..."` |

---

## 5. Event hooks for existing observability

Use the project's designated logger or tracing hooks when request diagnostics are required. Preserve redaction and avoid duplicate logging; do not introduce logging infrastructure merely for this recipe.

```python
import time
import logging

logger = logging.getLogger(__name__)

async def log_request(request: httpx2.Request) -> None:
    request.extensions["request_start"] = time.perf_counter()

async def log_response(response: httpx2.Response) -> None:
    start = response.request.extensions.get("request_start", 0)
    elapsed = time.perf_counter() - start
    logger.info(
        "HTTP %s %s → %d (%.3fs, %s)",
        response.request.method,
        response.request.url.host,
        response.status_code,
        elapsed,
        response.http_version,
    )

# Sync versions for Client
def log_request_sync(request: httpx2.Request) -> None:
    request.extensions["request_start"] = time.perf_counter()

def log_response_sync(response: httpx2.Response) -> None:
    start = response.request.extensions.get("request_start", 0)
    elapsed = time.perf_counter() - start
    logger.info(
        "HTTP %s %s → %d (%.3fs, %s)",
        response.request.method,
        response.request.url.host,
        response.status_code,
        elapsed,
        response.http_version,
    )
```

For auto `raise_for_status()`:

```python
async def raise_on_error(response: httpx2.Response) -> None:
    response.raise_for_status()
```

---

## 6. Compare configurations on the target workload

For an authorized test endpoint, compare the baseline and candidate configuration. This sequential probe measures request latency, not pool saturation, retry safety or every optimization. Use the result to decide whether the change helps.

```python
"""Compare two httpx2 configurations against an authorized test endpoint."""

from __future__ import annotations

import socket
import time

import anyio
import httpx2


TARGET_URL = "https://api.example.com/health"
ITERATIONS = 30


async def bench(label: str, client: httpx2.AsyncClient, url: str, n: int) -> float:
    for _ in range(3):  # warmup
        await client.get(url)
    start = time.perf_counter()
    for _ in range(n):
        r = await client.get(url)
        assert r.status_code == 200
    elapsed = time.perf_counter() - start
    avg_ms = (elapsed / n) * 1000
    print(f"  {label}: {avg_ms:.1f}ms avg ({n} reqs in {elapsed:.2f}s)")
    return avg_ms


async def main() -> None:
    results: dict[str, float] = {}

    # Baseline: library defaults
    async with httpx2.AsyncClient() as c:
        results["baseline"] = await bench("baseline", c, TARGET_URL, ITERATIONS)

    # Candidate: the example configuration above
    limits = httpx2.Limits(max_connections=200, max_keepalive_connections=40, keepalive_expiry=30.0)
    timeout = httpx2.Timeout(connect=5.0, read=30.0, write=10.0, pool=10.0)
    transport = httpx2.AsyncHTTPTransport(
        http2=True, retries=3, limits=limits,
        socket_options=[(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)],
    )
    async with httpx2.AsyncClient(transport=transport, timeout=timeout, follow_redirects=True) as c:
        results["configured"] = await bench("configured", c, TARGET_URL, ITERATIONS)

    print("\n--- Comparison ---")
    baseline = results["baseline"]
    for label, avg in results.items():
        delta = ((avg - baseline) / baseline) * 100
        print(f"  {label}: {avg:.1f}ms ({delta:+.1f}% vs bare)")


if __name__ == "__main__":
    anyio.run(main)
```

---

## 7. Quick reference — all knobs

### `httpx2.AsyncClient` / `httpx2.Client`

| Parameter | Type | Library Default | **Our Default** |
|-----------|------|-----------------|-----------------|
| `http1` | `bool` | `True` | `True` |
| `http2` | `bool` | `False` | **`True`** |
| `verify` | `ssl.SSLContext \| str \| bool` | `True` | `True` |
| `cert` | `CertTypes \| None` | `None` | `None` |
| `proxy` | `str \| Proxy \| None` | `None` | `None` |
| `mounts` | `dict[str, Transport]` | `None` | `None` |
| `timeout` | `Timeout \| float \| None` | `Timeout(5.0)` | **Split: 5/30/10/10** |
| `limits` | `Limits` | `Limits(100, 20, 5.0)` | **`Limits(200, 40, 30.0)`** |
| `follow_redirects` | `bool` | `False` | **`True`** |
| `max_redirects` | `int` | `20` | `20` |
| `event_hooks` | `dict` | `{}` | **Wire logging** |
| `base_url` | `str` | `""` | Set for single-API clients |
| `trust_env` | `bool` | `True` | `True` |
| `default_encoding` | `str \| Callable` | `"utf-8"` | `"utf-8"` |

### `httpx2.AsyncHTTPTransport` / `httpx2.HTTPTransport`

| Parameter | Type | Library Default | **Our Default** |
|-----------|------|-----------------|-----------------|
| `http1` | `bool` | `True` | `True` |
| `http2` | `bool` | `False` | **`True`** |
| `retries` | `int` | `0` | **`3`** |
| `limits` | `Limits` | `Limits(100, 20, 5.0)` | **`Limits(200, 40, 30.0)`** |
| `uds` | `str \| None` | `None` | `None` |
| `local_address` | `str \| None` | `None` | `None` |
| `socket_options` | `Iterable[SOCKET_OPTION]` | `None` | **`[TCP_NODELAY]`** |
| `proxy` | `str \| Proxy \| None` | `None` | `None` |

### `httpx2.Timeout`

| Parameter | Library Default | **Our Default** |
|-----------|-----------------|-----------------|
| `connect` | `5.0` | `5.0` |
| `read` | `5.0` | **`30.0`** |
| `write` | `5.0` | **`10.0`** |
| `pool` | `5.0` | **`10.0`** |

### `httpx2.Limits`

| Parameter | Library Default | **Our Default** |
|-----------|-----------------|-----------------|
| `max_connections` | `100` | **`200`** |
| `max_keepalive_connections` | `20` | **`40`** |
| `keepalive_expiry` | `5.0` | **`30.0`** |

### Async backend (httpcore2)

httpcore2 uses `anyio` by default (works with both asyncio and trio). No extra config needed if you're already on the anyio stack. For trio, install `httpcore2[trio]`.
