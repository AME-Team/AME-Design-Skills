"""TypeScript SDK サイドカー (Node 子プロセス) の起動・入出力管理。."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import TYPE_CHECKING

from ame_ai_review_system import paths

if TYPE_CHECKING:
    from pathlib import Path


def _node_binary() -> str:
    node = shutil.which("node")
    if not node:
        msg = (
            "[engine] node not found on PATH. "
            "TypeScript SDK engines (opencode, claude-ts) require Node.js."
        )
        raise SystemExit(msg)
    return node


def _sidecar_path(script: str) -> Path:
    # プロジェクトローカル (.ame-review/engines-ts/) があれば優先、なければ
    # vendored の ame_ai_review_system/engines/ts/ を使う
    # (ESM は NODE_PATH を無視するため隣接 node_modules が必須)。
    project_local = paths.ame_review_dir() / "engines-ts" / script
    if project_local.exists():
        return project_local
    return paths.package_dir() / "engines" / "ts" / script


def _node_path_entries() -> list[str]:
    candidates = [
        paths.ame_review_dir() / "node_modules",
        paths.project_root() / "node_modules",
    ]
    return [str(p) for p in candidates if p.is_dir()]


def run_sidecar(
    script: str,
    prompt: str,
    args: list[str],
    timeout: float,
) -> str:
    node = _node_binary()
    script_path = _sidecar_path(script)
    if not script_path.exists():
        msg = f"[engine] TypeScript sidecar not found: {script_path}"
        raise SystemExit(msg)

    env = os.environ.copy()
    entries = _node_path_entries()
    existing = env.get("NODE_PATH", "")
    if entries:
        combined = ":".join(entries)
        env["NODE_PATH"] = f"{combined}:{existing}" if existing else combined

    try:
        proc = subprocess.run(
            [node, str(script_path), *args],
            input=prompt,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        msg = f"[engine] {script} timed out after {timeout:.0f}s"
        raise SystemExit(msg) from exc
    except FileNotFoundError as exc:
        msg = f"[engine] failed to start node: {exc}"
        raise SystemExit(msg) from exc

    if proc.stderr:
        sys.stderr.write(proc.stderr)

    if proc.returncode != 0:
        msg = f"[engine] {script} exited with code {proc.returncode}."
        raise SystemExit(msg)

    output = proc.stdout.strip()
    if not output:
        msg = f"[engine] {script} produced empty output."
        raise SystemExit(msg)
    return output
