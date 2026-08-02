#!/usr/bin/env bash
# =========================================================================
# Shared delegator — Git ネイティブフックから pre-commit フレームワーク (hook-impl) へ委譲。
# 本スクリプトは git から直接起動されず、各 githooks/<stage> スクリプトから実行される。
#
# 引数: $1 = hook-type (pre-commit / commit-msg / pre-push / post-commit)
#       $@ = git から渡されたフック引数 (そのまま転送)
# =========================================================================
set -euo pipefail

hook_type="$1"
shift

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# pre-commit フレームワークを hook-impl モードで起動する。staged ファイル対象・
# unstaged 変更の退避など、インストール済みフックと完全に同等の挙動を再現する。
if command -v pre-commit >/dev/null 2>&1; then
  exec pre-commit hook-impl \
    --config=.pre-commit-config.yaml \
    --hook-type="$hook_type" \
    --hook-dir "$here" \
    -- "$@"
else
  printf '%s\n' "pre-commit コマンドが見つかりません。pip install pre-commit してから再実行してください。" 1>&2
  exit 1
fi
