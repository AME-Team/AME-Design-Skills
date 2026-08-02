---
name: ame-ui-typography
description:
  TypeScript + Tailwind CSS を用いるプロダクト全般に適用可能な、タイポグラフィ基準（フォント定義・多言語対応・見出し階層・読みやすさ）を規定する汎用
  Skill。コンポーネント生成・リファクタリング時、[[ame-ui-philosophy]] と併用して適用する。
---

# AME Typography Skill

本 Skill は、TypeScript + Tailwind CSS を用いる各種プロダクトに適用可能な、汎用タイポグラフィ（フォント定義・多言語対応・見出し階層）基準を
AI Agent が実行可能なガイドラインとして定義したものです。特定プロジェクト専用ではなく、同スタックを使う任意のリポジトリで利用できます。
核心哲学・配色・スペーシング等の全体デザイン基準は `ame-ui-philosophy`
Skill を参照してください。本 Skill はその一部であったタイポグラフィ関連ルールを独立させたものです。

## 1. 言語別フォント定義（Default / Serif / Mono）

フォントは「日本語」と「英語」を明示的に分けて定義する。Mono は両言語共通。表示差異を避けるため、フォントは各端末のローカルフォントに依存せず、**Google
Fonts（Webフォント）を必須利用**とする。

- 必須方針: UI/コード表示で使用する Noto 系フォントは Google Fonts から配信する。
- 禁止方針: OS 依存のローカルフォントのみで完結する実装（環境差で見た目が変わるため）。
- 実装例: `@import` または `<link rel="preconnect">` +
  `<link href="https://fonts.googleapis.com/...">` で読み込む。

### 日本語 (ja)

| セット             | デフォルトフォント | Monoフォント（コード用） |
| ------------------ | ------------------ | ------------------------ |
| **Default (Sans)** | `Noto Sans JP`     | `Noto Sans Mono`         |
| **Serif**          | `Noto Serif JP`    | `Noto Sans Mono`         |

### 英語 (en)

| セット             | デフォルトフォント | Monoフォント（コード用） |
| ------------------ | ------------------ | ------------------------ |
| **Default (Sans)** | `Noto Sans`        | `Noto Sans Mono`         |
| **Serif**          | `Noto Serif`       | `Noto Sans Mono`         |

実装では以下の CSS 変数を使い、言語とフォントセットで切り替えること。

- `--font-ui-ja-sans: 'Noto Sans JP', sans-serif;`
- `--font-ui-ja-serif: 'Noto Serif JP', serif;`
- `--font-ui-en-sans: 'Noto Sans', sans-serif;`
- `--font-ui-en-serif: 'Noto Serif', serif;`
- `--font-mono: 'Noto Sans Mono', 'Noto Sans JP', monospace;`

## 2. フォントと多言語対応 (i18n) の接続ルール

フォント切り替えはアプリの言語設定（locale）と連動させる。

- `locale=ja` のとき UI フォントは `Noto Sans JP` / `Noto Serif JP`
- `locale=en` のとき UI フォントは `Noto Sans` / `Noto Serif`
- コード表示の Mono は常に `Noto Sans Mono` を優先し、未収録グリフのみ UI フォントへフォールバック
- 初期対応言語は `ja` / `en`。将来言語を追加してもフォント切り替えロジックを拡張できる構造にする
- 言語切替は設定 UI から実行可能にし、選択言語（および連動するフォント）は `app_settings` に永続化する
- ラベル長が言語間で増減してもレイアウトが崩れないこと（折返し・最小幅・余白を確保）を、フォント切替後にも確認する

## 3. コード表示時のフォント適用ルール

コードブロック・インラインコードでは、文字種に応じて表示フォントが切り替わる設計にする。

| 文字種別                            | 適用フォント             | 例                               |
| ----------------------------------- | ------------------------ | --------------------------------- |
| **1バイト文字**（半角英数字・記号） | `Noto Sans Mono`         | `const x = 1;`                   |
| **2バイト文字**（日本語コメント等） | 言語別デフォルトフォント | `// 日本語コメント` の日本語部分 |

`font-family: var(--font-mono);`
をコード要素に適用し、Mono にないグリフは各言語の UI フォントへフォールバックさせる。

## 4. フォント選択機能（ユーザー設定）

ユーザーは設定 UI で以下を選べること。

- `Default`（Sans）
- `Serif`
- `User Settings`（UI フォント/Mono フォントのユーザー指定）

選択状態は `app_settings` に永続化し、再起動後も維持すること。

## 5. 読みやすさ基準

- 日本語は `tracking-[0.05em]` または `tracking-wide`。
- 行間は `leading-relaxed` (1.625) または `leading-loose` (1.75)。
- 長文は `max-w-prose` (65ch) または `max-w-2xl`。
- `text-justify` は禁止。

## 6. 見出し階層（規定値）

| レベル   | Tailwind 規定 (Light / Dark)                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------- |
| **h1**   | `text-2xl font-bold text-gray-900 dark:text-gray-100`（※ヒーロー等の特例は `text-3xl`/`text-4xl` 可） |
| **h2**   | `text-xl font-bold text-gray-900 dark:text-gray-100`                                                  |
| **h3**   | `text-lg font-semibold text-gray-700 dark:text-gray-300`                                              |
| **本文** | `text-sm font-normal text-gray-600 dark:text-gray-400`                                                |

## 7. 適用ワークフローとの接続

コンポーネント生成・修正時、`ame-ui-philosophy` の Step 3（スタイル適用）で本 Skill を参照し、以下を実施する。

- `locale` とフォントセット（Default/Serif/User Settings）に応じて UI フォントを適用する
- Google Fonts（Webフォント）の読み込みを前提にし、ローカルフォント依存の実装を避ける
- 見出し階層・行間・字間・行長を本 Skill の規定値で適用する
- 文字列は翻訳キー経由へ統一し（ハードコード禁止）、日時/数値はロケール形式にする
