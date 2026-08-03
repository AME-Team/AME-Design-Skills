from __future__ import annotations

import os
import pathlib
import subprocess
from typing import TYPE_CHECKING, Any

from . import review_config
from .engine import apply_engine_info_env

if TYPE_CHECKING:
    from collections.abc import Mapping

# ps の comm をエンジン名へ対応付ける。comm は Linux で 15 文字まで切詰められる。
_PROCESS_TO_ENGINE: dict[str, str] = {
    "opencode": "opencode",
    "claude": "claude",
    "agy": "antigravity",
}

# プロセスツリー走査が重くなるのを防ぐための ps タイムアウト。
_PS_TIMEOUT_SECONDS = 3

_PS_REQUIRED_FIELDS = 2


def _process_info(pid: int) -> tuple[int, str] | None:
    try:
        result = subprocess.run(
            ["ps", "-o", "ppid=,comm=", "-p", str(pid)],
            capture_output=True,
            text=True,
            check=False,
            timeout=_PS_TIMEOUT_SECONDS,
            encoding="utf-8",
            errors="replace",
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    # ppid と comm を分離。comm にスペースを含むパス (macOS の "/Applications/My App/...")
    # を保持するため、最初の空白 1 つだけで分割する。
    parts = result.stdout.split(None, 1)
    if len(parts) < _PS_REQUIRED_FIELDS:
        return None
    try:
        comm = pathlib.Path(parts[1].strip()).name.lower()
        return int(parts[0]), comm
    except (ValueError, IndexError):
        return None


def detect_active_engine(start_pid: int | None = None) -> str | None:
    seen: set[int] = set()
    pid = start_pid if start_pid is not None else os.getpid()
    while pid > 1 and pid not in seen:
        seen.add(pid)
        info = _process_info(pid)
        if info is None:
            return None
        ppid, comm = info
        match = _PROCESS_TO_ENGINE.get(comm)
        if match:
            return match
        pid = ppid
    return None


def _str_config(config: Mapping[str, Any], key: str) -> str | None:
    val = config.get(key)
    if val is None:
        return None
    text = str(val).strip()
    return text or None


def resolve_engine_settings(
    config: Mapping[str, Any] | None = None,
    env: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    if config is None:
        config = review_config.load_config()
    if env is None:
        env = dict(os.environ)

    engine_raw = (
        env.get("PRECOMMIT_REVIEW_ENGINE")
        or _str_config(config, "precommit_engine")
        or _str_config(config, "engine")
        or "claude"
    )
    engine = engine_raw.lower()
    if engine == "auto":
        detected = detect_active_engine()
        engine = detected or _str_config(config, "engine") or "claude"

    model = env.get("PRECOMMIT_REVIEW_MODEL") or _str_config(
        config,
        "precommit_model",
    )
    # claude は model が必須のため、PR の model 設定をフォールバックする。
    if model is None and engine == "claude":
        model = _str_config(config, "model")

    thinking = (
        env.get("PRECOMMIT_REVIEW_THINKING")
        or _str_config(config, "precommit_thinking")
        or _str_config(config, "thinking")
        or "high"
    )

    budget = (
        env.get("PRECOMMIT_REVIEW_BUDGET_USD")
        or _str_config(config, "precommit_review_budget_usd")
        or _str_config(config, "review_budget_usd")
    )

    # Issue #40: Gate 1 のエンジン情報表示トグル (既定=表示)。build_env が
    # AME_ENGINE_SHOW_INFO へ変換して子プロセスへ渡す。文字列 "false" にも対応。
    show_info = review_config.config_bool(
        config, "show_engine_info_gate1", default=True
    )

    return {
        "engine": engine,
        "model": model,
        "thinking": thinking,
        "budget": budget,
        "show_info": show_info,
    }


def build_env(
    base_env: Mapping[str, str] | None,
    settings: Mapping[str, Any],
) -> dict[str, str]:
    env = dict(base_env) if base_env is not None else dict(os.environ)
    env["REVIEW_ENGINE"] = str(settings["engine"])
    # None の項目は環境変数を渡さず、stale な既存値があれば掃除する。
    # これにより engine.py が意図せず前回設定を使うのを防ぐ。
    model = settings["model"]
    if model is not None:
        env["REVIEW_MODEL"] = str(model)
    else:
        env.pop("REVIEW_MODEL", None)
    thinking = settings["thinking"]
    if thinking is not None:
        env["REVIEW_THINKING"] = str(thinking)
    else:
        env.pop("REVIEW_THINKING", None)
    budget = settings["budget"]
    if budget is not None:
        env["REVIEW_BUDGET_USD"] = str(budget)
    else:
        env.pop("REVIEW_BUDGET_USD", None)
    # Issue #40: エンジン情報バナー表示フラグ。未指定時は既定で表示 (後方互換)。
    apply_engine_info_env(env, show_info=bool(settings.get("show_info", True)))
    return env
