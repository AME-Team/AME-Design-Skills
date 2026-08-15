import { Locale } from "../types/theme";

export const TRANSLATIONS = {
  ja: {
    siteTitle: "AME Design Skills",
    siteSubtitle: "Claude Code・AI Agentのための標準UI/UXデザイン規約",
    heroTitle: "AI Agentと人間が共創する、統一デザインシステムの基準",
    heroDescription:
      "AME-Design-Skillsは、TypeScript + Tailwind CSS環境においてAIエージェントと開発者がブレのない美しいUIを構築するための汎用デザイン・タイポグラフィ規約です。",
    installBtn: "スキルをインストール",
    copyCommand: "コマンドをコピー",
    copied: "コピーしました",
    viewGithub: "GitHubで見る",
    demoPlayground: "ライブデモ・設定ツールバー",

    // Toolbar
    themeMode: "テーマモード",
    lightMode: "ライト",
    darkMode: "ダーク",
    systemMode: "システム依存",
    primaryColor: "1ポイントカラー",
    fontStyle: "フォントスタイル",
    fontDefault: "デフォルト (Sans)",
    fontSerif: "Serif",
    fontCustom: "カスタム指定",
    language: "言語",
    customFontPlaceholder: '例: "Hiragino Sans", sans-serif',

    // Tabs
    tabPhilosophy: "核心哲学 & 4大原則",
    tabColor: "配色 & ダークモード",
    tabTypography: "タイポグラフィ & i18n",
    tabIconsDiagrams: "アイコン & 図表",
    tabLinter: "禁止事項チェッカー",
    tabInstallation: "インストール & 導入ガイド",

    // Philosophy section
    philosophyTitle: "1. 核心哲学 (Core Philosophy)",
    philosophy1Title: "引き算のデザイン",
    philosophy1Desc: "自己主張する装飾は排除し、情報伝達に必要な要素のみに絞り込みます。",
    philosophy2Title: "余白による構造",
    philosophy2Desc:
      "境界線（border/hr）ではなく、一貫した余白（gap/margin/padding）で情報構造を構築します。",
    philosophy3Title: "真面目感（フォーマルさ）",
    philosophy3Desc: "開発ツールとして厳格で落ち着いたトーン＆マナーを維持します。",

    principlesTitle: "2. デザイン4大原則 (Design Principles)",
    proximityTitle: "近接 (Proximity)",
    proximityDesc: "関連要素は近く (gap-2, gap-4)、非関連要素は離す (mt-8, p-6)。",
    alignmentTitle: "整列 (Alignment)",
    alignmentDesc:
      "原則「左揃え」で視線誘導を滑らかに。中央揃えは特定のロゴやヒーローメッセージのみ。",
    repetitionTitle: "反復 (Repetition)",
    repetitionDesc:
      "8pxグリッド（4, 8, 16, 24, 32, 48, 64px）を徹底遵守。任意ピクセル値の直打ち禁止。",
    contrastTitle: "コントラスト (Contrast)",
    contrastDesc: "サイズ・太さ・文字色で明確な階層差を定義。曖昧な差を排除。",

    gridInspector: "8px グリッドインスペクター",
    toggleGridOverlay: "8px グリッドオーバーレイ表示切り替え",
    gridActiveNotice:
      "8px単位のグリッドが視覚化されています。要素のmargin, padding, gapがすべて8px（または4px倍数）に基づいています。",

    // Color section
    colorTitle: "配色システム & 1ポイントカラー",
    colorDescription:
      "ライトモード・ダークモードの各環境において、最低 4.5:1 のアクセシビリティコントラスト比（WCAG AA）を満たす1ポイントカラーを定義しています。",
    presetMeaningLabel: "色の意味",
    contrastRatioLabel: "コントラスト比",
    buttonVariants: "ボタンバリエーション & UI状態",
    primaryButton: "Primary Button",
    secondaryButton: "Secondary Button",
    ghostButton: "Ghost Button",
    dangerButton: "Danger Button",
    disabledButton: "Disabled",
    activeColorSwatch: "適用中のカラープリセット",

    // Typography section
    typographyTitle: "タイポグラフィ基準 & 多言語対応",
    typographyDescription:
      "Google Fontsを標準利用し、日本語 (Noto Sans JP / Noto Serif JP) と英語 (Noto Sans / Noto Serif) を言語切り替えに連動させて適用します。",
    headingHierarchy: "見出し階層 (h1, h2, h3, 本文)",
    h1DemoText: "h1: 大見出し (text-2xl font-bold / ヒーロー特例 text-3xl~4xl)",
    h2DemoText: "h2: 中見出し (text-xl font-bold)",
    h3DemoText: "h3: 小見出し (text-lg font-semibold)",
    bodyDemoText:
      "本文 (text-sm font-normal text-gray-600 dark:text-gray-400): 長文読解時の可読性を高めるため、日本語はトラッキング (tracking-wide) と行間 (leading-relaxed) を適用します。",
    monoCodeSection: "コード表示時のフォント適用ルール (Mono)",
    monoDescription:
      "1バイト文字（半角英数・記号）は Noto Sans Mono が適用され、2バイト文字（日本語コメントなど）は自動的にUIフォントへフォールバックします。",
    codeExample: `// AME-Design-Skills: 多言語対応フォント設定
const currentLocale = 'ja'; // 日本語設定
function renderHeader(user) {
  /* ユーザープロフィールの描画処理 (Noto Sans JPへフォールバック) */
  return \`Welcome, \${user.name}\`;
}`,

    // Icons & Diagrams section
    iconsDiagramsTitle: "アイコン・図表規定 (Lucide & HTML/SVG)",
    iconsDescription:
      "ボタンやラベル等の操作要素には対応するLucideアイコンを併記します。図表は内容の複雑さに応じてHTML+TailwindとSVGを使い分けます。",
    htmlDiagramTitle: "HTML + Tailwind 実装例 (簡易フロー図)",
    htmlDiagramDesc:
      "相対配置 flex/grid で表現できる図表はHTMLで実装し、ダークモードやフォント変更・カラー変更に自動追従させます。",
    svgDiagramTitle: "SVG 実装例 (精密ダイアグラム)",
    svgDiagramDesc:
      "座標・パス・曲線が必要な図はSVGで実装し、CSS変数 var(--color-primary) および font-family: var(--font-current-ui) を経由してデザインシステムと完全に同期させます。",

    // Linter section
    linterTitle: "禁止事項チェッカー (Negative Constraints Linter)",
    linterDescription:
      "規約で禁止されているスタイリング（過剰シャドウ, グラデーション背景, 任意ピクセル値, text-justify, 過剰角丸, ハードコードUI文言）を自動検証する対話型ツールのデモです。",
    linterInputLabel: "検証対象のHTML/Tailwindコード:",
    analyzeBtn: "コードをルール検証",
    linterSuccess: "違反項目は見つかりませんでした！規約に適合しています。",
    linterViolationsFound: "以下の禁止事項違反が検出されました:",
    presetSamples: "サンプルコードを試す:",
    sampleClean: "規約準拠コード",
    sampleDirty: "違反が含まれるコード",

    // Installation section
    installationTitle: "スキルインストールの方法",
    installationDesc:
      "Claude Code および AI Agentが自動的にこのSkillを読み込み、コンポーネント生成時に適用できるようセットアップします。",
    step1Title: "前提: リポジトリのクローン",
    step2Title: "OS別インストールコマンド",
    macLinuxTab: "macOS / Linux (シンボリックリンク推奨)",
    windowsTab: "Windows (PowerShell)",
    verifyTitle: "インストール確認",
    verifyDesc:
      "配置後、~/.claude/skills/ 配下に ame-ui-philosophy/SKILL.md および ame-ui-typography/SKILL.md が存在することを確認してください。",

    // Footer
    footerText: "AME Design Skills - Developed with AI & Design Standards",
  },
  en: {
    siteTitle: "AME Design Skills",
    siteSubtitle: "Standard UI/UX Guidelines for Claude Code & AI Agents",
    heroTitle: "Unified Design System Guidelines for AI Agents & Developers",
    heroDescription:
      "AME-Design-Skills provides universal UI and typography conventions for TypeScript + Tailwind CSS projects, ensuring flawless UI generation across AI agents and engineers.",
    installBtn: "Install Skills",
    copyCommand: "Copy Command",
    copied: "Copied",
    viewGithub: "View on GitHub",
    demoPlayground: "Live Demo & Controls",

    // Toolbar
    themeMode: "Theme Mode",
    lightMode: "Light",
    darkMode: "Dark",
    systemMode: "System",
    primaryColor: "Primary Color",
    fontStyle: "Font Style",
    fontDefault: "Default (Sans)",
    fontSerif: "Serif",
    fontCustom: "Custom Font",
    language: "Language",
    customFontPlaceholder: 'e.g. "Inter", sans-serif',

    // Tabs
    tabPhilosophy: "Philosophy & 4 Principles",
    tabColor: "Color & Dark Mode",
    tabTypography: "Typography & i18n",
    tabIconsDiagrams: "Icons & Diagrams",
    tabLinter: "Rules Checker",
    tabInstallation: "Installation Guide",

    // Philosophy section
    philosophyTitle: "1. Core Philosophy",
    philosophy1Title: "Subtractive Design",
    philosophy1Desc:
      "Eliminate decorative noise. Retain only elements that serve explicit information transfer.",
    philosophy2Title: "Whitespace over Borders",
    philosophy2Desc:
      "Construct spatial relationships with consistent whitespace (gap/padding/margin) rather than border lines.",
    philosophy3Title: "Formal Developer Tone",
    philosophy3Desc:
      "Maintain a strict, serious, and composed aesthetic appropriate for developer tools.",

    principlesTitle: "2. Four Core Design Principles",
    proximityTitle: "Proximity",
    proximityDesc:
      "Group related items close together (gap-2, gap-4) and isolate distinct blocks (mt-8, p-6).",
    alignmentTitle: "Alignment",
    alignmentDesc:
      "Enforce left alignment default. Center alignment is restricted to logos or short hero copy.",
    repetitionTitle: "Repetition",
    repetitionDesc:
      "Strictly enforce the 8px spatial grid (4, 8, 16, 24, 32, 48, 64px). Arbitrary values are prohibited.",
    contrastTitle: "Contrast",
    contrastDesc:
      "Establish distinct hierarchy through sizing, weight, and tone. Ambiguous deltas are prohibited.",

    gridInspector: "8px Spatial Grid Inspector",
    toggleGridOverlay: "Toggle 8px Grid Overlay",
    gridActiveNotice:
      "8px spatial grid is now visualized. All padding, margin, and gap parameters strictly adhere to 8px multiples.",

    // Color section
    colorTitle: "Color System & 1-Point Primary Presets",
    colorDescription:
      "Curated primary colors guaranteeing a minimum contrast ratio of 4.5:1 (WCAG 2.1 AA) across both Light and Dark themes.",
    presetMeaningLabel: "Color Meaning",
    contrastRatioLabel: "Contrast Ratio",
    buttonVariants: "Button Variants & UI States",
    primaryButton: "Primary Button",
    secondaryButton: "Secondary Button",
    ghostButton: "Ghost Button",
    dangerButton: "Danger Button",
    disabledButton: "Disabled",
    activeColorSwatch: "Active Color Preset",

    // Typography section
    typographyTitle: "Typography Standards & Internationalization",
    typographyDescription:
      "Mandates Google Fonts, seamlessly pairing Japanese (Noto Sans JP / Noto Serif JP) and English (Noto Sans / Noto Serif) based on locale.",
    headingHierarchy: "Heading Hierarchy (h1, h2, h3, Body)",
    h1DemoText: "h1: Primary Heading (text-2xl font-bold / Hero exception text-3xl~4xl)",
    h2DemoText: "h2: Section Heading (text-xl font-bold)",
    h3DemoText: "h3: Subsection Heading (text-lg font-semibold)",
    bodyDemoText:
      "Body Text (text-sm font-normal text-gray-600 dark:text-gray-400): Standardized line-height (leading-relaxed) and letter spacing to maximize readability.",
    monoCodeSection: "Code Typography Rules (Mono)",
    monoDescription:
      "1-byte characters render via Noto Sans Mono, automatically falling back to UI fonts for 2-byte CJK glyphs.",
    codeExample: `// AME-Design-Skills: i18n Font Routing
const currentLocale = 'en'; // English locale
function renderHeader(user) {
  /* User profile rendering logic */
  return \`Welcome, \${user.name}\`;
}`,

    // Icons & Diagrams section
    iconsDiagramsTitle: "Icons & Diagram Standards (Lucide & HTML/SVG)",
    iconsDescription:
      "Pair interactive action items with Lucide stroke icons. Choose between HTML+Tailwind and SVG depending on diagram layout complexity.",
    htmlDiagramTitle: "HTML + Tailwind Flowchart Example",
    htmlDiagramDesc:
      "Diagrams achievable via flex/grid layouts use pure HTML, automatically inheriting theme, typography, and primary color variables.",
    svgDiagramTitle: "SVG Precision Diagram Example",
    svgDiagramDesc:
      "Coordinate-driven charts use SVG, binding directly to CSS variables var(--color-primary) and var(--font-current-ui).",

    // Linter section
    linterTitle: "Negative Constraints Checker",
    linterDescription:
      "Interactive demonstration tool inspecting code for forbidden styles (heavy shadows, gradient backgrounds, arbitrary pixel values, text-justify, excessive radii, hardcoded UI copy).",
    linterInputLabel: "HTML / Tailwind code to inspect:",
    analyzeBtn: "Analyze Code Rules",
    linterSuccess: "No violations detected! Code fully complies with AME Design Rules.",
    linterViolationsFound: "Rule violations detected:",
    presetSamples: "Try sample snippets:",
    sampleClean: "Compliant Code",
    sampleDirty: "Violating Code",

    // Installation section
    installationTitle: "Skill Installation Guide",
    installationDesc:
      "Configure Claude Code and AI agents to automatically load and apply these design skills during code generation.",
    step1Title: "Prerequisite: Repository Clone",
    step2Title: "OS Installation Commands",
    macLinuxTab: "macOS / Linux (Symlink)",
    windowsTab: "Windows (PowerShell)",
    verifyTitle: "Verify Installation",
    verifyDesc:
      "After installation, verify that ame-ui-philosophy/SKILL.md and ame-ui-typography/SKILL.md exist under ~/.claude/skills/.",

    // Footer
    footerText: "AME Design Skills - Developed with AI & Design Standards",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.ja;
