"""Review system configuration loader and slash-command detection.

サブコマンド:
  get <key>                 ``config.json`` から値を読み取り stdout へ出力する。
                            ファイルやキーが存在しない場合は組み込みデフォルトを使う。
  is-review-command <body>  コメント本文がレビュー要求コマンド
                            (``/request-review`` / ``/review``) かを判定し
                            ``true`` / ``false`` を stdout へ出力する。

設定ファイルのパスは環境変数 ``AME_REVIEW_CONFIG`` で上書き可能。
ユーザー固有の上書きは ``config.user.json``（環境変数 ``AME_REVIEW_USER_CONFIG`` でパス変更可能）に記述する。
``config.user.json`` は Git 管理対象外であり、存在しない場合は無視される。
"""

from __future__ import annotations

import ast
import contextlib
import json
import os
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from . import paths

if TYPE_CHECKING:
    from collections.abc import Mapping

_DEFAULTS: dict[str, Any] = {
    "precommit_review_enabled": True,
    "precommit_require_static_checks": True,
    "pr_review_require_static_checks": True,
    "ai_review_enforce_no_skip": True,
    # Issue #37: 移植先で vendored した ame_ai_review_system 配下は既定でレビュー対象外。
    "review_include_package_dir": False,
    "precommit_engine": "auto",
    "precommit_model": None,
    "precommit_thinking": None,
    "precommit_review_budget_usd": None,
    # Issue #40: レビューエンジン情報 (engine/model/thinking) の表示トグル (既定=表示)。
    "show_engine_info_gate1": True,
    "show_engine_info_gate2": True,
    # Issue #37: 壊れたレビュー JSON を修復する際に使うモデル (省略時は本体と同じ)。
    "review_repair_model": None,
    "engine": "claude",
    "model": "sonnet",
    "review_model": "sonnet",
    "reply_model": "haiku",
    "thinking": "high",
    "review_thinking": "high",
    "reply_thinking": "low",
    "review_budget_usd": 2.00,
    "reply_budget_usd": 0.20,
}

_REVIEW_COMMANDS = ("/request-review", "/review")

_MIN_ARGS = 2


def _config_path() -> Path:
    override = os.environ.get("AME_REVIEW_CONFIG")
    if override:
        return Path(override)
    return paths.config_path()


def _user_config_path() -> Path:
    override = os.environ.get("AME_REVIEW_USER_CONFIG")
    if override:
        return Path(override)
    return paths.user_config_path()


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return cast("dict[str, Any]", data) if isinstance(data, dict) else None


def load_config() -> dict[str, Any]:
    config: dict[str, Any] = dict(_DEFAULTS)
    data: dict[str, object] | None = _read_json(_config_path())
    if data is not None:
        config.update(data)
    user_data = _read_json(_user_config_path())
    if user_data is not None:
        config.update(user_data)
    return config


def config_bool(
    config: Mapping[str, Any],
    key: str,
    *,
    default: bool = True,
) -> bool:
    """Config の真偽値キーを厳密に解釈する.

    JSON の bool だけでなく、手編集で ``"false"`` のような文字列が書かれた場合も
    正しく判定する (Issue #40 の表示トグル等)。値が存在しない場合は ``default``。
    """
    value = config.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if not value.strip():
            return default
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def user_overrides() -> dict[str, Any]:
    """Return keys explicitly set in config.json or config.user.json (user wins)."""
    overrides: dict[str, Any] = {}
    data: dict[str, object] | None = _read_json(_config_path())
    if data is not None:
        overrides.update(data)
    user_data = _read_json(_user_config_path())
    if user_data is not None:
        overrides.update(user_data)
    return overrides


# ============================================================================
# Issue #37: vendored ame_ai_review_system 配下のレビュー除外
# ============================================================================


def package_dir_rel() -> str | None:
    """プロジェクトルート相対の vendored パッケージディレクトリパス (POSIX) を返す.

    パッケージがリポジトリ外 (pip インストール等) にある場合は ``None``。
    例: ``ame_ai_review_system`` / ``vendor/ame_ai_review_system``。
    """
    try:
        rel = (
            paths
            .package_dir()
            .resolve()
            .relative_to(
                paths.project_root().resolve(),
            )
        )
    except ValueError:
        return None
    return rel.as_posix() if rel.parts else None


def review_exclusion_rel() -> str | None:
    """レビューから除外すべきパッケージ相対パスを返す.

    ``review_include_package_dir: true`` のときや、パッケージがリポジトリ外に
    ある場合は ``None`` (除外なし)。
    """
    if load_config().get("review_include_package_dir", False):
        return None
    return package_dir_rel()


def apply_repair_model(settings: dict[str, Any]) -> dict[str, Any]:
    """修復専用モデル ``review_repair_model`` を設定へ適用する.

    省略時は本体と同じモデルを使うため ``settings`` をそのまま返す。壊れやすい
    弱いモデル (deepseek-v4-flash 等) を JSON 修復には使わないための共通処理。
    """
    repair_model = load_config().get("review_repair_model")
    if repair_model:
        return {**settings, "model": repair_model}
    return settings


def filter_review_targets(files: list[str]) -> list[str]:
    """``files`` から除外対象パッケージ配下のパスを取り除く."""
    rel = review_exclusion_rel()
    if rel is None:
        return list(files)
    return [f for f in files if not _is_path_under(f, rel)]


def filter_review_diff(diff_text: str) -> str:
    """``diff`` から除外対象パッケージ配下のファイルセクションを取り除く.

    セクション内の全パスが除外対象配下にある場合のみ破棄する。リネーム等で
    ``a/src/old.py`` → ``b/ame_ai_review_system/new.py`` のように除外ディレクトリを
    跨ぐ場合は、非除外側の変更 (un-vendoring 等) をレビューから消さないよう保持する。
    """
    rel = review_exclusion_rel()
    if rel is None or not diff_text:
        return diff_text
    kept: list[str] = []
    for section in _split_diff_sections(diff_text):
        paths_in_section = _section_paths(section)
        if paths_in_section and all(_is_path_under(p, rel) for p in paths_in_section):
            continue
        kept.append("\n".join(section))
    return "\n".join(kept)


def _is_path_under(path: str, rel: str) -> bool:
    return path == rel or path.startswith(rel + "/")


def _split_diff_sections(diff_text: str) -> list[list[str]]:
    """``diff --git`` ヘッダ行で diff をファイル単位のセクションへ分割する."""
    lines = diff_text.splitlines()
    sections: list[list[str]] = []
    current: list[str] = []
    for i, line in enumerate(lines):
        if line.startswith("diff --git ") and _looks_like_diff_header(lines, i):
            if current:
                sections.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        sections.append(current)
    return sections


# ヘッダ直後に現れるファイル境界の目印。差分の内容行 (追加/削除) は必ず
# ``+`` / ``-`` / スペースで始まるため、この判定で誤分割しない。
_DIFF_HEADER_FOLLOWERS = (
    "index ",
    "new file mode ",
    "deleted file mode ",
    "old mode ",
    "new mode ",
    "similarity index ",
    "dissimilarity index ",
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to ",
    "--- ",
    "+++ ",
)


def _looks_like_diff_header(lines: list[str], i: int) -> bool:
    """``diff --git`` 行がファイル境界か (直後の数行にヘッダ対が続くか) 判定する."""
    for j in range(i + 1, min(i + 4, len(lines))):
        if lines[j].startswith(_DIFF_HEADER_FOLLOWERS):
            return True
    return False


# ``diff --git a/foo b/foo`` ヘッダ内のパストークン。空白を含むパスは git が
# 全体を ``"a/path with space"`` のようにダブルクォートで引用するため、
# 引用符で括られたトークンと通常トークンの両方を許容する。
_HEADER_TOKEN_RE = re.compile(r"(\"(?:a/|b/)[^\"]*\"|(?:a/|b/)[^ \t]+)")


def _unquote_path(raw: str) -> str:
    # git は特殊文字を含むパスを C スタイル引用符で出力する。
    if raw.startswith('"') and raw.endswith('"'):
        with contextlib.suppress(SyntaxError, ValueError):
            raw = cast("str", ast.literal_eval(raw))
    return raw


def _strip_path_prefix(raw: str) -> str:
    # ``a/`` / ``b/`` プレフィックスを除去する。
    if raw.startswith(("a/", "b/")):
        return raw[2:]
    return raw


def _section_paths(section: list[str]) -> list[str]:
    """セクションからリポジトリ相対パスを抽出する.

    ``diff --git`` ヘッダ行 (バイナリ差分・モード変更のみの差分にも存在) と
    ``--- a/..`` / ``+++ b/..`` 行の両方から抽出する。追加・削除の
    ``/dev/null`` 疑似パスは実ファイルでないため除外する。
    """
    paths_in_section: list[str] = []
    for line in section:
        if line.startswith("diff --git "):
            rest = line[len("diff --git ") :]
            paths_in_section.extend(
                _strip_path_prefix(_unquote_path(m.group(1)))
                for m in _HEADER_TOKEN_RE.finditer(rest)
            )
        elif line.startswith(("--- ", "+++ ")):
            raw = _strip_path_prefix(_unquote_path(line[4:].strip()))
            if raw not in {"/dev/null", "null"}:
                paths_in_section.append(raw)
    return paths_in_section


def is_review_command(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return False
    first_line = stripped.splitlines()[0].strip()
    return any(
        first_line == cmd or first_line.startswith(cmd + " ")
        for cmd in _REVIEW_COMMANDS
    )


def get_ts_checks(ts_files: list[str]) -> list[tuple[str, list[str]]]:
    """Return command lists for TypeScript compiler and ESLint checks."""
    if not ts_files:
        return []
    checks: list[tuple[str, list[str]]] = []
    # tsc は tsconfig_path が明示指定された場合のみ実行する。
    # ルート tsconfig.json はしばしばソリューション参照型で広すぎ、無関係な既存エラーが
    # 回帰として表面化するため自動検出しない (専用の tsc フックで別途担保すること)。
    tsconfig = load_config().get("tsconfig_path")
    if tsconfig:
        checks.append(
            (
                "tsc",
                [
                    "./node_modules/.bin/tsc",
                    "--noEmit",
                    "-p",
                    str(tsconfig),
                ],
            ),
        )
    checks.append(
        (
            "eslint",
            [
                "./node_modules/.bin/eslint",
                "--max-warnings=0",
                "--no-warn-ignored",
                *ts_files,
            ],
        ),
    )
    return checks


def _emit_value(value: Any) -> None:
    if isinstance(value, bool):
        print("true" if value else "false")
    elif value is None:
        print()
    else:
        print(value)


def _cmd_get(args: list[str]) -> int:
    key = args[0] if args else ""
    _emit_value(load_config().get(key, _DEFAULTS.get(key)))
    return 0


def _cmd_is_review_command(args: list[str]) -> int:
    body = args[0] if args else ""
    print("true" if is_review_command(body) else "false")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < _MIN_ARGS:
        print(
            "Usage: review_config.py get <key> | is-review-command <body>",
            file=sys.stderr,
        )
        return 2
    cmd = argv[1]
    rest = argv[2:]
    if cmd == "get":
        return _cmd_get(rest)
    if cmd == "is-review-command":
        return _cmd_is_review_command(rest)
    print(f"Unknown command: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
