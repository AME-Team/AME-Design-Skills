#!/usr/bin/env bash
# AME AI Review System — Gate 1 (pre-commit AI review) 実行ラッパー。
#
# opencode エンジンは起動済み `opencode serve` へ SDK で接続する。この serve が
# OPENCODE_SERVER_PASSWORD による Basic 認証で起動されている場合、認証情報が
# フック実行環境に無いと接続できない（pre-commit フレームワークは local フックへ
# 任意の環境変数を渡せない）。ここでは serve プロセス環境から認証情報を取得して
# opencode.mjs へ引き継ぐ（パスワードはファイルに記録しない）。
#
# 使用条件:
#   - serve がポート 4096 (または OPENCODE_URL の接続先) で起動していること
#   - 実行ユーザーが serve プロセスを所有していること (/proc/<pid>/environ が読める)
set -euo pipefail

if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  serve_pid="$(pgrep -f 'opencode serve --hostname 127.0.0.1 --port 4096' | head -1 || true)"
  if [ -n "${serve_pid}" ] && [ -r "/proc/${serve_pid}/environ" ]; then
    env_file="/proc/${serve_pid}/environ"
    opencode_server_username="$(
      tr '\0' '\n' < "${env_file}" |
        sed -n 's/^OPENCODE_SERVER_USERNAME=//p' |
        head -1
    )"
    opencode_server_password="$(
      tr '\0' '\n' < "${env_file}" |
        sed -n 's/^OPENCODE_SERVER_PASSWORD=//p' |
        head -1
    )"
    export OPENCODE_SERVER_USERNAME="${opencode_server_username}"
    export OPENCODE_SERVER_PASSWORD="${opencode_server_password}"
  fi
fi

exec python -m ame_ai_review_system.precommit_review "$@"
