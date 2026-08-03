"""LLM エンジンディスパッチャ.

エンジン (claude/opencode/antigravity) と SDK 言語 (python/typescript) を解決し、
対応するアダプタ (``ame_ai_review_system.engines``) へレビュー生成を委譲する。
CLI バイナリのサブプロセス呼び出しは廃止し、SDK のみを使用する。

サブコマンド相当のエントリポイント:
    python3 -m ame_ai_review_system.engine --role review|reply
stdin からプロンプトを読み、結果テキストを stdout へ出力する。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any

from . import review_config
from .engines import ENGINES, SDK_LANGS, available_sdk_langs, get_adapter

_DEFAULT_TIMEOUT_SECONDS = 600.0

_ROLE_MODEL_KEY: dict[str, str] = {"review": "review_model", "reply": "reply_model"}
_ROLE_THINKING_KEY: dict[str, str] = {
    "review": "review_thinking",
    "reply": "reply_thinking",
}
_ROLE_BUDGET_KEY: dict[str, str] = {
    "review": "review_budget_usd",
    "reply": "reply_budget_usd",
}
_ROLE_MODEL_ENV: dict[str, str] = {"review": "REVIEW_MODEL", "reply": "REPLY_MODEL"}
_ROLE_THINKING_ENV: dict[str, str] = {
    "review": "REVIEW_THINKING",
    "reply": "REPLY_THINKING",
}
_THINKING_LEVELS: tuple[str, ...] = ("low", "medium", "high")

# TS サイドカーへ引数として渡すため、シェルメタ文字を弾く程度の検証。
_MODEL_RE = re.compile(r"^[-\w./:@ ]+$")

# Issue #40: エンジン情報バナー (model/thinking/sdk) の出力可否。
# 親プロセス (precommit_review / main / reply) が config トグルを読んで注入する。
_ENGINE_INFO_ENV = "AME_ENGINE_SHOW_INFO"


def _first_nonempty(*values: str | None) -> str | None:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _engine_info_enabled() -> bool:
    """エンジン情報バナーを出力すべきかを判定する.

    親プロセスが config トグルを反映して ``AME_ENGINE_SHOW_INFO`` を注入する。
    未注入の場合は既定で表示 (後方互換・config の既定表示と一致)。非表示にするには
    ``0`` / ``false`` を明示的に注入する (Issue #40)。
    """
    raw = os.environ.get(_ENGINE_INFO_ENV)
    if raw is None:
        return True
    return raw.strip().lower() not in {"0", "false", "no"}


def apply_engine_info_env(
    env: dict[str, str],
    *,
    show_info: bool,
) -> dict[str, str]:
    """エンジン情報バナー表示フラグを子プロセス env へ反映する (Issue #40).

    表示時は ``AME_ENGINE_SHOW_INFO=1``、非表示時は ``0`` を明示的に注入する。
    ``_engine_info_enabled`` と対になり、config トグルからバナー・budget 警告の
    出力可否を一貫して伝える共通入口。注入漏れ時は既定で表示へフォールバックする。
    """
    env["AME_ENGINE_SHOW_INFO"] = "1" if show_info else "0"
    return env


def _resolve_engine(config: dict[str, Any]) -> str:
    engine_raw = _first_nonempty(os.environ.get("REVIEW_ENGINE"), config.get("engine"))
    if not engine_raw:
        sys.exit("[engine] engine is not configured.")
    engine = engine_raw.lower()
    if engine not in ENGINES:
        choices = ", ".join(ENGINES)
        sys.exit(f"[engine] Invalid engine: {engine!r}. Choose from: {choices}")
    return engine


def _resolve_model(role: str, engine: str, config: dict[str, Any]) -> str:
    model_env_key = _ROLE_MODEL_ENV[role]
    model_config_key = _ROLE_MODEL_KEY[role]
    model = _first_nonempty(os.environ.get(model_env_key))
    if model is None and engine == "claude":
        model = _first_nonempty(
            os.environ.get("CLAUDE_MODEL"),
            review_config.user_overrides().get(model_config_key),
            config.get("model"),
        )
        if not model:
            sys.exit("[engine] model is not configured for the claude engine.")
    if model is None and engine in {"opencode", "antigravity"}:
        model = _first_nonempty(
            review_config.user_overrides().get(model_config_key),
            config.get("model"),
        )
    if model is None:
        sys.exit(f"[engine] model is not configured for the {engine} engine.")
    if not _MODEL_RE.match(model):
        sys.exit(f"[engine] Invalid {model_env_key} value: {model!r}")
    return model


def _resolve_thinking(role: str, config: dict[str, Any]) -> str:
    thinking_env_key = _ROLE_THINKING_ENV[role]
    thinking_config_key = _ROLE_THINKING_KEY[role]
    thinking_raw = _first_nonempty(
        os.environ.get(thinking_env_key),
        review_config.user_overrides().get(thinking_config_key),
        config.get("thinking"),
    )
    if not thinking_raw:
        sys.exit("[engine] thinking is not configured.")
    thinking = thinking_raw.lower()
    if thinking not in _THINKING_LEVELS:
        choices = ", ".join(_THINKING_LEVELS)
        sys.exit(f"[engine] Invalid thinking: {thinking!r}. Choose from: {choices}")
    return thinking


def _resolve_budget(role: str, config: dict[str, Any]) -> float:
    budget_key = _ROLE_BUDGET_KEY[role]
    config_budget = config.get(budget_key)
    config_budget_str = str(config_budget) if config_budget is not None else None
    if role == "reply":
        budget_raw = _first_nonempty(
            os.environ.get("REPLY_BUDGET_USD"),
            os.environ.get("REVIEW_BUDGET_USD"),
            config_budget_str,
        )
    else:
        budget_raw = _first_nonempty(
            os.environ.get("REVIEW_BUDGET_USD"),
            config_budget_str,
        )
    if budget_raw is None:
        sys.exit(
            f"[engine] {budget_key} is not set (config.json or env). "
            "Set a positive value.",
        )
    try:
        budget = float(budget_raw)
    except ValueError:
        sys.exit(f"[engine] Invalid budget value: {budget_raw!r}")
    if budget <= 0:
        sys.exit(f"[engine] budget must be positive, got {budget}")
    return budget


def _resolve_sdk_lang(engine: str, config: dict[str, Any]) -> str:
    available = available_sdk_langs(engine)
    raw = _first_nonempty(
        os.environ.get("REVIEW_SDK_LANG"),
        os.environ.get("CLAUDE_SDK_LANG") if engine == "claude" else None,
        review_config.user_overrides().get("sdk_lang"),
        config.get("sdk_lang"),
    )
    if raw:
        lang = raw.lower()
        if lang not in SDK_LANGS:
            choices = ", ".join(SDK_LANGS)
            sys.exit(f"[engine] Invalid sdk_lang: {lang!r}. Choose from: {choices}")
        if lang not in available:
            sys.exit(
                f"[engine] sdk_lang {lang!r} not available for {engine!r}. "
                f"Available: {', '.join(available)}",
            )
        return lang
    return available[0]


def _resolve_timeout() -> float:
    timeout_raw = os.environ.get("REVIEW_TIMEOUT_SECONDS")
    if not timeout_raw:
        return _DEFAULT_TIMEOUT_SECONDS
    try:
        timeout = float(timeout_raw)
    except ValueError:
        sys.exit(f"[engine] Invalid REVIEW_TIMEOUT_SECONDS: {timeout_raw!r}")
    if timeout <= 0:
        sys.exit(f"[engine] REVIEW_TIMEOUT_SECONDS must be positive, got {timeout}")
    return timeout


def resolve_settings(role: str) -> dict[str, Any]:
    if role not in _ROLE_MODEL_KEY:
        sys.exit(f"[engine] Invalid role: {role!r}. Choose from: review, reply")
    config = review_config.load_config()
    engine = _resolve_engine(config)
    return {
        "engine": engine,
        "model": _resolve_model(role, engine, config),
        "thinking": _resolve_thinking(role, config),
        "budget": _resolve_budget(role, config),
        "sdk_lang": _resolve_sdk_lang(engine, config),
        "timeout": _resolve_timeout(),
        "role": role,
    }


def run_engine(settings: dict[str, Any], prompt: str) -> int:
    """LLM エンジンへプロンプトを送り、結果を stdout へ出力する.

    エンジン情報バナーと非 Claude の budget 警告は ``AME_ENGINE_SHOW_INFO=1``
    が注入された時のみ stderr へ出力する (Issue #40)。呼び出し元は config トグル
    (``show_engine_info_gate1`` / ``show_engine_info_gate2``) を読んだ上で
    :func:`apply_engine_info_env` 経由で注入すること。注入しないと既定で非表示となり、
    config の既定 (表示) と食い違ってバナー・budget 警告が黙って消える。
    """
    engine = settings["engine"]
    sdk_lang = settings.get("sdk_lang")
    model_display = settings["model"] or "<engine-default>"
    # Issue #40: エンジン情報バナーは AME_ENGINE_SHOW_INFO が注入された時のみ出力する。
    if _engine_info_enabled():
        print(
            f"[engine] {engine} starting "
            f"(sdk={sdk_lang}, model={model_display}, thinking={settings['thinking']}, "
            f"role={settings['role']})",
            file=sys.stderr,
        )
    if engine != "claude" and _engine_info_enabled():
        print(
            f"[engine] WARNING: budget limit is not enforced for {engine}",
            file=sys.stderr,
        )

    adapter = get_adapter(engine, sdk_lang)
    output = adapter.run(prompt, settings)
    if not output.strip():
        sys.exit(f"[engine] {engine} produced empty output.")
    sys.stdout.write(output)
    if not output.endswith("\n"):
        sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="LLM engine dispatcher for the review pipeline.",
    )
    parser.add_argument(
        "--role",
        choices=["review", "reply"],
        default="review",
    )
    namespace = parser.parse_args(argv)
    prompt = sys.stdin.read()
    if not prompt.strip():
        sys.exit("[engine] stdin prompt is empty.")
    settings = resolve_settings(str(namespace.role))
    return run_engine(settings, prompt)


if __name__ == "__main__":
    sys.exit(main())
