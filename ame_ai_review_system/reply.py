"""PR review reply: prompt builder and Claude output parser.

サブコマンド:
  build <pr_number> <thread_id>   スレッドの親コメント + 返信一覧 + diff からプロンプトを
                                    stdout へ出力する。
                                    対応不要なスレッドは空文字を出力して exit 0。
  parse <claude_out_path>          Claude の JSON 出力から {"body": "..."} を
                                    stdout へ出力する。
  pending <pr_number>              返信待ちスレッドの id を JSON 配列で stdout へ。
                                    条件: @<reviewer_name> 宛て最新 mention 後に
                                          reviewer が未返信。
  stale-check <pr_number> <thread_id>  スレッドが stale-loop 状態か判定 (stale/ok)
  run <pr_number>                  全保留スレッドに返信を投稿するオーケストレーション
"""

from __future__ import annotations

import contextlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
from typing import Any, cast

from . import engine, github_client, review_config

_DEFAULT_LGTM = "対応確認しました。LGTM ✅ Resolve してください。"

_HTTP_STATUS_OK = 200

_REVIEWS_PAGE_SIZE = 50

_STALE_JACCARD_THRESHOLD = 0.80
_STALE_MIN_NGRAMS = 4
_TRIGRAM_SIZE = 3
_MIN_COMMENTS_FOR_STALE = 2

_REQUIRED_ARGS_BUILD = 4
_REQUIRED_ARGS_PARSE = 3
_REQUIRED_ARGS_PENDING = 3
_REQUIRED_ARGS_STALE_CHECK = 4
_REQUIRED_ARGS_RUN = 3
_MIN_ARGS = 2


# ============================================================================
# Thread comment fetching
# ============================================================================


def _get_thread_comments(
    api_url: str,
    repo: str,
    pr: str,
    token: str,
) -> list[dict[str, Any]]:
    """Return all inline review comments on the PR, flattened."""
    comments: list[dict[str, Any]] = []
    page = 1
    while True:
        page_data: list[dict[str, Any]] = github_client.http_request(
            "GET",
            f"{api_url}/repos/{repo}/pulls/{pr}"
            f"/comments?per_page={_REVIEWS_PAGE_SIZE}&page={page}",
            token,
        )
        if not page_data:
            break
        comments.extend(page_data)
        if len(page_data) < _REVIEWS_PAGE_SIZE:
            break
        page += 1
    return comments


def _group_by_thread(comments: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    """GitHub の in_reply_to_id に基づき、スレッド単位でコメントをグルーピングする.

    戻り値は {ルートコメント id: [ルート, *返信（created_at 昇順）]}。
    """
    threads: dict[int, list[dict[str, Any]]] = {
        int(c["id"]): [c] for c in comments if c.get("in_reply_to_id") is None
    }
    for c in comments:
        parent_id = c.get("in_reply_to_id")
        if parent_id is None:
            continue
        thread = threads.get(int(parent_id))
        if thread is not None:
            thread.append(c)
    for thread in threads.values():
        thread.sort(key=lambda x: x.get("created_at", ""))
    return threads


def _find_thread(
    comments: list[dict[str, Any]],
    thread_id: int,
) -> list[dict[str, Any]] | None:
    return _group_by_thread(comments).get(thread_id)


def _resolved_root_ids(pr_number: int, token: str) -> set[int]:
    """Resolve 済みスレッドに属するコメント databaseId 集合を GraphQL 経由で取得する."""
    resolved: set[int] = set()
    for thread in github_client.list_review_threads(pr_number, token):
        if not thread.get("isResolved"):
            continue
        for c in thread["comments"]["nodes"]:
            database_id = c.get("databaseId")
            if database_id is not None:
                resolved.add(int(database_id))
    return resolved


def _get_pr_diff(
    base_ref: str,
    api_url: str = "",
    repo: str = "",
    pr: str = "",
    token: str = "",
) -> str:
    """Get PR diff via GitHub content negotiation or git diff."""
    from . import diff_utils

    max_diff_lines = 4000

    if api_url and repo and pr and token:
        try:
            raw = github_client.http_request(
                "GET",
                f"{api_url}/repos/{repo}/pulls/{pr}",
                token,
                accept="application/vnd.github.diff",
            )
        except RuntimeError:
            raw = None
        if raw:
            raw = diff_utils.compact_diff(raw)
            # Issue #37: 移植先で vendored した ame_ai_review_system 配下はレビュー対象外
            raw = review_config.filter_review_diff(raw)
            all_lines = raw.splitlines()
            if len(all_lines) > max_diff_lines:
                return (
                    "\n".join(all_lines[:max_diff_lines])
                    + f"\n... (truncated, {len(all_lines)} lines total)"
                )
            return raw

    if not re.match(r"^[a-zA-Z0-9/_-]+$", base_ref):
        print(f"[get_pr_diff] Invalid base_ref: {base_ref!r}", file=sys.stderr)
        return ""
    try:
        result = subprocess.check_output(
            ["git", "diff", f"origin/{base_ref}...HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        try:
            result = subprocess.check_output(
                ["git", "diff", "HEAD~1"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
            return ""
    result = diff_utils.compact_diff(result)
    # Issue #37: 移植先で vendored した ame_ai_review_system 配下はレビュー対象外
    result = review_config.filter_review_diff(result)
    all_lines = result.splitlines()
    if len(all_lines) > max_diff_lines:
        return (
            "\n".join(all_lines[:max_diff_lines])
            + f"\n... (truncated, {len(all_lines)} lines total)"
        )
    return result


# ============================================================================
# Stale loop detection
# ============================================================================


def _trigrams(text: str) -> set[str]:
    text = text.lower().strip()
    if len(text) < _TRIGRAM_SIZE:
        return {text} if text else set()
    return {text[i : i + _TRIGRAM_SIZE] for i in range(len(text) - (_TRIGRAM_SIZE - 1))}


def is_stale_loop(comment_bodies: list[str]) -> bool:
    """Detect stale-loop: reviewer repeating the same feedback with slight variations.

    直近2件のコメントの文字トリグラム Jaccard 類似度が閾値以上の場合に True を返す。
    日本語テキストに対応するため単語分割ではなくトリグラムを使用する。
    トリグラム数が 4 未満の短いコメントは完全一致で判定する。
    """
    if len(comment_bodies) < _MIN_COMMENTS_FOR_STALE:
        return False

    g1 = _trigrams(comment_bodies[-2])
    g2 = _trigrams(comment_bodies[-1])

    if not g1 or not g2:
        return False

    if len(g1) < _STALE_MIN_NGRAMS or len(g2) < _STALE_MIN_NGRAMS:
        return g1 == g2

    jaccard = len(g1 & g2) / len(g1 | g2)
    return jaccard >= _STALE_JACCARD_THRESHOLD


# ============================================================================
# Pending threads
# ============================================================================


def _thread_is_pending(
    root_id: int,
    thread: list[dict[str, Any]] | None,
    resolved_ids: set[int],
    reviewer_name: str,
) -> bool:
    """1 スレッドが返信待ち状態かを判定する（_get_pending_threads と同一基準）."""
    if thread is None or root_id in resolved_ids:
        return False

    replies = thread[1:]

    mention_replies = [
        r
        for r in replies
        if github_client.mentions_reviewer(r.get("body", ""), reviewer_name)
    ]
    if not mention_replies:
        return False

    latest_mention_time = max(r.get("created_at", "") for r in mention_replies)
    reviewer_replied_after = any(
        r.get("user", {}).get("login") == github_client.bot_login(reviewer_name)
        and r.get("created_at", "") > latest_mention_time
        for r in replies
    )
    return not reviewer_replied_after


def _get_pending_threads(
    api_url: str,
    repo: str,
    pr: str,
    token: str,
    reviewer_name: str,
) -> list[int]:
    """Return list of pending thread IDs (root comment IDs)."""
    comments = _get_thread_comments(api_url, repo, pr, token)
    threads = _group_by_thread(comments)
    resolved_ids = _resolved_root_ids(int(pr), token)

    return [
        root_id
        for root_id, thread in threads.items()
        if _thread_is_pending(root_id, thread, resolved_ids, reviewer_name)
    ]


def _root_id_for_comment(
    comments: list[dict[str, Any]],
    comment_id: int,
) -> int | None:
    """トリガーコメントを含むスレッドのルートコメント ID を返す.

    対象が見つからない（PR 本文コメント等の非インライン）場合は None。
    """
    for root_id, thread in _group_by_thread(comments).items():
        if any(int(c["id"]) == comment_id for c in thread):
            return root_id
    return None


def _thread_still_pending(
    api_url: str,
    repo: str,
    pr: str,
    thread_id: int,
    token: str,
    reviewer_name: str,
) -> bool:
    """投稿直前用の保留再チェック。並走実行でレビュアーが返信済みなら False."""
    comments = _get_thread_comments(api_url, repo, pr, token)
    thread = _find_thread(comments, thread_id)
    resolved_ids = _resolved_root_ids(int(pr), token)
    return _thread_is_pending(thread_id, thread, resolved_ids, reviewer_name)


# ============================================================================
# Commands: build, parse, pending, stale-check
# ============================================================================


def _cmd_build(pr: str, thread_id_str: str) -> None:
    api_url, repo = github_client.resolve_env()
    token = os.environ.get("REVIEWER_TOKEN", "")
    reviewer_name = os.environ.get("REVIEWER_NAME", "ame-ai-reviewer")
    base_ref = os.environ.get("BASE_REF", "main")

    thread_id = int(thread_id_str)
    comments = _get_thread_comments(api_url, repo, pr, token)

    thread = _find_thread(comments, thread_id)
    if thread is None:
        print(f"[build] thread {thread_id} not found", file=sys.stderr)
        return
    parent = thread[0]
    replies = thread[1:]

    mention_replies = [
        r
        for r in replies
        if github_client.mentions_reviewer(r.get("body", ""), reviewer_name)
    ]
    if not mention_replies:
        return
    latest_reply = mention_replies[-1]

    diff = _get_pr_diff(base_ref, api_url=api_url, repo=repo, pr=pr, token=token)

    prompt_lines = [
        f"あなたは厳格なコードレビュアー ({reviewer_name}) です。",
        "開発者があなたのレビューコメントに返信しました。",
        "実際の diff と返信内容を確認し、指摘した問題が本当に修正されているか判断してください。",
        "",
        "## 判断基準",
        "- diff を見て、指摘した問題が実際にコード上で修正されている → LGTM",
        "- diff に修正がなく返信だけ → 修正されているか慎重に確認する",
        "- LOW / INFO (🟢) の指摘は、理由の説明があれば対応不要でも LGTM",
        "- 修正が不十分または的外れ → 具体的に何が不足しているか指摘する",
        "",
        "## 出力フォーマット（JSON のみ。前後に余計な文字は不要）",
        '{"lgtm": true, "reply": "返信本文（日本語）"}',
        "",
        f'LGTM の場合は reply = "{_DEFAULT_LGTM}"',
        "LGTM でない場合は reply に不足点を具体的に記載（どのファイルの何行目を直すべきか）",
        "",
        "=== 以下、動的コンテキスト（プロンプトキャッシュ境界） ===",
        "## 元のレビューコメント（あなたの指摘）",
        f"ファイル: {parent.get('path', '')}",
        parent.get("body", ""),
        "",
        "## 開発者の返信",
        latest_reply.get("body", ""),
    ]

    if diff:
        prompt_lines += [
            "",
            "## PR の diff（修正内容）",
            "```diff",
            diff,
            "```",
        ]

    print("\n".join(prompt_lines))


def _cmd_parse(claude_out_path: str) -> None:
    raw = pathlib.Path(claude_out_path).read_text(encoding="utf-8").strip()

    try:
        outer: Any = json.loads(raw)
        if (
            isinstance(outer, dict)
            and cast("str | None", cast("dict[str, Any]", outer).get("type"))
            == "result"
        ):
            result_val = cast("str | None", cast("dict[str, Any]", outer).get("result"))
            if isinstance(result_val, str):
                raw = result_val
    except json.JSONDecodeError:
        pass

    parsed = _extract_json(raw)
    if parsed is not None:
        reply_body = str(parsed.get("reply", _DEFAULT_LGTM))
    else:
        print(
            f"[parse] JSON extraction failed. Raw preview:\n{raw[:300]}",
            file=sys.stderr,
        )
        reply_body = _DEFAULT_LGTM

    print(json.dumps({"body": reply_body}))


def _cmd_pending(pr: str) -> None:
    api_url, repo = github_client.resolve_env()
    token = os.environ.get("REVIEWER_TOKEN", "")
    reviewer_name = os.environ.get("REVIEWER_NAME", "ame-ai-reviewer")

    pending = _get_pending_threads(api_url, repo, pr, token, reviewer_name)
    print(json.dumps(pending))


def _cmd_stale_check(pr: str, thread_id_str: str) -> None:
    api_url, repo = github_client.resolve_env()
    token = os.environ.get("REVIEWER_TOKEN", "")
    reviewer_name = os.environ.get("REVIEWER_NAME", "ame-ai-reviewer")

    thread_id = int(thread_id_str)
    comments = _get_thread_comments(api_url, repo, pr, token)

    thread = _find_thread(comments, thread_id)
    if thread is None:
        print("ok")
        return

    reviewer_replies = [
        str(c.get("body", ""))
        for c in thread[1:]
        if c.get("user", {}).get("login") == github_client.bot_login(reviewer_name)
    ]

    if is_stale_loop(reviewer_replies):
        print("stale")
    else:
        print("ok")


# ============================================================================
# JSON extraction
# ============================================================================


def _extract_json(raw: str) -> dict[str, Any] | None:
    """Extract first valid JSON object from raw string using multiple strategies."""
    # Strategy 1: ```json or ``` code fence
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if m:
        try:
            return cast("dict[str, Any]", json.loads(m.group(1).strip()))
        except json.JSONDecodeError:
            pass

    # Strategy 2: brace-depth tracking for outermost {...}
    depth = 0
    start_idx = -1
    for i, ch in enumerate(raw):
        if ch == "{":
            if depth == 0:
                start_idx = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start_idx != -1:
                try:
                    return cast("dict[str, Any]", json.loads(raw[start_idx : i + 1]))
                except json.JSONDecodeError:
                    start_idx = -1
    return None


# ============================================================================
# Run command (orchestration from pr_review_reply.sh)
# ============================================================================


def _post_reply(
    api_url: str,
    repo: str,
    pr_number: int,
    thread_id: int,
    token: str,
    body: str,
) -> int:
    """Post a reply to a review thread. Returns HTTP status code."""
    url = f"{api_url}/repos/{repo}/pulls/{pr_number}/comments/{thread_id}/replies"
    try:
        github_client.http_request("POST", url, token, body={"body": body})
    except RuntimeError as e:
        print(f"[reply] Failed to post reply: {e}", file=sys.stderr)
        return 0
    else:
        return _HTTP_STATUS_OK


def _run_engine(prompt: str, *, show_info: bool = True) -> tuple[int, str]:
    """Run engine.py with prompt, return (exit_code, stdout)."""
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix="_prompt.txt",
        delete=False,
        encoding="utf-8",
    ) as pf:
        pf.write(prompt)
        prompt_file = pf.name

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix="_out.txt",
        delete=False,
        encoding="utf-8",
    ) as of:
        out_file = of.name

    err_file = out_file + ".err"

    # Issue #40: Gate 2 のエンジン情報バナー表示フラグを子プロセスへ注入する。
    engine_env = dict(os.environ)
    engine.apply_engine_info_env(engine_env, show_info=show_info)

    try:
        with (
            pathlib.Path(prompt_file).open("r", encoding="utf-8") as pfi,
            pathlib.Path(out_file).open("w", encoding="utf-8") as fout,
            pathlib.Path(err_file).open("w", encoding="utf-8") as efi,
        ):
            proc = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "ame_ai_review_system.engine",
                    "--role",
                    "reply",
                ],
                stdin=pfi,
                stdout=fout,
                stderr=efi,
                env=engine_env,
                timeout=600,
                check=False,
            )
        engine_exit = proc.returncode

        stdout = pathlib.Path(out_file).read_text(encoding="utf-8")
        stderr = pathlib.Path(err_file).read_text(encoding="utf-8")

        if stderr:
            print(f"[reply] Engine stderr: {stderr}", file=sys.stderr)

        return engine_exit, stdout
    finally:
        for f in (prompt_file, out_file, err_file):
            with contextlib.suppress(OSError):
                pathlib.Path(f).unlink()


def _check_stale(
    api_url: str,
    repo: str,
    pr: str,
    thread_id_str: str,
    token: str,
    reviewer_name: str,
) -> str:
    thread_id = int(thread_id_str)
    comments = _get_thread_comments(api_url, repo, pr, token)

    thread = _find_thread(comments, thread_id)
    if thread is None:
        return "ok"

    reviewer_replies = [
        str(c.get("body", ""))
        for c in thread[1:]
        if c.get("user", {}).get("login") == github_client.bot_login(reviewer_name)
    ]

    if is_stale_loop(reviewer_replies):
        return "stale"
    return "ok"


def _build_prompt_for_thread(
    api_url: str,
    repo: str,
    pr: str,
    thread_id_str: str,
    token: str,
    reviewer_name: str,
    base_ref: str,
) -> str:
    thread_id = int(thread_id_str)
    comments = _get_thread_comments(api_url, repo, pr, token)

    thread = _find_thread(comments, thread_id)
    if thread is None:
        print(f"[reply] thread {thread_id} not found", file=sys.stderr)
        return ""
    parent = thread[0]
    replies = thread[1:]

    mention_replies = [
        r
        for r in replies
        if github_client.mentions_reviewer(r.get("body", ""), reviewer_name)
    ]
    if not mention_replies:
        return ""
    latest_reply = mention_replies[-1]

    diff = _get_pr_diff(base_ref, api_url=api_url, repo=repo, pr=pr, token=token)

    prompt_lines = [
        f"あなたは厳格なコードレビュアー ({reviewer_name}) です。",
        "開発者があなたのレビューコメントに返信しました。",
        "実際の diff と返信内容を確認し、指摘した問題が本当に修正されているか判断してください。",
        "",
        "## 判断基準",
        "- diff を見て、指摘した問題が実際にコード上で修正されている → LGTM",
        "- diff に修正がなく返信だけ → 修正されているか慎重に確認する",
        "- LOW / INFO (🟢) の指摘は、理由の説明があれば対応不要でも LGTM",
        "- 修正が不十分または的外れ → 具体的に何が不足しているか指摘する",
        "",
        "## 出力フォーマット（JSON のみ。前後に余計な文字は不要）",
        '{"lgtm": true, "reply": "返信本文（日本語）"}',
        "",
        f'LGTM の場合は reply = "{_DEFAULT_LGTM}"',
        "LGTM でない場合は reply に不足点を具体的に記載（どのファイルの何行目を直すべきか）",
        "",
        "=== 以下、動的コンテキスト（プロンプトキャッシュ境界） ===",
        "## 元のレビューコメント（あなたの指摘）",
        f"ファイル: {parent.get('path', '')}",
        parent.get("body", ""),
        "",
        "## 開発者の返信",
        latest_reply.get("body", ""),
    ]

    if diff:
        prompt_lines += [
            "",
            "## PR の diff（修正内容）",
            "```diff",
            diff,
            "```",
        ]

    return "\n".join(prompt_lines)


def _process_thread(
    api_url: str,
    repo: str,
    pr_number: int,
    thread_id: int,
    token: str,
    reviewer_name: str,
    base_ref: str,
    *,
    show_info: bool = True,
) -> None:
    """1 スレッドへの LGTM / 追加指摘投稿を実行する."""
    if not _thread_still_pending(
        api_url, repo, str(pr_number), thread_id, token, reviewer_name
    ):
        print(f"[reply] Thread {thread_id} no longer pending, skip.")
        return

    stale_status = _check_stale(
        api_url,
        repo,
        str(pr_number),
        str(thread_id),
        token,
        reviewer_name,
    )
    if stale_status == "stale":
        print(f"[reply] Thread {thread_id} is in stale-loop. Forcing LGTM.")
        body = _DEFAULT_LGTM
    else:
        # Build prompt
        prompt = _build_prompt_for_thread(
            api_url,
            repo,
            str(pr_number),
            str(thread_id),
            token,
            reviewer_name,
            base_ref,
        )

        if not prompt:
            print(f"[reply] Prompt empty for thread {thread_id}, skip.")
            return

        # Run engine
        engine_exit, engine_out = _run_engine(prompt, show_info=show_info)

        if engine_exit != 0 or not engine_out.strip():
            print("[reply] Engine failed, using default LGTM.")
            body = (
                "⚠️ エンジンエラーにより自動 LGTM しています。内容を確認してください。"
            )
        else:
            # Parse output
            parsed = _extract_json(engine_out)
            if parsed:
                body = str(parsed.get("reply", _DEFAULT_LGTM))
            else:
                print(
                    f"[reply] JSON extraction failed: {engine_out[:300]}",
                    file=sys.stderr,
                )
                body = _DEFAULT_LGTM

    # 投稿直前の最新状態で並走実行による重複 LGTM を防ぐ (Issue #39)。
    # チェック〜投稿間の残存 TOCTOU 窓は許容する。同一 PR の並走を concurrency
    # で直列化しないのは、投稿遅延を避けるため (設計判断)。
    if not _thread_still_pending(
        api_url, repo, str(pr_number), thread_id, token, reviewer_name
    ):
        print(f"[reply] Thread {thread_id} already replied meanwhile, skip.")
        return

    status = _post_reply(api_url, repo, pr_number, thread_id, token, body)
    print(f"[reply] Thread {thread_id} → HTTP {status}.")


def _cmd_run(pr_number_str: str) -> None:
    api_url, repo = github_client.resolve_env()
    token = os.environ.get("REVIEWER_TOKEN", "")
    reviewer_name = os.environ.get("REVIEWER_NAME", "ame-ai-reviewer")
    base_ref = os.environ.get("BASE_REF", "main")
    pr_number = int(pr_number_str)

    if not token:
        print("[reply] ERROR: REVIEWER_TOKEN not set", file=sys.stderr)
        return

    trigger_comment_id = os.environ.get("TRIGGER_COMMENT_ID", "").strip()

    # Issue #40: Gate 2 の表示トグルは run 入口で一度だけ読み、スレッド処理へ渡す。
    show_info = review_config.config_bool(
        review_config.load_config(),
        "show_engine_info_gate2",
        default=True,
    )

    if trigger_comment_id:
        # スコープモード: トリガーとなったインライン返信のスレッドだけに返信する (Issue #39)
        print(f"[reply] Scoped to trigger comment {trigger_comment_id}...")
        if not trigger_comment_id.isdigit():
            print(
                f"[reply] WARNING: Invalid TRIGGER_COMMENT_ID '{trigger_comment_id}', skip.",
                file=sys.stderr,
            )
            print("[reply] Done.")
            return
        comments = _get_thread_comments(api_url, repo, str(pr_number), token)
        root_id = _root_id_for_comment(comments, int(trigger_comment_id))
        if root_id is None:
            print(
                f"[reply] Trigger comment {trigger_comment_id} is not in an inline "
                "review thread, skip.",
                file=sys.stderr,
            )
            print("[reply] Done.")
            return
        # 保留判定は _process_thread 冒頭の _thread_still_pending に一本化し、
        # ここでの二重チェックによる API 重複を避ける (指摘対応)。
        print(f"[reply] Processing thread {root_id}...")
        _process_thread(
            api_url,
            repo,
            pr_number,
            root_id,
            token,
            reviewer_name,
            base_ref,
            show_info=show_info,
        )
    else:
        # レガシーモード: TRIGGER_COMMENT_ID 未設定時は全保留スレッドへ返信 (手動実行専用)。
        # CI 経路は常にスコープモードのため、ここは API の N+1 再取得を許容する。
        # スレッド毎に最新状態を再確認するのは投稿前の正確性 (並走対策) を優先するため。
        print(f"[reply] Scanning PR #{pr_number} for pending reply threads...")
        pending = _get_pending_threads(
            api_url,
            repo,
            str(pr_number),
            token,
            reviewer_name,
        )
        pending_count = len(pending)

        if pending_count == 0:
            print("[reply] No pending threads, done.")
            return

        print(f"[reply] {pending_count} thread(s) need reply.")

        for thread_id in pending:
            if not str(thread_id).isdigit():
                print(f"[reply] WARNING: Invalid THREAD_ID '{thread_id}', skip.")
                continue

            print(f"[reply] Processing thread {thread_id}...")
            _process_thread(
                api_url,
                repo,
                pr_number,
                thread_id,
                token,
                reviewer_name,
                base_ref,
                show_info=show_info,
            )

    print("[reply] Done.")


# ============================================================================
# Main entrypoint
# ============================================================================


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv

    if len(argv) < _MIN_ARGS:
        sys.exit("Usage: reply.py build|parse|pending|stale-check|run ...")

    cmd = argv[1]
    if cmd == "build":
        if len(argv) < _REQUIRED_ARGS_BUILD:
            sys.exit("Usage: reply.py build <pr_number> <thread_id>")
        _cmd_build(argv[2], argv[3])
    elif cmd == "parse":
        if len(argv) < _REQUIRED_ARGS_PARSE:
            sys.exit("Usage: reply.py parse <claude_out_path>")
        _cmd_parse(argv[2])
    elif cmd == "pending":
        if len(argv) < _REQUIRED_ARGS_PENDING:
            sys.exit("Usage: reply.py pending <pr_number>")
        _cmd_pending(argv[2])
    elif cmd == "stale-check":
        if len(argv) < _REQUIRED_ARGS_STALE_CHECK:
            sys.exit("Usage: reply.py stale-check <pr_number> <thread_id>")
        _cmd_stale_check(argv[2], argv[3])
    elif cmd == "run":
        if len(argv) < _REQUIRED_ARGS_RUN:
            sys.exit("Usage: reply.py run <pr_number>")
        _cmd_run(argv[2])
    else:
        sys.exit(f"Unknown command: {cmd}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
