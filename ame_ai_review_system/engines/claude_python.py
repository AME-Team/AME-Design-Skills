# pyright: reportUnknownVariableType=false, reportMissingTypeStubs=false, reportMissingImports=false
"""Claude Agent SDK (Python) を用いるインプロセスアダプタ。."""

from __future__ import annotations

import asyncio
from typing import Any

_CLAUDE_EFFORT: dict[str, str] = {"low": "low", "medium": "medium", "high": "high"}


class ClaudePythonAdapter:
    """``claude_agent_sdk.query`` で純推論 (ツール不要) のレビューを行うアダプタ。."""

    @staticmethod
    def run(prompt: str, settings: dict[str, Any]) -> str:
        """プロンプトを Claude SDK へ送り、結果テキストを返す。."""
        query, options_cls, result_cls = _import_sdk()
        timeout = float(settings.get("timeout", 600.0))
        try:
            return asyncio.run(
                asyncio.wait_for(
                    _run(prompt, settings, query, options_cls, result_cls),
                    timeout=timeout,
                ),
            )
        except TimeoutError as exc:
            msg = f"[engine] claude timed out after {timeout:.0f}s"
            raise SystemExit(msg) from exc


async def _run(
    prompt: str,
    settings: dict[str, Any],
    query: Any,
    options_cls: Any,
    result_cls: Any,
) -> str:
    effort = _CLAUDE_EFFORT.get(str(settings["thinking"]), "high")
    options = options_cls(
        model=settings["model"],
        effort=effort,
        max_budget_usd=float(settings["budget"]),
        allowed_tools=[],
    )
    result_text = ""
    async for message in query(prompt=prompt, options=options):
        if isinstance(message, result_cls):
            if getattr(message, "is_error", False):
                msg = f"[engine] claude returned error: {message.result}"
                raise RuntimeError(msg)
            result_text = getattr(message, "result", "") or ""
    if not result_text.strip():
        msg = "[engine] claude produced empty output."
        raise RuntimeError(msg)
    return result_text


def _import_sdk() -> tuple[Any, Any, Any]:
    try:
        from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query
    except ImportError as exc:
        msg = (
            "[engine] claude-agent-sdk is not installed. "
            "Run: uv pip install claude-agent-sdk (with your venv activated)"
        )
        raise SystemExit(msg) from exc
    return query, ClaudeAgentOptions, ResultMessage
