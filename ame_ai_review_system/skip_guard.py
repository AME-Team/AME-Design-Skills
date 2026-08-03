"""Skip guard for the mandatory AI pre-commit review (Issue #26).

pre-commit の ``SKIP`` 環境変数による ``ai-precommit-review`` のバイパスを検知・ブロックする。
Skill ベースの「SKIP を使わない」という指示だけでは、AI Agent が気を利かせて
``SKIP=ai-precommit-review`` で Gate1 を迂回してしまうため、機械的な強制力を持たせる。

許可される正当なバイパス (人間の明示的操作のみ):

1. ``sudo`` で root として実行 (``geteuid() == 0``)。AI Agent はパスワード無しで
   root 昇格できないため、これが最も強力なゲートになる。
2. バイパストークンファイルが **root 所有の通常ファイル** として存在する
   (固定パス: ``~/.config/ame-ai-review-system/allow-skip-ai-review``)。
   ``sudo touch`` で一度作成すれば非 root セッションでもスキップを事前認可できる。
   非 root の AI Agent は root 所有ファイルを作成できないため、ファイルの存在だけでは
   不十分 (``lstat`` でリンクを追跡せず ``st_uid == 0`` かつ ``S_ISREG`` を検証する)。

セキュリティ上の設計注記:

- トークンパスは環境変数等で上書き **できない** (固定)。上書きを許すと非 root が
  ``AME_AI_REVIEW_BYPASS_TOKEN=/etc/passwd`` のように既存の root 所有ファイルをトークンに
  指定してガードを無効化できるため。
- 本ガードは pre-commit フレームワークのフックとしても動作するが、pre-commit の
  ``SKIP`` はフックの起動自体を抑制するため ``SKIP=ai-skip-guard,ai-precommit-review``
  でガードごと迂回される。これを防ぐため、ネイティブ Git フック (``githooks/pre-commit``)
  を ``core.hooksPath`` 経由で本ガードを先に実行する構成を併用すること (Issue #26)。
  設定: ``config.json`` の ``ai_review_enforce_no_skip`` (デフォルト ``True``)。
"""

from __future__ import annotations

import json
import os
import pathlib
import stat
import sys
from typing import Any, cast

from . import paths

GUARDED_HOOK_ID = "ai-precommit-review"

_TOKEN_FILENAME = "allow-skip-ai-review"


def bypass_token_path() -> pathlib.Path:
    # セキュリティのためパスは固定 (環境変数等での上書きは不可)。上書きを許すと
    # 非 root が既存の root 所有ファイルをトークンに指定してバイパスできる。
    return pathlib.Path.home() / ".config" / "ame-ai-review-system" / _TOKEN_FILENAME


def parse_skip_ids(skip_env: str) -> set[str]:
    # pre-commit は SKIP をカンマ区切りで解析する。堅牢性のため空白区切りも許容する。
    tokens: list[str] = []
    for chunk in skip_env.split(","):
        tokens.extend(chunk.split())
    return {token.strip() for token in tokens if token.strip()}


def _running_as_root() -> bool:
    geteuid = getattr(os, "geteuid", None)
    if geteuid is None:
        return False
    try:
        return bool(geteuid() == 0)
    except OSError:
        return False


def _token_stat() -> os.stat_result | None:
    # トークンファイルの stat をリンク先を追跡せずに取得する (lstat)。
    # ln -s /etc/passwd <token> のようなシンボリックリンクでリンク先の uid=0 を
    # 盗用されるのを防ぐため、リンク自身の属性を見る。失敗時は None。
    try:
        return bypass_token_path().lstat()
    except OSError:
        return None


def _token_present() -> bool:
    # 非 root の AI Agent が無痕跡でトークンを作成して迂回するのを防ぐため、
    # ファイルが root (uid 0) に所有されていることを併せて検証する。
    # sudo touch で作成すれば非 root セッションでも事前認可として機能する。
    info = _token_stat()
    if info is None:
        return False
    # S_ISREG で通常ファイルであることも確認し、シンボリックリンク等を弾く。
    return stat.S_ISREG(info.st_mode) and info.st_uid == 0


def is_authorized() -> tuple[bool, str]:
    if _running_as_root():
        return True, "sudo (root 実行)"
    if _token_present():
        return True, f"バイパストークン {bypass_token_path()}"
    return False, ""


def _block_message() -> str:
    token = bypass_token_path()
    return (
        "[ai-skip-guard] コミットをブロックしました。\n"
        "AI pre-commit review (ai-precommit-review) を SKIP 環境変数で迂回することは"
        "禁止されています (Issue #26)。\n"
        "Gate1 の AI レビューは Dual-Gate アーキテクチャの第一関門です。"
        "スキップせず、指摘を修正して再 add・再 commit してください。\n\n"
        "どうしても緊急でスキップが必要な場合 (人間の明示的操作のみ):\n"
        "  sudo SKIP=ai-precommit-review git commit ...\n"
        "  または root 所有のバイパストークンファイルを事前作成:\n"
        f"    sudo mkdir -p '{token.parent}' && sudo touch '{token}'\n"
    )


def _tracked_config_path() -> pathlib.Path:
    # config.user.json (gitignore) や AME_REVIEW_CONFIG 環境変数での上書きを無視し、
    # 版管理対象の config.json のみを参照する。これらを許容すると非 root の AI Agent が
    # ガード全体をサイレントに無効化できる抜け道になる (Issue #26)。
    return paths.tracked_config_path()


def _enforce_enabled() -> bool:
    # ガードの有効/無効は tracked な config.json のみから判断する。読めなければ安全側
    # (enforce) に倒す。
    try:
        raw: object = json.loads(_tracked_config_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return True
    if not isinstance(raw, dict):
        return True
    config = cast("dict[str, Any]", raw)
    return bool(config.get("ai_review_enforce_no_skip", True))


def main() -> int:
    if not _enforce_enabled():
        return 0
    skip_ids = parse_skip_ids(os.environ.get("SKIP", ""))
    if GUARDED_HOOK_ID not in skip_ids:
        return 0
    authorized, reason = is_authorized()
    if authorized:
        print(
            "[ai-skip-guard] ai-precommit-review のスキップを許可しました "
            f"({reason})。Gate1 の AI レビューは実行されません。",
            file=sys.stderr,
        )
        return 0
    print(_block_message(), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
