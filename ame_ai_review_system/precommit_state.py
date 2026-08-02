from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
from typing import Any, cast

# ブランチ名は git の refname に安全な文字のみ許可（checkout_pr.sh と同基準）。
# これを弾かないと state JSON のキーインジェクションやログ汚染に繋がる。
_BRANCH_RE = re.compile(r"^[A-Za-z0-9/_.-]+$")


# git コマンドのタイムアウト。認証プロンプトや lock で pre-commit が無限待機するのを防ぐ。
_GIT_TIMEOUT_SECONDS = 10


def run_git(args: list[str]) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=_GIT_TIMEOUT_SECONDS,
            encoding="utf-8",
            errors="replace",
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout


def current_branch() -> str:
    return run_git(["rev-parse", "--abbrev-ref", "HEAD"]).strip()


def is_valid_branch(name: str) -> bool:
    return bool(_BRANCH_RE.match(name))


def state_file_path() -> pathlib.Path:
    # リモート URL があればそれを、なければ絶対パスをリポジトリ識別子として使う。
    # hash 化することでファイル名に URL/パスがそのまま露出しない。
    remote = run_git(["remote", "get-url", "origin"]).strip()
    if not remote:
        toplevel = run_git(["rev-parse", "--show-toplevel"]).strip()
        remote = toplevel or str(pathlib.Path.cwd())
    digest = hashlib.sha256(remote.encode("utf-8")).hexdigest()[:16]
    # 副作用 (mkdir) は write_state 側で行う。ここはパス計算のみ。
    base = pathlib.Path.home() / ".config" / "ame-ai-review-system"
    return base / f"precommit_state_{digest}.json"


def read_state(path: pathlib.Path) -> dict[str, Any]:
    try:
        data: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return cast("dict[str, Any]", data) if isinstance(data, dict) else {}


def write_state(path: pathlib.Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    # 書込み中の強制終了で JSON が部分的に残り streak が 0 リセットされるのを防ぐため、
    # 一時ファイルに書いてから Path.replace でアトミックに差し替える。
    fd, tmp_name = tempfile.mkstemp(
        prefix=".precommit_state_",
        suffix=".tmp",
        dir=str(path.parent),
    )
    tmp_path = pathlib.Path(tmp_name)
    try:
        try:
            fh = os.fdopen(fd, mode="w", encoding="utf-8")
        except OSError:
            os.close(fd)
            raise
        with fh:
            fh.write(content)
        tmp_path.replace(path)
    finally:
        # replace 成功後は tmp が存在しないため no-op になる。
        tmp_path.unlink(missing_ok=True)


def get_streak(
    state: dict[str, Any],
    branch: str,
    *,
    key: str = "low_only_streak",
) -> int:
    branches = cast("dict[str, Any] | None", state.get("branches"))
    if not isinstance(branches, dict):
        return 0
    entry = cast("dict[str, Any] | None", branches.get(branch))
    if not isinstance(entry, dict):
        return 0
    try:
        return int(entry.get(key, 0))
    except (TypeError, ValueError):
        return 0


def set_streak(
    state: dict[str, Any],
    branch: str,
    streak: int,
    *,
    key: str = "low_only_streak",
) -> None:
    raw = cast("dict[str, Any] | None", state.get("branches"))
    branches: dict[str, Any] = raw if isinstance(raw, dict) else {}
    entry = cast("dict[str, Any] | None", branches.get(branch))
    if not isinstance(entry, dict):
        entry = {}
    entry[key] = streak
    branches[branch] = entry
    state["branches"] = branches


def reset_all_streaks(state: dict[str, Any], branch: str) -> None:
    # post-commit ですべての streak 種別をリセットするためのヘルパ。
    for key in ("low_only_streak", "engine_failure_streak"):
        set_streak(state, branch, 0, key=key)
