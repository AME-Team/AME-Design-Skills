"""JSON review payload builder for pr_review.sh."""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from collections.abc import Callable

_FALLBACK: dict[str, Any] = {
    "summary": "AIレビューの出力をJSONとして解析できませんでした。",
    "comments": [],
}


def _parse_review_text(raw: str) -> tuple[dict[str, Any], bool]:
    """生テキストからレビュー JSON を抽出する (成功時は (review, False))."""
    # 出力形式が旧エンベロープ({"type":"result","result":"..."})に戻った場合でも
    # レビューが壊れないよう、result 文字列を取り出して下流へ渡す。
    try:
        outer_raw = json.loads(raw)
        if isinstance(outer_raw, dict):
            outer: dict[str, Any] = cast("dict[str, Any]", outer_raw)
            if outer.get("type") == "result":
                result_val = outer.get("result")
                if not isinstance(result_val, str):
                    print(
                        f"[parse_review_json] result field is not a string: "
                        f"{type(result_val).__name__}",
                        file=sys.stderr,
                    )
                    return _FALLBACK, True
                raw = result_val
    except json.JSONDecodeError:
        pass

    # Try ```json or plain ``` code fence (Claude may or may not include language tag)
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if m:
        candidate = m.group(1).strip()
        try:
            return cast("dict[str, Any]", json.loads(candidate)), False
        except json.JSONDecodeError:
            pass

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
                    return (
                        cast("dict[str, Any]", json.loads(raw[start_idx : i + 1])),
                        False,
                    )
                except json.JSONDecodeError:
                    start_idx = -1

    return _FALLBACK, True


def _try_parse_with_structural_repair(raw: str) -> tuple[dict[str, Any], bool]:
    """パースを試み、失敗時はツール呼び出し構文を除去して再パースする."""
    review, is_fallback = _parse_review_text(raw)
    if is_fallback:
        cleaned = _strip_tool_call_syntax(raw)
        if cleaned != raw:
            review, is_fallback = _parse_review_text(cleaned)
    return review, is_fallback


_MAX_REPAIR_ATTEMPTS = 2


def parse_review_json_with_flag(
    path: str,
    repair: Callable[[str], str | None] | None = None,
) -> tuple[dict[str, Any], bool]:
    """レビュー JSON を解析する.

    ``repair`` は初期解析に失敗したときに呼ばれ、壊れた出力を修復したテキストを
    返す (``None`` なら修復不可)。修復は最大 ``_MAX_REPAIR_ATTEMPTS`` 回再試行し、
    それでも解析できない場合は ``(fallback, True)``。
    """
    raw = pathlib.Path(path).read_text(encoding="utf-8").strip()

    review, is_fallback = _try_parse_with_structural_repair(raw)
    if is_fallback and repair is not None:
        # 構造的修復済みの元テキストを修復入力に使う。前回の修復出力を繋ぐと
        # JSON 断片が失われエラーが増幅されるため、毎回同じ入力を再送する。
        base = _strip_tool_call_syntax(raw)
        attempts = 0
        while is_fallback and attempts < _MAX_REPAIR_ATTEMPTS:
            repaired = repair(base)
            attempts += 1
            if not repaired or not repaired.strip():
                break
            # 修復出力にもツール呼び出し構文が残ることがあるため、毎回構造的修復を通す。
            review, is_fallback = _try_parse_with_structural_repair(
                repaired.strip(),
            )

    if is_fallback:
        preview = raw[:500]
        print(
            f"[parse_review_json] JSON extraction failed. Raw preview (500 chars):\n{preview}",
            file=sys.stderr,
        )
    return review, is_fallback


def build_repair_prompt(broken: str) -> str:
    """壊れたレビュー出力から JSON を復元する修復用プロンプトを組み立てる."""
    # 弱いモデルはツール呼び出し構文や余計な前後テキストを付けて JSON を壊すことがある。
    # 修復用プロンプトは小さく保ち、スキーマを明示して JSON のみを返させる。
    # 埋め込み前にバックティックを ``·`` (U+00B7) へ置換し、````` ``` ```` フェンスを
    # 途中で閉じたり、``\u201e`` の連続と紛れないようにする。
    safe = broken.replace("`", "\u00b7")
    return (
        "あなたは JSON 修復のアシスタントです。\n"
        "以下は AI コードレビューの出力ですが、JSON として壊れています。\n"
        "ツール呼び出しや余計な前後テキストを除去し、有効な JSON オブジェクトだけを出力してください。\n"
        'スキーマ: {"summary": string, "comments": [{"path": string, "line": int, '
        '"severity": string, "title": string, "body": string}]}\n'
        "出力は JSON のみ。コードフェンスや説明は不要。\n\n"
        "## 壊れた出力\n```\n" + safe[:12000] + "\n```"
    )


# 弱いモデルが JSON の代わりに出力するツール呼び出し構文 (Anthropic 形式 / DeepSeek 形式)。
_TOOL_CALL_BLOCK_RE = re.compile(r"<tool_calls>[\s\S]*?</tool_calls>")
_INVOKE_BLOCK_RE = re.compile(r"<invoke\s+name=\"[^\"]*\">[\s\S]*?</invoke>")
# DeepSeek のツール呼び出しマーカー (U+FF5C FULLWIDTH VERTICAL LINE)。
_FULLWIDTH_MARKER_RE = re.compile("\uff5c\uff5c" + r"[\s\S]*?" + "\uff5c\uff5c")


def _strip_tool_call_syntax(raw: str) -> str:
    """ツール呼び出しブロックを除去して JSON 抽出の成功確率を上げる (構造的修復)."""
    stripped = _TOOL_CALL_BLOCK_RE.sub("", raw)
    stripped = _INVOKE_BLOCK_RE.sub("", stripped)
    # ツール呼び出しブロックが検出された場合のみ全幅マーカーを除去する。
    # パース失敗の原因がツール呼び出しと無関係な場合に、JSON 本文の Markdown
    # 装飾 (全幅縦棒等) を誤って壊さないようにする。
    if stripped != raw:
        return _FULLWIDTH_MARKER_RE.sub("", stripped)
    return stripped


def repair_review_json(
    broken: str,
    run_engine: Callable[[str], str | None],
) -> str | None:
    """壊れたレビュー JSON を ``run_engine`` で修復する。失敗時は ``None``。."""
    repaired = run_engine(build_repair_prompt(broken))
    if repaired and repaired.strip():
        return repaired.strip()
    return None


def engine_output_text(engine_result: tuple[int, str, str]) -> str | None:
    """エンジン呼び出し結果 (exit, stdout, stderr) から有効な出力テキストを取り出す."""
    exit_code, output, _err = engine_result
    return output.strip() if exit_code == 0 and output.strip() else None


def parse_review_json(path: str) -> dict[str, Any]:
    review, _is_fallback = parse_review_json_with_flag(path)
    return review


def build_valid_lines_map(base_ref: str) -> dict[str, set[int]]:
    """Diff に含まれる実ファイル行番号を集計する（GitHub review API の line 検証用）."""
    try:
        diff_text = subprocess.check_output(
            ["git", "diff", f"origin/{base_ref}...HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return {}

    result: dict[str, set[int]] = {}
    current_file: str | None = None
    new_line_num = 0

    for line in diff_text.splitlines():
        m = re.match(r"^\+\+\+ b/(.+)$", line)
        if m:
            current_file = str(m.group(1))
            result[current_file] = set()
            new_line_num = 0
            continue
        if current_file is None:
            continue
        if line.startswith(("diff ", "index ", "--- ")):
            continue
        if line.startswith("@@"):
            m2 = re.search(r"\+(\d+)", line)
            if m2:
                new_line_num = int(m2.group(1)) - 1
            continue
        if line.startswith("-"):
            continue
        new_line_num += 1
        result[current_file].add(new_line_num)

    return result


_REQUIRED_ARGS = 2


def build_review_payloads(
    review: dict[str, Any],
    valid_lines: dict[str, set[int]],
    head_sha: str,
) -> list[dict[str, Any]]:
    """レビューコメントから GitHub review API のペイロード一覧を構築する."""
    severity_icon = {
        "CRITICAL": "🔴",
        "HIGH": "🟠",
        "MIDDLE": "🟡",
        "LOW": "🟢",
        "WARNING": "🟡",
        "INFO": "🟢",
    }
    individual_payloads: list[dict[str, Any]] = []
    inline_count = 0
    body_only_count = 0
    for c in review.get("comments", []):
        path = c.get("path", "")
        line = int(c.get("line", 1))
        icon = severity_icon.get(c.get("severity", "INFO"), "🟢")
        body = f"**{icon} {c.get('severity', 'INFO')}: {c.get('title', '')}**\n\n{c.get('body', '')}"

        if path not in valid_lines:
            body = f"📍 **指摘対象: `{path}` L{line}（diff 外のファイル）**\n\n{body}"
            individual_payloads.append(
                {
                    "event": "COMMENT",
                    "body": body,
                    "commit_id": head_sha,
                    "comments": [],
                },
            )
            body_only_count += 1
            continue

        lines = valid_lines[path]
        if not lines:
            body = f"📍 **指摘対象: `{path}` L{line}（追加行なし）**\n\n{body}"
            individual_payloads.append(
                {
                    "event": "COMMENT",
                    "body": body,
                    "commit_id": head_sha,
                    "comments": [],
                },
            )
            body_only_count += 1
            continue
        target_line = line if line in lines else None
        if target_line is None:
            body = f"📍 **指摘対象: `{path}` L{line}（diff 外の行）**\n\n{body}"
            target_line = min(lines, key=lambda x: abs(x - line))

        individual_payloads.append(
            {
                "event": "COMMENT",
                "body": "",
                "commit_id": head_sha,
                "comments": [
                    {"path": path, "line": target_line, "side": "RIGHT", "body": body}
                ],
            },
        )
        inline_count += 1

    parts: list[str] = []
    if inline_count:
        parts.append(f"*{inline_count} 件のインラインコメントを添付しています。*")
    if body_only_count:
        parts.append(
            f"*{body_only_count} 件は diff 外または追加行なしのためレビューボディに記載。*"
        )
    joined = "\n".join(parts)
    summary_body = (
        f"### 総評\n{review.get('summary', '')}\n\n"
        f"---\n{joined}\n"
        f"<!-- reviewed-sha: {head_sha} -->"
    )
    summary_payload: dict[str, Any] = {
        "event": "COMMENT",
        "body": summary_body,
        "commit_id": head_sha,
        "comments": [],
    }

    return [summary_payload, *individual_payloads]


def main() -> None:
    if len(sys.argv) < _REQUIRED_ARGS:
        sys.exit("Usage: build_review_payload.py <review_file>")
    review_file = sys.argv[1]
    base_ref = os.environ.get("BASE_REF", "main")

    review = parse_review_json(review_file)
    valid_lines = build_valid_lines_map(base_ref)

    try:
        head_sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        sys.exit("[build_review_payload] ERROR: Failed to get HEAD SHA.")

    payloads = build_review_payloads(review, valid_lines, head_sha)
    print(json.dumps(payloads))


if __name__ == "__main__":
    main()
