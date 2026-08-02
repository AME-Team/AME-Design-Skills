# AME-Design-Skills

Claude Code 用の Skill 集です。TypeScript + Tailwind CSS
を用いるプロダクト全般に適用可能な汎用 UI/UX デザイン規約を、AI Agent（Claude Code）が実行時に参照・適用できる Skill
として定義しています。特定プロジェクト専用ではなく、同スタックを使う任意のリポジトリに導入できます。

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
