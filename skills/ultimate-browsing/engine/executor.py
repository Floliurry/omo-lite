"""Capability-matched executor for fallback attempts.

The fetch_chain's probe/grid phase uses curl_cffi directly. When curl can't
punch through (JS challenge, real-TLS detection), this module routes to the
right browser executor based on the profile's `capabilities_needed` tags:

    needs_real_tls_stack + needs_js_exec  → playwright_real_chrome.js
    needs_js_exec only                    → Playwright MCP (if available)
    needs_mobile_context (+ real_tls)     → playwright_mobile_chrome.js

The JS templates live in `engine/templates/` and accept only generic
parameters ({{url}}, {{waitSelector}}, {{profileDir}}, {{device}}). No
site-specific logic.

Host-provided browser invocation requires the caller's tool access. This module
provides the subprocess path for local JS templates and returns a capability
handoff when that access is required.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from typing import Optional

from .validators import Verdict, validate
from .waf_detector import load_profile
from .result_schema import Attempt


TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


def _node_available() -> bool:
    return shutil.which("node") is not None


def _local_playwright_available() -> bool:
    """Return whether the local template dependency is already resolvable.

    This probe deliberately uses Node's local resolution only. It must not use
    a package runner, because a browser fallback must never install packages.
    """
    if not _node_available():
        return False
    try:
        proc = subprocess.run(
            ["node", "-e", "require.resolve('playwright')"],
            cwd=TEMPLATES_DIR,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return proc.returncode == 0


def _pick_executor(capabilities: list[str], device_class: str) -> str:
    caps = set(capabilities or [])
    if device_class == "mobile" or "needs_mobile_context" in caps:
        if "needs_real_tls_stack" in caps:
            return "playwright_mobile_chrome"
        return "playwright_mcp_mobile"
    if "needs_real_tls_stack" in caps:
        return "playwright_real_chrome"
    if "needs_js_exec" in caps:
        return "playwright_mcp"
    return "playwright_real_chrome"  # safest general fallback


def _run_node_template(template: str, args: dict, timeout: int = 90) -> tuple[int, str, str]:
    """Run a Node.js template with args as JSON on stdin.

    Template convention: reads `process.stdin` → JSON → runs fetch → writes
    HTML to stdout; errors go to stderr with non-zero exit code.
    """
    path = os.path.join(TEMPLATES_DIR, template)
    if not os.path.isfile(path):
        return 127, "", f"template not found: {path}"
    try:
        proc = subprocess.run(
            ["node", path],
            input=json.dumps(args),
            cwd=TEMPLATES_DIR,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout after {timeout}s"
    except Exception as e:
        return 1, "", f"{type(e).__name__}:{e}"


def _external_browser_guidance(
    choice: str,
    success_selectors: Optional[list[str]],
) -> str:
    context = "mobile device context" if choice.endswith("_mobile") else "the requested device context"
    selector = f" and wait for {success_selectors[0]!r}" if success_selectors else ""
    return (
        "This fallback needs a host browser-navigation capability. Navigate to the "
        f"requested URL with {context}{selector}, then provide observed page HTML "
        "for validation. No external browser observation has been received."
    )


class _FakeResp:
    """Minimal response shim so validators.validate() works on Playwright HTML."""
    def __init__(self, html: str, status: int = 200, final_url: str = ""):
        self.text = html
        self.status_code = status
        self.url = final_url
        self.cookies = _FakeCookies()
        self.headers = {}


class _FakeCookies:
    class _Jar:
        def __iter__(self):
            return iter([])
    def __init__(self):
        self.jar = self._Jar()
    def __iter__(self):
        return iter([])


def run_playwright_fallback(
    url: str,
    *,
    profile_id: str,
    success_selectors: Optional[list[str]] = None,
    device_class: str = "auto",
    timeout: int = 90,
    profile_dir: Optional[str] = None,
    force_executor: Optional[str] = None,
) -> tuple[Attempt, str]:
    """Invoke the appropriate Playwright executor.

    force_executor: caller-specified executor name (from a profile's
    `fallback_when_challenge` list). When set, it overrides capability-based
    inference. Recognized values: "playwright_real_chrome",
    "playwright_mobile_chrome", "playwright_mcp".

    Returns (Attempt, html_content). Attempt.verdict reflects validation.
    """
    profile = load_profile(profile_id)
    capabilities = profile.get("capabilities_needed") or []
    choice = force_executor or _pick_executor(capabilities, device_class)

    t0 = time.time()
    att = Attempt(
        phase="fallback",
        executor=choice,
        url=url,
        url_transform="original",
        impersonate=None,
        referer="",
    )

    if choice.startswith("playwright_mcp"):
        att.error = _external_browser_guidance(choice, success_selectors)
        att.verdict = Verdict.UNKNOWN.value
        att.elapsed_s = round(time.time() - t0, 3)
        return att, ""

    if not _local_playwright_available():
        att.error = "local Node Playwright dependency is unavailable; no install was attempted"
        att.verdict = Verdict.UNKNOWN.value
        att.elapsed_s = round(time.time() - t0, 3)
        return att, ""

    template_map = {
        "playwright_real_chrome": "playwright_real_chrome.js",
        "playwright_mobile_chrome": "playwright_mobile_chrome.js",
    }
    template = template_map.get(choice)
    if template is None:
        att.error = f"no template for executor {choice}"
        att.verdict = Verdict.UNKNOWN.value
        att.elapsed_s = round(time.time() - t0, 3)
        return att, ""

    owns_profile_dir = not profile_dir
    active_profile_dir = profile_dir or tempfile.mkdtemp(prefix="ultimate-browsing-")
    args: dict = {
        "url": url,
        "profileDir": active_profile_dir,
        "timeout": timeout * 1000,
    }
    if choice == "playwright_mobile_chrome":
        args["device"] = "iPhone 13 Pro"
    if success_selectors:
        args["waitSelector"] = success_selectors[0]

    cleanup_error = None
    try:
        rc, stdout, stderr = _run_node_template(template, args, timeout=timeout + 10)
    finally:
        if owns_profile_dir:
            try:
                shutil.rmtree(active_profile_dir)
            except OSError as error:
                cleanup_error = f"owned browser profile cleanup failed: {error}"
    att.elapsed_s = round(time.time() - t0, 3)

    if rc != 0 or not stdout:
        att.error = (stderr or "no stdout")[:300]
        if cleanup_error:
            att.error = f"{att.error}; {cleanup_error}"
        att.verdict = Verdict.UNKNOWN.value
        return att, ""

    # stdout carries HTML. Validate with a shim.
    resp = _FakeResp(stdout)
    vr = validate(resp, success_selectors=success_selectors)
    att.status = 200
    att.body_size = len(stdout)
    att.verdict = vr.verdict.value
    att.reasons = vr.reasons
    att.error = cleanup_error
    return att, stdout
