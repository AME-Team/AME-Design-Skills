# pyright: reportUnknownVariableType=false, reportAttributeAccessIssue=false, reportMissingTypeStubs=false, reportMissingImports=false
"""Google Antigravity SDK (Python) を用いるインプロセスアダプタ。."""

from __future__ import annotations

import asyncio
import os
from typing import Any, cast

_THINKING_LEVEL: dict[str, str] = {"low": "LOW", "medium": "MEDIUM", "high": "HIGH"}


class AntigravityAdapter:
    """``google.antigravity`` SDK で Gemini モデルへレビューを依頼するアダプタ。."""

    @staticmethod
    def run(prompt: str, settings: dict[str, Any]) -> str:
        """プロンプトを Antigravity SDK へ送り、結果テキストを返す。."""
        ag = _import_sdk()
        timeout = float(settings.get("timeout", 600.0))
        try:
            return asyncio.run(
                asyncio.wait_for(_run(prompt, settings, ag), timeout=timeout)
            )
        except TimeoutError as exc:
            msg = f"[engine] antigravity timed out after {timeout:.0f}s"
            raise SystemExit(msg) from exc


async def _run(prompt: str, settings: dict[str, Any], ag: Any) -> str:
    thinking_key = _THINKING_LEVEL.get(str(settings["thinking"]), "HIGH")
    thinking_level = ag.ThinkingLevel[thinking_key]
    model_options = ag.GeminiModelOptions(thinking_level=thinking_level)
    config = ag.LocalAgentConfig(
        model=settings["model"],
        api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"),
        models=[model_options],
    )
    agent = ag.Agent(config)
    response = agent.chat(prompt)
    text = cast("str", await response.text())
    if not text.strip():
        msg = "[engine] antigravity produced empty output."
        raise RuntimeError(msg)
    return text


def _import_sdk() -> Any:
    import importlib

    # `from google import antigravity` は mypy の attr-defined で落ちる
    # (google は namespace package で、google-antigravity を導入済みでも
    # mypy が google.antigravity 属性を静的に解決できない)。
    # importlib で動的解決しつつ claude_python.py と同じ遅延 import パターンを保つ。
    try:
        return importlib.import_module("google.antigravity")
    except ImportError as exc:
        msg = (
            "[engine] google-antigravity is not installed. "
            "Run: uv pip install google-antigravity (with your venv activated)"
        )
        raise SystemExit(msg) from exc
