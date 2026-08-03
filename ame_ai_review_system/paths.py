"""プロジェクトローカル設定とパッケージ同梱デフォルトのリソースパス解決.

vendored 運用 (ame_ai_review_system/ をリポジトリへコピー) でリポジトリ非依存に
動くよう、各リソースは以下の優先順位で解決する:

1. 環境変数による明示上書き (``AME_REVIEW_CONFIG`` 等)
2. プロジェクトルートの ``.ame-review/`` 配下
3. パッケージ同梱のデフォルト (vendored 運用の後方互換)

プロジェクトルートは cwd から上方向へ ``.ame-review/`` → ``.git/`` の順で探索する。
"""

from __future__ import annotations

import os
from pathlib import Path

_AME_REVIEW_DIR_NAME = ".ame-review"


def package_dir() -> Path:
    return Path(__file__).resolve().parent


def project_root() -> Path:
    override = os.environ.get("AME_REVIEW_PROJECT_ROOT")
    if override:
        return Path(override)

    cwd = Path.cwd()
    for candidate in (cwd, *cwd.parents):
        if (candidate / _AME_REVIEW_DIR_NAME).is_dir():
            return candidate
        if (candidate / ".git").exists():
            return candidate
    return cwd


def ame_review_dir() -> Path:
    return project_root() / _AME_REVIEW_DIR_NAME


def _first_existing(*candidates: Path) -> Path | None:
    for path in candidates:
        if path.exists():
            return path
    return None


def config_path() -> Path:
    override = os.environ.get("AME_REVIEW_CONFIG")
    if override:
        return Path(override)
    found = _first_existing(
        ame_review_dir() / "config.json",
        package_dir() / "config.json",
    )
    return found if found is not None else package_dir() / "config.json"


def user_config_path() -> Path:
    override = os.environ.get("AME_REVIEW_USER_CONFIG")
    if override:
        return Path(override)
    found = _first_existing(
        ame_review_dir() / "config.user.json",
        package_dir() / "config.user.json",
    )
    return found if found is not None else ame_review_dir() / "config.user.json"


def tracked_config_path() -> Path:
    # skip_guard 用: 環境変数や user 上書きを無視し版管理対象の config.json のみ参照する。
    found = _first_existing(
        ame_review_dir() / "config.json",
        package_dir() / "config.json",
    )
    return found if found is not None else package_dir() / "config.json"


def prompt_path() -> Path:
    found = _first_existing(
        ame_review_dir() / "review_prompt.txt",
        package_dir() / "review_prompt.txt",
    )
    return found if found is not None else package_dir() / "review_prompt.txt"


def semgrep_rules_path() -> Path:
    found = _first_existing(
        ame_review_dir() / ".semgrep" / "rules.yml",
        package_dir() / ".semgrep" / "rules.yml",
    )
    return found if found is not None else package_dir() / ".semgrep" / "rules.yml"


def state_dir() -> Path:
    return ame_review_dir() / "state"
