"""Claude Agent SDK (TypeScript) サイドカーアダプタ。."""

from __future__ import annotations

from typing import Any

from . import ts_runner

_CLAUDE_EFFORT: dict[str, str] = {"low": "low", "medium": "medium", "high": "high"}


class ClaudeTsAdapter:
    """バンドル ``engines/ts/claude.mjs`` 経由で ``@anthropic-ai/claude-agent-sdk`` を呼ぶアダパタ。."""

    @staticmethod
    def run(prompt: str, settings: dict[str, Any]) -> str:
        """プロンプトを claude.mjs サイドカーへ渡し、結果テキストを返す。."""
        effort = _CLAUDE_EFFORT.get(str(settings["thinking"]), "high")
        args = [
            "--model",
            str(settings["model"]),
            "--effort",
            effort,
            "--budget",
            f"{float(settings['budget']):.2f}",
        ]
        return ts_runner.run_sidecar(
            "claude.mjs", prompt, args, float(settings["timeout"])
        )
