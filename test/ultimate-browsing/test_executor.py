from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "ultimate-browsing"))

from engine import executor  # noqa: E402
from engine.validators import ValidationResult, Verdict  # noqa: E402


class ExecutorFallback(unittest.TestCase):
    def test_local_readiness_uses_node_resolution_without_package_runner(self) -> None:
        with (
            patch("engine.executor._node_available", return_value=True),
            patch(
                "engine.executor.subprocess.run",
                return_value=CompletedProcess(["node"], 0),
            ) as run,
        ):
            self.assertTrue(executor._local_playwright_available())

        command = run.call_args.args[0]
        self.assertEqual(command[0], "node")
        self.assertNotIn("npx", command)

    def test_host_browser_handoff_does_not_run_subprocess(self) -> None:
        with (
            patch("engine.executor.load_profile", return_value={"capabilities_needed": ["needs_js_exec"]}),
            patch("engine.executor.subprocess.run") as run,
        ):
            attempt, html = executor.run_playwright_fallback(
                "https://example.com",
                profile_id="unknown_challenge",
                force_executor="playwright_mcp",
            )

        self.assertEqual(attempt.executor, "playwright_mcp")
        self.assertEqual(attempt.verdict, Verdict.UNKNOWN.value)
        self.assertEqual(html, "")
        self.assertIn("browser-navigation", attempt.error or "")
        run.assert_not_called()

    def test_mobile_host_browser_handoff_keeps_context_and_no_html(self) -> None:
        with (
            patch(
                "engine.executor.load_profile",
                return_value={"capabilities_needed": ["needs_js_exec", "needs_mobile_context"]},
            ),
            patch("engine.executor.subprocess.run") as run,
        ):
            attempt, html = executor.run_playwright_fallback(
                "https://example.com",
                profile_id="unknown_challenge",
                success_selectors=["main"],
                device_class="mobile",
            )

        self.assertEqual(attempt.executor, "playwright_mcp_mobile")
        self.assertEqual(attempt.verdict, Verdict.UNKNOWN.value)
        self.assertEqual(html, "")
        self.assertIn("mobile", attempt.error or "")
        self.assertIn("main", attempt.error or "")
        run.assert_not_called()

    def test_owned_profile_is_removed_after_successful_template_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            owned_profile = Path(temporary_directory) / "owned"
            owned_profile.mkdir()

            def template_run(_template, args, **_kwargs) -> tuple[int, str, str]:
                Path(args["profileDir"]).joinpath("session").write_text("temporary")
                return 0, "<article>observed</article>", ""

            with (
                patch("engine.executor.load_profile", return_value={}),
                patch("engine.executor._local_playwright_available", return_value=True),
                patch("engine.executor.tempfile.mkdtemp", return_value=str(owned_profile)),
                patch("engine.executor._run_node_template", side_effect=template_run),
            ):
                executor.run_playwright_fallback(
                    "https://example.com",
                    profile_id="unknown_challenge",
                    success_selectors=["article"],
                )

            self.assertFalse(owned_profile.exists())

    def test_owned_profile_is_removed_after_failed_template_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            owned_profile = Path(temporary_directory) / "owned"
            owned_profile.mkdir()

            def template_run(_template, args, **_kwargs) -> tuple[int, str, str]:
                Path(args["profileDir"]).joinpath("session").write_text("temporary")
                return 1, "", "browser failed"

            with (
                patch("engine.executor.load_profile", return_value={}),
                patch("engine.executor._local_playwright_available", return_value=True),
                patch("engine.executor.tempfile.mkdtemp", return_value=str(owned_profile)),
                patch("engine.executor._run_node_template", side_effect=template_run),
            ):
                attempt, html = executor.run_playwright_fallback(
                    "https://example.com",
                    profile_id="unknown_challenge",
                )

            self.assertFalse(owned_profile.exists())
        self.assertEqual(attempt.verdict, Verdict.UNKNOWN.value)
        self.assertEqual(html, "")

    def test_empty_profile_is_owned_and_removed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            owned_profile = Path(temporary_directory) / "owned"
            owned_profile.mkdir()

            with (
                patch("engine.executor.load_profile", return_value={}),
                patch("engine.executor._local_playwright_available", return_value=True),
                patch("engine.executor.tempfile.mkdtemp", return_value=str(owned_profile)),
                patch("engine.executor._run_node_template", return_value=(1, "", "browser failed")),
            ):
                executor.run_playwright_fallback(
                    "https://example.com",
                    profile_id="unknown_challenge",
                    profile_dir="",
                )

            self.assertFalse(owned_profile.exists())

    def test_cleanup_failure_is_recorded_without_discarding_html(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            owned_profile = Path(temporary_directory) / "owned"
            owned_profile.mkdir()

            with (
                patch("engine.executor.load_profile", return_value={}),
                patch("engine.executor._local_playwright_available", return_value=True),
                patch("engine.executor.tempfile.mkdtemp", return_value=str(owned_profile)),
                patch("engine.executor._run_node_template", return_value=(0, "<article>observed</article>", "")),
                patch(
                    "engine.executor.validate",
                    return_value=ValidationResult(verdict=Verdict.STRONG_OK),
                ),
                patch("engine.executor.shutil.rmtree", side_effect=OSError("permission denied")),
            ):
                attempt, html = executor.run_playwright_fallback(
                    "https://example.com",
                    profile_id="unknown_challenge",
                    success_selectors=["article"],
                )

            self.assertEqual(html, "<article>observed</article>")
            self.assertIn(attempt.verdict, (Verdict.STRONG_OK.value, Verdict.WEAK_OK.value))
            self.assertIn("cleanup", attempt.error or "")
            self.assertTrue(owned_profile.exists())

    def test_explicit_profile_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            profile = Path(temporary_directory) / "caller-profile"
            profile.mkdir()
            marker = profile / "keep"
            marker.write_text("caller owned")

            with (
                patch("engine.executor.load_profile", return_value={}),
                patch("engine.executor._local_playwright_available", return_value=True),
                patch("engine.executor._run_node_template", return_value=(1, "", "browser failed")) as run,
            ):
                executor.run_playwright_fallback(
                    "https://example.com",
                    profile_id="unknown_challenge",
                    profile_dir=str(profile),
                )

            self.assertTrue(marker.exists())
            self.assertEqual(run.call_args.args[1]["profileDir"], str(profile))


if __name__ == "__main__":
    unittest.main()
