"""Static analysis pre-check for PR review Circuit Breaker.

pr_review.sh の前段で pre-commit を実行し、1件でもエラーが
あれば非ゼロで終了する。AIレビューの無駄な起動をスキップする (Circuit Breaker)。

CI (ci.yml) と同じ pre-commit フックを使用することで、Gate 1 と CI のチェック内容を
完全に同期させる。

使い方:
    python3 static_precheck.py --files file1.py file2.sh ...
    python3 static_precheck.py --files-from-stdin < files.txt
"""

from __future__ import annotations

import argparse
import subprocess
import sys

from . import paths

_TIMEOUT_SECONDS = 300


def _run_precommit(files: list[str], cwd: str) -> tuple[bool, str]:
    """Run pre-commit on changed files."""
    if not files:
        return True, ""

    try:
        result = subprocess.run(
            ["pre-commit", "run", "--files", *files],
            capture_output=True,
            text=True,
            check=False,
            timeout=_TIMEOUT_SECONDS,
            cwd=cwd,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        print(
            "[static-precheck] 'pre-commit' skipped (tool not found).",
            file=sys.stderr,
        )
        return True, ""
    except subprocess.TimeoutExpired:
        print("[static-precheck] 'pre-commit' timed out.", file=sys.stderr)
        return True, ""

    if result.returncode != 0:
        detail = (result.stdout + result.stderr).strip()
        return False, f"pre-commit:\n{detail}"
    return True, ""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Static analysis pre-check for PR review Circuit Breaker.",
    )
    parser.add_argument(
        "--files",
        nargs="*",
        default=[],
        help="変更ファイル一覧 (リポジトリルートからの相対パス)",
    )
    parser.add_argument(
        "--files-from-stdin",
        action="store_true",
        help="ファイル一覧を stdin から1行1ファイルで読み込む",
    )
    args = parser.parse_args(argv)

    files = [f for f in args.files if f.strip()]
    if args.files_from_stdin:
        files.extend(line.strip() for line in sys.stdin if line.strip())
    if not files:
        return 0

    proj_root = paths.project_root()
    cwd = str(proj_root)

    passed, detail = _run_precommit(files, cwd)
    if not passed:
        print("[static-precheck] FAILED: pre-commit", file=sys.stderr)
        print(detail, file=sys.stderr)
        return 1

    print("[static-precheck] All static checks passed.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
