# AME-Design-Skills

Claude Code 用の Skill 集です。TypeScript + Tailwind CSS
を用いるプロダクト全般に適用可能な汎用 UI/UX デザイン規約を定義しています。
AI Agent（Claude Code）が実行時に参照・適用できる Skill として提供します。特定プロジェクト専用ではなく、
同スタックを使う任意のリポジトリに導入できます。

本 README は **AI Agent がこのリポジトリを取得してインストール作業を代行する**ことを想定して書かれています。人間が読む場合も、同じ手順でセットアップできます。

## 収録スキル一覧

| Skill 名 | ディレクトリ | 概要 |
| --- | --- | --- |
| `ame-ui-philosophy` | `.claude/skills/ame-ui-philosophy/` | UI/UX の核心哲学・原則・配色・スペーシング・アニメーション・アクセシビリティ・多言語対応・アイコン/図表・実装ワークフローを規定する Skill。 |
| `ame-ui-typography` | `.claude/skills/ame-ui-typography/` | タイポグラフィ基準（言語別フォント定義・多言語フォント切替・見出し階層・読みやすさ）を規定する Skill。`ame-ui-philosophy` と併用する。 |

いずれも `SKILL.md` 1 ファイル構成（`name` / `description` の YAML frontmatter + 本文）です。

## インストール方法

Claude Code はユーザーレベルの Skill を `~/.claude/skills/<skill-name>/SKILL.md`
から読み込みます。本リポジトリの `.claude/skills/` 配下にある各 Skill フォルダを、そのままそのパスへ配置してください。

### 前提: リポジトリの取得

```bash
git clone git@github.com:tarminjapan/AME-Design-Skills.git
cd AME-Design-Skills
```

### macOS

```bash
mkdir -p ~/.claude/skills
cp -R .claude/skills/. ~/.claude/skills/
```

更新を追従させたい場合はコピーの代わりにシンボリックリンクを使用してください（`git pull`
だけで Skill が最新化されます）。

```bash
mkdir -p ~/.claude/skills
for d in .claude/skills/*/; do
  name="$(basename "$d")"
  ln -sfn "$(pwd)/.claude/skills/$name" ~/.claude/skills/"$name"
done
```

### Linux

macOS と同一の手順です。

```bash
mkdir -p ~/.claude/skills
cp -R .claude/skills/. ~/.claude/skills/
```

シンボリックリンク版（更新追従）:

```bash
mkdir -p ~/.claude/skills
for d in .claude/skills/*/; do
  name="$(basename "$d")"
  ln -sfn "$(pwd)/.claude/skills/$name" ~/.claude/skills/"$name"
done
```

### Windows (PowerShell)

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse -Force ".claude\skills\*" "$HOME\.claude\skills\"
```

シンボリックリンク版（更新追従。管理者権限または開発者モードが必要）:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\skills" | Out-Null
Get-ChildItem ".claude\skills" -Directory | ForEach-Object {
    $target = Join-Path "$HOME\.claude\skills" $_.Name
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    New-Item -ItemType SymbolicLink -Path $target -Target $_.FullName | Out-Null
}
```

### インストール確認

配置後、以下のパスに `SKILL.md` が存在すれば成功です。

```text
~/.claude/skills/ame-ui-philosophy/SKILL.md
~/.claude/skills/ame-ui-typography/SKILL.md
```

Claude Code はこれらの `description` を基に、TypeScript + Tailwind CSS
のコンポーネント生成・リファクタリング時に自動で Skill を適用します。

## 更新方法

コピーでインストールした場合は、`git pull` 後に該当 OS のコピー手順を再実行してください。シンボリックリンクでインストールした場合は
`git pull` のみで反映されます。

```bash
git pull
```

## アンインストール

```bash
rm -rf ~/.claude/skills/ame-ui-philosophy ~/.claude/skills/ame-ui-typography
```

```powershell
Remove-Item -Recurse -Force "$HOME\.claude\skills\ame-ui-philosophy"
Remove-Item -Recurse -Force "$HOME\.claude\skills\ame-ui-typography"
```

## AI Review System（開発者向け）

本リポジトリには、静的解析と AI レビューを組み合わせた二重品質ゲートシステム（AME-AI-Review-System v0.2.5）が導入されています。配布元は tarminjapan org から AME-Team へ移転済みで、参照先は AME-Team/AME-AI-Review-System（旧 tarminjapan/AME-AI-Review-System、リダイレクト）です (Issue #100)。

- `.ame-review/` … 動作設定（`config.json`）、レビュープロンプト（`review_prompt.txt`）、LLM エンジンサイドカー（`engines-ts/`）
- `.github/workflows/` … `/` で始まる PR コメント（`/request-review` 等）で起動する AI レビュー CI
- `.pre-commit-config.yaml` … ローカル静的解析とコミット時 AI レビュー（Gate 1）
- `.claude/skills/review-round/` … AI エージェントが Dual-Gate レビューラウンドを自律実行するためのスキル

コミット時 AI レビュー（Gate 1）は、ローカルで起動中の `opencode serve`（既定 `http://127.0.0.1:4096`）へ接続します。

serve を Basic 認証付きで起動する場合は、認証情報を環境変数で設定して起動してください。設定する変数は `OPENCODE_SERVER_USERNAME` と `OPENCODE_SERVER_PASSWORD` です。

`scripts/precommit-review.sh` は、既定ポート 4096 で起動中の serve プロセスから認証情報を自動取得します。取得元は `/proc/<pid>/environ` です。複数の serve が起動している場合は、既定ポートで起動中のプロセスが対象です。

なお、`/proc/<pid>/environ` は同一ユーザーの全プロセスから読み取り可能です。認証情報の取り扱いに注意し、ローカル開発用途での利用を想定してください。

PR レビュー（Gate 2）には GitHub App の Secrets が必要です（`AME_AI_REVIEWER_APP_ID` / `AME_AI_REVIEWER_APP_PRIVATE_KEY`）。セットアップの詳細は導入元プロジェクトのセットアップガイドを参照してください。

- [AME-AI-Review-System setup.md (v0.2.5)](https://github.com/AME-Team/AME-AI-Review-System/blob/v0.2.5/ame_ai_review_system/docs/setup.md)
