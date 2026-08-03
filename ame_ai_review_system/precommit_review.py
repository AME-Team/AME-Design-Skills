from __future__ import annotations

import argparse
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
from typing import Any

from . import paths, payload, precommit_engine, precommit_state, review_config

# pr_review.sh と同じ diff 行数上限。これを超えると前から切詰める。
_MAX_DIFF_LINES = 4000

# LOW streak がこの回数に達したら LOW のみの指摘でもコミットを許可する（無限ループ回避）。
_LOW_STREAK_THRESHOLD = 2

# エンジン失敗 streak がこの回数に達したらコミットを許可する（API 一時障害対策）。
_ENGINE_FAILURE_STREAK_THRESHOLD = 3

# fail-closed 方針: LOW/INFO 以外の severity (CRITICAL/HIGH/MIDDLE/WARNING/typo/未知) は
# すべて blocking 扱い。LLM が規格外の severity を吐いても確認を挟む。
_LOW_SEVERITIES = ("LOW", "INFO")

# engine.py 内部のタイムアウト(600s) + バッファ。外側の python3 プロセス自体が
# ハングした場合にコミットを永遠にブロックしないための上限。
_ENGINE_TIMEOUT_SECONDS = 660

# ruff / mypy のタイムアウト。LLM レビュー前にコード品質を保証するための pre-check。
_STATIC_CHECK_TIMEOUT_SECONDS = 120


def _staged_files() -> list[str]:
    out = precommit_state.run_git([
        "diff",
        "--cached",
        "--name-only",
        "--diff-filter=d",
    ])
    return [line.strip() for line in out.splitlines() if line.strip()]


def _truncate_diff(diff: str) -> str:
    lines = diff.splitlines()
    if len(lines) <= _MAX_DIFF_LINES:
        return diff
    truncated_lines = lines[:_MAX_DIFF_LINES]
    # 行頭 ``` で始まる行のみフェンス状態を反転させる。diff 内のバックティックは無視。
    open_fence = False
    for line in truncated_lines:
        if line.startswith("```"):
            open_fence = not open_fence
    truncated = "\n".join(truncated_lines)
    # フェンスが開いたまま切詰められた場合は閉じタグを補完して LLM プロンプト構造を保つ。
    if open_fence:
        truncated += "\n```"
    return truncated + (
        f"\n... (truncated from {len(lines)} to {_MAX_DIFF_LINES} lines)"
    )


def _sanitize_for_codeblock(text: str) -> str:
    # ファイル名/コミットメッセージ/diff に ``` が含まれているとプロンプトのフェンス構造が
    # 壊れるため、視覚的に近い別文字 (U+201E DOUBLE LOW-9 QUOTATION MARK) へ置換する。
    return text.replace("```", "\u201e\u201e\u201e")


def _build_diff(base_ref: str) -> str:
    # 今回の staged 差分を先に置くことで、truncation が発生しても
    # 「今回のコミット対象」が必ずレビューに含まれるようにする。
    # diff 内のバックティック (docstring の削除等) でプロンプト構造が壊れないようサニタイズ。
    parts: list[str] = []
    # Issue #37: 除外対象ディレクトリ配下の差分を除去してからサニタイズする。
    staged_diff = _sanitize_for_codeblock(
        review_config.filter_review_diff(
            precommit_state.run_git(["diff", "--cached"]).strip(),
        ),
    )
    if staged_diff:
        parts.append(
            "### ステージ済み差分 (今回のコミット対象)\n\n```diff\n"
            + staged_diff
            + "\n```",
        )
    branch_diff = _sanitize_for_codeblock(
        review_config.filter_review_diff(
            precommit_state.run_git(
                ["diff", f"origin/{base_ref}...HEAD"],
            ).strip(),
        ),
    )
    if branch_diff:
        parts.append(
            f"### ブランチ差分 (origin/{base_ref}...HEAD)\n\n```diff\n{branch_diff}\n```",
        )
    return "\n\n".join(parts)


def _build_prompt(
    base_ref: str,
    branch: str,
    staged_files: list[str],
    diff: str,
    prompt_text: str,
) -> str:
    commit_log = precommit_state.run_git(
        ["log", f"origin/{base_ref}..HEAD", "--oneline"],
    ).strip()
    if not commit_log:
        commit_log = "(ブランチに commit はまだありません)"
    # ファイル名やコミットメッセージに ``` が含まれているとプロンプト構造が壊れるためサニタイズ。
    sanitized_files = "\n".join(_sanitize_for_codeblock(f) for f in staged_files)
    sanitized_log = _sanitize_for_codeblock(commit_log)
    sections = [
        prompt_text,
        "",
        "## コミット情報 (pre-commit review)",
        f"- ブランチ: {branch}",
        f"- マージ想定先: {base_ref}",
        "",
        "## ステージ済みファイル一覧",
        "```",
        sanitized_files,
        "```",
        "",
        f"## コミット一覧 (origin/{base_ref}..HEAD)",
        "```",
        sanitized_log,
        "```",
        "",
        "## diff",
        # _build_diff が既に各セクションを ```diff で囲んでいるため、ここでは追加しない。
        diff,
    ]
    return "\n".join(sections)


def _is_blocking(comment: dict[str, Any]) -> bool:
    # LOW/INFO 以外は unknown も含めて blocking 扱い (fail-closed)。
    severity = str(comment.get("severity", "")).upper().strip()
    return severity not in _LOW_SEVERITIES


def _decide(
    comments: list[dict[str, Any]],
    streak: int,
) -> tuple[bool, int, str]:
    if not comments:
        return True, 0, "指摘 0 件のため PASS"
    blocking = [c for c in comments if _is_blocking(c)]
    if blocking:
        return False, 0, f"blocking 指摘 {len(blocking)} 件を検出"
    # LOW-only。streak を進めて閾値に達したら抜ける。
    new_streak = streak + 1
    if new_streak >= _LOW_STREAK_THRESHOLD:
        return (
            True,
            new_streak,
            f"LOW のみ連続 {new_streak} 回目のため PASS (無限ループ回避)",
        )
    return (
        False,
        new_streak,
        f"LOW 指摘 {len(comments)} 件 (streak {new_streak}/{_LOW_STREAK_THRESHOLD})",
    )


def _format_issue(comment: dict[str, Any]) -> str:
    severity = str(comment.get("severity", "?")).upper()
    path = comment.get("path", "?")
    line = comment.get("line", "?")
    title = comment.get("title", "")
    body = comment.get("body", "")
    return f"[{severity}] {path}:{line} {title}\n    {body}"


def _run_engine(
    prompt: str,
    engine_path: pathlib.Path,
    engine_settings: dict[str, Any],
) -> tuple[int, str, str]:
    env = precommit_engine.build_env(os.environ, engine_settings)
    try:
        module_name = f"{engine_path.parent.name}.{engine_path.stem}"
        result = subprocess.run(
            [sys.executable, "-m", module_name, "--role", "review"],
            input=prompt,
            capture_output=True,
            text=True,
            check=False,
            env=env,
            timeout=_ENGINE_TIMEOUT_SECONDS,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        return -1, "", f"engine subprocess timed out after {_ENGINE_TIMEOUT_SECONDS}s"
    except (FileNotFoundError, OSError) as exc:
        return -1, "", f"failed to spawn engine: {exc}"
    return result.returncode, result.stdout, result.stderr


def _resolve_paths() -> tuple[pathlib.Path, pathlib.Path]:
    # プロンプトはプロジェクトローカル (.ame-review/) → パッケージ同梱へ解決される。
    # engine.py は常にパッケージ配下 (モジュール名解決用)。
    return paths.prompt_path(), paths.package_dir() / "engine.py"


def _print_issues(comments: list[dict[str, Any]]) -> None:
    if not comments:
        return
    print(file=sys.stderr)
    for c in comments:
        print(_format_issue(c), file=sys.stderr)
        print(file=sys.stderr)


def _run_static_checks(staged_files: list[str]) -> tuple[bool, str]:
    """Run ruff, mypy, and semgrep on staged files before LLM review.

    Returns (True, "") if all checks pass or no checks are available.
    Returns (False, message) if any check fails.
    """
    py_files = [f for f in staged_files if f.endswith((".py", ".pyi"))]

    proj_root = pathlib.Path(
        precommit_state.run_git(["rev-parse", "--show-toplevel"]).strip(),
    )
    if not proj_root.is_dir():
        proj_root = paths.project_root()

    checks: list[tuple[str, list[str]]] = []
    if py_files:
        checks.extend([
            ("ruff check", ["ruff", "check", "--force-exclude", *py_files]),
            (
                "ruff format",
                ["ruff", "format", "--check", "--force-exclude", *py_files],
            ),
            ("mypy", ["mypy", "--config-file", "pyproject.toml", *py_files]),
        ])

    ts_files = [
        f for f in staged_files if f.endswith((".ts", ".tsx", ".js", ".mjs", ".cjs"))
    ]
    if ts_files:
        checks.extend(review_config.get_ts_checks(ts_files))

    semgrep_binary = shutil.which("semgrep")
    if semgrep_binary is not None:
        semgrep_config = paths.semgrep_rules_path()
        if semgrep_config.exists():
            checks.append(
                (
                    "semgrep",
                    [
                        semgrep_binary,
                        "--config",
                        str(semgrep_config),
                        "--error",
                        *staged_files,
                    ],
                ),
            )
    else:
        print(
            "[precommit-review] static check 'semgrep' skipped (tool not found).",
            file=sys.stderr,
        )

    md_files = [f for f in staged_files if f.endswith((".md", ".markdown"))]
    if md_files:
        checks.append(
            (
                "mermaid-check",
                [
                    "python3",
                    "-m",
                    "ame_ai_review_system.mermaid_check",
                    *md_files,
                ],
            ),
        )

    if not checks:
        return True, ""

    for name, cmd in checks:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=_STATIC_CHECK_TIMEOUT_SECONDS,
                cwd=proj_root,
                encoding="utf-8",
                errors="replace",
            )
        except FileNotFoundError:
            print(
                f"[precommit-review] static check '{name}' skipped (tool not found).",
                file=sys.stderr,
            )
            continue
        except subprocess.TimeoutExpired:
            print(
                f"[precommit-review] static check '{name}' timed out.",
                file=sys.stderr,
            )
            continue
        if result.returncode != 0:
            detail = (result.stdout + result.stderr).strip()
            return False, f"{name}:\n{detail}"

    return True, ""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pre-commit AI code review hook.")
    parser.add_argument(
        "--base-ref",
        default=os.environ.get("BASE_REF", "main"),
        help="比較先の ref (default: main, env: BASE_REF)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="状態ファイルを更新せず常に exit 0 (確認用)",
    )
    args = parser.parse_args(argv)

    prompt_path, engine_path = _resolve_paths()

    cfg = review_config.load_config()
    if not cfg.get("precommit_review_enabled", True):
        print(
            "[precommit-review] disabled by config (precommit_review_enabled=false).",
            file=sys.stderr,
        )
        return 0

    branch = precommit_state.current_branch()
    if not branch:
        print("[precommit-review] not in a git repo; skipping.", file=sys.stderr)
        return 0
    if branch == "HEAD":
        print("[precommit-review] detached HEAD; skipping.", file=sys.stderr)
        return 0
    if not precommit_state.is_valid_branch(branch):
        print(
            f"[precommit-review] invalid branch name {branch!r}; skipping.",
            file=sys.stderr,
        )
        return 0

    raw_staged = _staged_files()
    if not raw_staged:
        # _staged_files は --diff-filter=d で削除を除くため、削除のみのステージは
        # ここに落ちる。削除は AI レビュー対象外である旨を明示する。
        deleted = precommit_state.run_git(
            ["diff", "--cached", "--name-only", "--diff-filter=D"],
        )
        deleted_files = [line for line in deleted.splitlines() if line.strip()]
        if deleted_files:
            print(
                f"[precommit-review] {len(deleted_files)} staged deletion(s); "
                "deletions are not AI-reviewed; skipping.",
                file=sys.stderr,
            )
        else:
            print("[precommit-review] no staged changes; skipping.", file=sys.stderr)
        return 0
    # Issue #37: 移植先で vendored した ame_ai_review_system 配下はレビュー対象外
    staged_files = review_config.filter_review_targets(raw_staged)
    if not staged_files:
        rel = review_config.review_exclusion_rel() or "ame_ai_review_system"
        print(
            f"[precommit-review] {len(raw_staged)} staged file(s) under "
            f"{rel} excluded (Issue #37); skipping.",
            file=sys.stderr,
        )
        return 0

    # base_ref も LLM プロンプトに埋め込むため、branch と同基準で検証する。
    if not precommit_state.is_valid_branch(args.base_ref):
        print(
            f"[precommit-review] invalid base_ref {args.base_ref!r}; skipping.",
            file=sys.stderr,
        )
        return 0

    # 前段の静的解析 (ruff / mypy) が全て pass した場合のみ AI レビューを実行する。
    # pre-commit フレームワークが既にフック順序を保証しているが、スクリプト単体実行時や
    # 防御策としても機能する。config.json の `precommit_require_static_checks` で ON/OFF 可能。
    if cfg.get("precommit_require_static_checks", True):
        passed, detail = _run_static_checks(staged_files)
        if not passed:
            print(
                f"[precommit-review] static analysis failed; "
                "skipping AI review.\n"
                f"{detail}",
                file=sys.stderr,
            )
            return 0 if args.dry_run else 1

    # base_ref のリモート追跡ブランチを fetch しておく。失敗時は diff が空になる。
    precommit_state.run_git(["fetch", "origin", args.base_ref, "--depth=1"])

    diff = _truncate_diff(_build_diff(args.base_ref))
    if not diff.strip():
        print("[precommit-review] no diff to review; skipping.", file=sys.stderr)
        return 0

    try:
        prompt_text = prompt_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"[precommit-review] cannot read prompt file: {exc}", file=sys.stderr)
        return 1

    prompt = _build_prompt(args.base_ref, branch, staged_files, diff, prompt_text)

    # cfg を再利用して二重読み込みを回避。
    engine_settings = precommit_engine.resolve_engine_settings(config=cfg)
    # Issue #40: エンジン情報 (engine/model/thinking) のバナーは
    # show_engine_info_gate1 が true のときのみ出力する (既定=表示)。
    if engine_settings.get("show_info", True):
        print(
            f"[precommit-review] running AI review on branch '{branch}' "
            f"(staged files: {len(staged_files)}; "
            f"engine={engine_settings['engine']}, "
            f"model={engine_settings['model'] or '<engine-default>'}, "
            f"thinking={engine_settings['thinking']})...",
            file=sys.stderr,
        )

    exit_code, output, engine_err = _run_engine(prompt, engine_path, engine_settings)
    if engine_err.strip():
        # エンジンスタブに API キーや内部パスが含まれる可能性があるため、
        # プレフィックスを付けて開発者端末への露出を明確にする。
        for line in engine_err.splitlines():
            print(f"[engine] {line}", file=sys.stderr)
    # fail-closed 原則だが、LLM API のレート制限や一時障害で永遠にコミットできなくなるのを
    # 避けるため、エンジン失敗は engine_failure_streak に計上し 3 回連続で escape する。
    # low_only_streak とは独立カウンタで混在を防ぐ。
    if exit_code != 0 or not output.strip():
        state_path = precommit_state.state_file_path()
        state = precommit_state.read_state(state_path)
        streak = precommit_state.get_streak(
            state,
            branch,
            key="engine_failure_streak",
        )
        new_streak = streak + 1
        if not args.dry_run:
            precommit_state.set_streak(
                state,
                branch,
                new_streak,
                key="engine_failure_streak",
            )
            precommit_state.write_state(state_path, state)
        if new_streak >= _ENGINE_FAILURE_STREAK_THRESHOLD:
            print(
                f"[precommit-review] engine failed (exit={exit_code}) but "
                f"streak {new_streak}/{_ENGINE_FAILURE_STREAK_THRESHOLD} reached; "
                "allowing commit (escape hatch).",
                file=sys.stderr,
            )
            return 0
        print(
            f"[precommit-review] engine failed (exit={exit_code}); "
            f"blocking commit (fail-closed). streak {new_streak}/"
            f"{_ENGINE_FAILURE_STREAK_THRESHOLD} — 連続で失敗すると escape します。",
            file=sys.stderr,
        )
        return 0 if args.dry_run else 1

    # payload.parse_review_json はファイルパスを要求するため一時ファイルへ。
    # mkstemp + try/finally で「生成から削除まで」を一括管理し、write 失敗時のリークを防ぐ。
    review_fd, review_name = tempfile.mkstemp(suffix=".json")
    review_tmp = pathlib.Path(review_name)
    try:
        try:
            fh = os.fdopen(review_fd, mode="w", encoding="utf-8")
        except OSError:
            os.close(review_fd)
            raise
        with fh:
            fh.write(output)
        review, is_fallback = payload.parse_review_json_with_flag(
            str(review_tmp),
            repair=lambda broken: payload.repair_review_json(
                broken,
                lambda p: payload.engine_output_text(
                    _run_engine(
                        p,
                        engine_path,
                        review_config.apply_repair_model(engine_settings),
                    ),
                ),
            ),
        )
    finally:
        review_tmp.unlink(missing_ok=True)

    # 不正 JSON で parse が fallback した場合、フォールバックは comments=[]
    # となり PASS 扱いになる。これは fail-closed ポリシーに違反するためブロックする。
    if is_fallback:
        print(
            "[precommit-review] engine output could not be parsed as JSON; "
            "blocking commit (fail-closed).",
            file=sys.stderr,
        )
        return 1

    # comments キーが欠損 / 非 list の場合も不正出力としてブロックする (fail-closed)。
    if "comments" not in review or not isinstance(review.get("comments"), list):
        print(
            "[precommit-review] engine output has invalid 'comments' field; "
            "blocking commit (fail-closed).",
            file=sys.stderr,
        )
        return 1
    filtered_comments: list[dict[str, Any]] = [
        c for c in review["comments"] if isinstance(c, dict)
    ]

    state_path = precommit_state.state_file_path()
    state = precommit_state.read_state(state_path)
    # エンジンが正常応答したので engine_failure_streak をリセットする。
    # これにより「連続失敗」の語義が保たれる (失敗 → 成功 → 失敗 で streak は 1 に戻る)。
    precommit_state.set_streak(state, branch, 0, key="engine_failure_streak")
    streak = precommit_state.get_streak(state, branch)

    allow, new_streak, reason = _decide(filtered_comments, streak)

    print(f"[precommit-review] {reason}", file=sys.stderr)
    summary = str(review.get("summary", "")).strip()
    if summary:
        print(f"[precommit-review] summary: {summary}", file=sys.stderr)
    _print_issues(filtered_comments)

    if args.dry_run:
        print(
            f"[precommit-review] dry-run: would set streak={new_streak}, allow={allow}",
            file=sys.stderr,
        )
        return 0

    precommit_state.set_streak(state, branch, new_streak)
    precommit_state.write_state(state_path, state)

    if allow:
        print("[precommit-review] commit allowed.", file=sys.stderr)
        return 0
    remaining = _LOW_STREAK_THRESHOLD - new_streak
    print(
        "[precommit-review] commit BLOCKED. 修正して再 add するか、"
        f"LOW 指摘のみが続く場合はあと {remaining} 回で抜けられます。",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
