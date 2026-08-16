import { COLOR_PRESETS } from "../data/colorPresets";
import { FontPreset, Locale, PrimaryColorPresetId, ThemeMode } from "../types/theme";

export interface HeaderSvgOptions {
  locale?: Locale;
  fontPreset?: FontPreset;
  customFont?: string;
  colorPreset?: PrimaryColorPresetId;
  themeMode?: ThemeMode; // "light" | "dark" | "system"
}

export const DEFAULT_HEADER_OPTIONS: Required<HeaderSvgOptions> = {
  locale: "ja",
  fontPreset: "default",
  customFont: "",
  colorPreset: "trust-blue",
  themeMode: "system",
};

interface SvgLabels {
  ariaLabel: string;
  tagline: string;
  badgeSkills: string;
  badgeStack: string;
  badgeAgent: string;
  badgeStatus: string;
  card1Title: string;
  card1Desc: string;
  card2Title: string;
  card2Desc: string;
  card3Title: string;
  card3Desc: string;
  badgeSans: string;
  badgeSerif: string;
  badgeMono: string;
}

const LABELS_JA: SvgLabels = {
  ariaLabel: "AME Design Skills ヘッダーバナー",
  tagline: "Claude Code・AI Agentのための標準UI/UXデザイン規約 & タイポグラフィシステム",
  badgeSkills: "AME Design Skills",
  badgeStack: "TypeScript + Tailwind CSS",
  badgeAgent: "Claude Code Ready",
  badgeStatus: "Dual-Gate Verified",
  card1Title: "引き算のデザイン & 8px余白",
  card1Desc: "装飾を排除し、8pxグリッドと余白で厳格な情報構造を構築",
  card2Title: "1-Point Color & Dark Mode",
  card2Desc: "WCAG 2.1 AA (4.5:1+) 適合の5色プリセットと高精度ダークモード",
  card3Title: "Google Fonts & i18n 連動",
  card3Desc: "Noto Sans JP / Noto Sans / Mono の言語・コンテキスト連動ルーティング",
  badgeSans: "Sans",
  badgeSerif: "Serif",
  badgeMono: "Mono",
};

const LABELS_EN: SvgLabels = {
  ariaLabel: "AME Design Skills Header Banner",
  tagline: "Universal UI/UX Design System & Typography Guidelines for Claude Code & AI Agents",
  badgeSkills: "AME Design Skills",
  badgeStack: "TypeScript + Tailwind CSS",
  badgeAgent: "Claude Code Ready",
  badgeStatus: "Dual-Gate Verified",
  card1Title: "Subtractive Design & 8px Grid",
  card1Desc: "Eliminate decorative noise. Structure content via 8px spatial grid.",
  card2Title: "1-Point Color & Dark Mode",
  card2Desc: "5 WCAG AA (4.5:1+) presets with seamless dark mode synchronization.",
  card3Title: "Google Fonts & i18n Routing",
  card3Desc: "Automated routing across Noto Sans JP, Noto Sans, and Mono fonts.",
  badgeSans: "Sans",
  badgeSerif: "Serif",
  badgeMono: "Mono",
};

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sanitizeFontFamily(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // 1. Split by comma first (token boundary) to prevent mid-token truncation
  const tokens = input.split(",").slice(0, 5);

  const sanitizedFonts: string[] = [];

  for (const token of tokens) {
    // 2. Bound per-font name length to 50 characters
    const boundedToken = token.slice(0, 50);

    // 3. Strip any quotes, backticks, slashes, and XML/HTML special characters
    const sanitized = boundedToken
      .replace(
        /[^a-zA-Z0-9\s\-_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g,
        ""
      )
      .trim();

    if (!sanitized) {
      continue;
    }

    // 4. Safely quote if contains spaces or non-ASCII characters
    if (/[\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(sanitized)) {
      sanitizedFonts.push(`'${sanitized}'`);
    } else {
      sanitizedFonts.push(sanitized);
    }
  }

  return sanitizedFonts.join(", ");
}

export function generateHeaderSvg(options: HeaderSvgOptions = {}): string {
  const {
    locale = "ja",
    fontPreset = "default",
    customFont = "",
    colorPreset = "trust-blue",
    themeMode = "system",
  } = options;

  const rawLabels = locale === "en" ? LABELS_EN : LABELS_JA;
  // XML-escape all labels to guarantee well-formed SVG output in all locales
  const labels: SvgLabels = {
    ariaLabel: escapeXml(rawLabels.ariaLabel),
    tagline: escapeXml(rawLabels.tagline),
    badgeSkills: escapeXml(rawLabels.badgeSkills),
    badgeStack: escapeXml(rawLabels.badgeStack),
    badgeAgent: escapeXml(rawLabels.badgeAgent),
    badgeStatus: escapeXml(rawLabels.badgeStatus),
    card1Title: escapeXml(rawLabels.card1Title),
    card1Desc: escapeXml(rawLabels.card1Desc),
    card2Title: escapeXml(rawLabels.card2Title),
    card2Desc: escapeXml(rawLabels.card2Desc),
    card3Title: escapeXml(rawLabels.card3Title),
    card3Desc: escapeXml(rawLabels.card3Desc),
    badgeSans: escapeXml(rawLabels.badgeSans),
    badgeSerif: escapeXml(rawLabels.badgeSerif),
    badgeMono: escapeXml(rawLabels.badgeMono),
  };
  const presetData = COLOR_PRESETS[colorPreset] || COLOR_PRESETS["trust-blue"];

  // Font family resolution with robust fallback stack
  const sanitizedCustom = fontPreset === "custom" ? sanitizeFontFamily(customFont) : "";
  let fontFamily: string;
  if (sanitizedCustom) {
    fontFamily = `${sanitizedCustom}, system-ui, sans-serif`;
  } else if (fontPreset === "serif") {
    fontFamily =
      locale === "ja"
        ? "'Noto Serif JP', 'Noto Serif', 'Times New Roman', serif"
        : "'Noto Serif', 'Times New Roman', serif";
  } else {
    fontFamily =
      locale === "ja"
        ? "'Noto Sans JP', 'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        : "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }

  const primaryLight = presetData.light.primary;
  const primaryLightHover = presetData.light.hover;
  const primaryLightSubtle = presetData.light.bgSubtle;
  const primaryLightBorder = presetData.light.border;

  const primaryDark = presetData.dark.primary;
  const primaryDarkHover = presetData.dark.hover;
  const primaryDarkSubtle = presetData.dark.bgSubtle;
  const primaryDarkBorder = presetData.dark.border;

  // 5 Color Preset swatches derived dynamically from COLOR_PRESETS (Single Source of Truth)
  const colorSwatches = Object.values(COLOR_PRESETS).map((preset) => ({
    id: preset.id,
    name: locale === "ja" ? preset.name.ja : preset.name.en,
    color: themeMode === "dark" ? preset.dark.primary : preset.light.primary,
    isSelected: preset.id === colorPreset,
  }));

  // Dynamic CSS according to theme mode
  let cssThemeRules = "";

  if (themeMode === "dark") {
    cssThemeRules = `
      .ame-hdr-root {
        --ame-hdr-bg-main: #0f172a;
        --ame-hdr-bg-card: #1e293b;
        --ame-hdr-bg-subtle: #334155;
        --ame-hdr-border-main: #334155;
        --ame-hdr-border-card: #475569;
        --ame-hdr-text-title: #f8fafc;
        --ame-hdr-text-body: #94a3b8;
        --ame-hdr-text-subtle: #64748b;
        --ame-hdr-color-primary: ${primaryDark};
        --ame-hdr-color-primary-hover: ${primaryDarkHover};
        --ame-hdr-color-primary-subtle: ${primaryDarkSubtle};
        --ame-hdr-color-primary-border: ${primaryDarkBorder};
      }
    `;
  } else if (themeMode === "light") {
    cssThemeRules = `
      .ame-hdr-root {
        --ame-hdr-bg-main: #ffffff;
        --ame-hdr-bg-card: #f8fafc;
        --ame-hdr-bg-subtle: #f1f5f9;
        --ame-hdr-border-main: #e2e8f0;
        --ame-hdr-border-card: #e2e8f0;
        --ame-hdr-text-title: #0f172a;
        --ame-hdr-text-body: #475569;
        --ame-hdr-text-subtle: #94a3b8;
        --ame-hdr-color-primary: ${primaryLight};
        --ame-hdr-color-primary-hover: ${primaryLightHover};
        --ame-hdr-color-primary-subtle: ${primaryLightSubtle};
        --ame-hdr-color-primary-border: ${primaryLightBorder};
      }
    `;
  } else {
    // system (supports prefers-color-scheme)
    cssThemeRules = `
      .ame-hdr-root {
        --ame-hdr-bg-main: #ffffff;
        --ame-hdr-bg-card: #f8fafc;
        --ame-hdr-bg-subtle: #f1f5f9;
        --ame-hdr-border-main: #e2e8f0;
        --ame-hdr-border-card: #e2e8f0;
        --ame-hdr-text-title: #0f172a;
        --ame-hdr-text-body: #475569;
        --ame-hdr-text-subtle: #94a3b8;
        --ame-hdr-color-primary: ${primaryLight};
        --ame-hdr-color-primary-hover: ${primaryLightHover};
        --ame-hdr-color-primary-subtle: ${primaryLightSubtle};
        --ame-hdr-color-primary-border: ${primaryLightBorder};
      }
      @media (prefers-color-scheme: dark) {
        .ame-hdr-root {
          --ame-hdr-bg-main: #0f172a;
          --ame-hdr-bg-card: #1e293b;
          --ame-hdr-bg-subtle: #334155;
          --ame-hdr-border-main: #334155;
          --ame-hdr-border-card: #475569;
          --ame-hdr-text-title: #f8fafc;
          --ame-hdr-text-body: #94a3b8;
          --ame-hdr-text-subtle: #64748b;
          --ame-hdr-color-primary: ${primaryDark};
          --ame-hdr-color-primary-hover: ${primaryDarkHover};
          --ame-hdr-color-primary-subtle: ${primaryDarkSubtle};
          --ame-hdr-color-primary-border: ${primaryDarkBorder};
        }
      }
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 440" width="1200" height="440" class="ame-hdr-root" role="img" aria-label="${labels.ariaLabel}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wght@400;600&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&amp;display=swap');

      ${cssThemeRules}

      .ame-hdr-svg-bg { fill: var(--ame-hdr-bg-main); stroke: var(--ame-hdr-border-main); stroke-width: 1.5; }
      .ame-hdr-svg-card-bg { fill: var(--ame-hdr-bg-card); stroke: var(--ame-hdr-border-card); stroke-width: 1; }
      .ame-hdr-svg-subtle-box { fill: var(--ame-hdr-bg-subtle); }

      .ame-hdr-text-title { font-family: ${fontFamily}; font-size: 32px; font-weight: 700; fill: var(--ame-hdr-text-title); letter-spacing: -0.02em; }
      .ame-hdr-text-tagline { font-family: ${fontFamily}; font-size: 15px; font-weight: 400; fill: var(--ame-hdr-text-body); letter-spacing: 0.01em; }

      .ame-hdr-badge-primary-bg { fill: var(--ame-hdr-color-primary-subtle); stroke: var(--ame-hdr-color-primary-border); stroke-width: 1; }
      .ame-hdr-badge-primary-text { font-family: ${fontFamily}; font-size: 12px; font-weight: 600; fill: var(--ame-hdr-color-primary); }

      .ame-hdr-badge-neutral-bg { fill: var(--ame-hdr-bg-subtle); stroke: var(--ame-hdr-border-card); stroke-width: 1; }
      .ame-hdr-badge-neutral-text { font-family: 'Noto Sans Mono', monospace; font-size: 11px; font-weight: 500; fill: var(--ame-hdr-text-body); }

      .ame-hdr-card-title { font-family: ${fontFamily}; font-size: 14px; font-weight: 700; fill: var(--ame-hdr-text-title); }
      .ame-hdr-card-desc { font-family: ${fontFamily}; font-size: 12px; font-weight: 400; fill: var(--ame-hdr-text-body); line-height: 1.5; }

      .ame-hdr-mono-text { font-family: 'Noto Sans Mono', monospace; font-size: 11px; fill: var(--ame-hdr-text-subtle); }
      .ame-hdr-icon-primary { stroke: var(--ame-hdr-color-primary); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </defs>

  <!-- Background Canvas -->
  <rect x="1" y="1" width="1198" height="438" rx="12" class="ame-hdr-svg-bg" />

  <!-- Subtle 8px Grid Decoration in Header Top Right -->
  <g opacity="0.4" transform="translate(1000, 32)">
    <circle cx="0" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="16" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="32" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="48" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="64" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="80" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="96" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="112" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="128" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="144" cy="0" r="1.5" fill="var(--ame-hdr-color-primary)" />

    <circle cx="0" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="16" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="32" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="48" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="64" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="80" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="96" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="112" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="128" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="144" cy="16" r="1.5" fill="var(--ame-hdr-color-primary)" />

    <circle cx="0" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="16" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="32" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="48" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="64" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="80" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="96" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="112" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="128" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
    <circle cx="144" cy="32" r="1.5" fill="var(--ame-hdr-color-primary)" />
  </g>

  <!-- ================= TOP BADGE ROW ================= -->
  <g transform="translate(48, 36)">
    <!-- Brand Icon -->
    <rect x="0" y="0" width="32" height="32" rx="6" fill="var(--ame-hdr-color-primary)" />
    <path d="M 16 7 L 18 13 L 24 15 L 18 17 L 16 23 L 14 17 L 8 15 L 14 13 Z" fill="#ffffff" />

    <!-- Skill Identity Badge -->
    <rect x="42" y="3" width="146" height="26" rx="6" class="ame-hdr-badge-primary-bg" />
    <path d="M 52 16 L 55 19 L 61 13" class="ame-hdr-icon-primary" stroke-width="1.5" />
    <text x="67" y="20" class="ame-hdr-badge-primary-text">${labels.badgeSkills}</text>

    <!-- Stack Badge -->
    <rect x="198" y="3" width="168" height="26" rx="6" class="ame-hdr-badge-neutral-bg" />
    <text x="210" y="20" class="ame-hdr-badge-neutral-text">${labels.badgeStack}</text>

    <!-- Claude Code Ready Badge -->
    <rect x="376" y="3" width="144" height="26" rx="6" class="ame-hdr-badge-neutral-bg" />
    <text x="388" y="20" class="ame-hdr-badge-neutral-text">${labels.badgeAgent}</text>

    <!-- Dual-Gate Status Badge -->
    <rect x="530" y="3" width="140" height="26" rx="6" class="ame-hdr-badge-neutral-bg" />
    <circle cx="542" cy="16" r="3.5" fill="#10b981" />
    <text x="552" y="20" class="ame-hdr-badge-neutral-text">${labels.badgeStatus}</text>
  </g>

  <!-- ================= MAIN HEADER TITLE and TAGLINE ================= -->
  <g transform="translate(48, 120)">
    <text x="0" y="0" class="ame-hdr-text-title">AME-Design-Skills</text>
    <text x="0" y="34" class="ame-hdr-text-tagline">${labels.tagline}</text>
  </g>

  <!-- Code command pill -->
  <g transform="translate(48, 182)">
    <rect x="0" y="0" width="460" height="34" rx="6" class="ame-hdr-svg-subtle-box" stroke="var(--ame-hdr-border-card)" stroke-width="1" />
    <text x="14" y="22" class="ame-hdr-mono-text"><tspan fill="var(--ame-hdr-color-primary)">$</tspan> mkdir -p ~/.claude/skills &amp;&amp; cp -R .claude/skills/. ~/.claude/skills/</text>
  </g>

  <!-- ================= 3 FEATURE PILLARS (8px GRID) ================= -->

  <!-- Pillar 1: Philosophy -->
  <g transform="translate(48, 244)">
    <rect x="0" y="0" width="344" height="152" rx="8" class="ame-hdr-svg-card-bg" />

    <rect x="16" y="16" width="32" height="32" rx="6" class="ame-hdr-badge-primary-bg" />
    <g transform="translate(22, 22)">
      <!-- Lucide Sparkles Icon -->
      <path d="M 10 2 L 11.5 6.5 L 16 8 L 11.5 9.5 L 10 14 L 8.5 9.5 L 4 8 L 8.5 6.5 Z" class="ame-hdr-icon-primary" />
    </g>

    <text x="58" y="37" class="ame-hdr-card-title">${labels.card1Title}</text>
    <text x="16" y="74" class="ame-hdr-card-desc">${labels.card1Desc}</text>

    <!-- Sub-badge pills -->
    <g transform="translate(16, 110)">
      <rect x="0" y="0" width="76" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="8" y="15" class="ame-hdr-badge-neutral-text">8px Grid</text>

      <rect x="84" y="0" width="94" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="92" y="15" class="ame-hdr-badge-neutral-text">Proximity</text>

      <rect x="186" y="0" width="90" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="194" y="15" class="ame-hdr-badge-neutral-text">Alignment</text>
    </g>
  </g>

  <!-- Pillar 2: Color System -->
  <g transform="translate(424, 244)">
    <rect x="0" y="0" width="344" height="152" rx="8" class="ame-hdr-svg-card-bg" />

    <rect x="16" y="16" width="32" height="32" rx="6" class="ame-hdr-badge-primary-bg" />
    <g transform="translate(22, 22)">
      <!-- Lucide Palette Icon -->
      <circle cx="6" cy="6" r="1.5" fill="var(--ame-hdr-color-primary)" />
      <circle cx="12" cy="6" r="1.5" fill="var(--ame-hdr-color-primary)" />
      <circle cx="15" cy="11" r="1.5" fill="var(--ame-hdr-color-primary)" />
      <path d="M 10 1.5 C 5.3 1.5 1.5 5.3 1.5 10 C 1.5 14.7 5.3 18.5 10 18.5 C 11.2 18.5 12.2 17.5 12.2 16.3 C 12.2 15.7 12 15.2 11.5 14.8 C 11.1 14.4 10.9 13.9 10.9 13.3 C 10.9 12.1 11.9 11.1 13.1 11.1 L 15.2 11.1 C 17 11.1 18.5 9.6 18.5 7.8 C 18.5 4.3 14.7 1.5 10 1.5 Z" class="ame-hdr-icon-primary" />
    </g>

    <text x="58" y="37" class="ame-hdr-card-title">${labels.card2Title}</text>
    <text x="16" y="74" class="ame-hdr-card-desc">${labels.card2Desc}</text>

    <!-- Color Swatches (5 Presets) -->
    <g transform="translate(16, 114)">
      ${colorSwatches
        .map(
          (swatch, idx) => `
        <circle cx="${idx * 26 + 10}" cy="10" r="9" fill="${swatch.color}" stroke="${
          swatch.isSelected ? "var(--ame-hdr-text-title)" : "var(--ame-hdr-border-card)"
        }" stroke-width="${swatch.isSelected ? "2" : "1"}" />
      `
        )
        .join("")}
      <text x="146" y="14" class="ame-hdr-badge-neutral-text">WCAG 4.5:1 AA</text>
    </g>
  </g>

  <!-- Pillar 3: Typography and i18n -->
  <g transform="translate(800, 244)">
    <rect x="0" y="0" width="352" height="152" rx="8" class="ame-hdr-svg-card-bg" />

    <rect x="16" y="16" width="32" height="32" rx="6" class="ame-hdr-badge-primary-bg" />
    <g transform="translate(22, 22)">
      <!-- Lucide Type Icon -->
      <polyline points="2 4 18 4" class="ame-hdr-icon-primary" />
      <line x1="10" y1="4" x2="10" y2="18" class="ame-hdr-icon-primary" />
      <line x1="7" y1="18" x2="13" y2="18" class="ame-hdr-icon-primary" />
    </g>

    <text x="58" y="37" class="ame-hdr-card-title">${labels.card3Title}</text>
    <text x="16" y="74" class="ame-hdr-card-desc">${labels.card3Desc}</text>

    <!-- Font Family Type Badges -->
    <g transform="translate(16, 110)">
      <rect x="0" y="0" width="96" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="8" y="15" class="ame-hdr-badge-neutral-text" style="font-family: 'Noto Sans JP', 'Noto Sans', sans-serif;">${labels.badgeSans} (Noto)</text>

      <rect x="104" y="0" width="98" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="112" y="15" class="ame-hdr-badge-neutral-text" style="font-family: 'Noto Serif JP', 'Noto Serif', serif;">${labels.badgeSerif} (Serif)</text>

      <rect x="210" y="0" width="96" height="22" rx="4" class="ame-hdr-badge-neutral-bg" />
      <text x="218" y="15" class="ame-hdr-badge-neutral-text" style="font-family: 'Noto Sans Mono', monospace;">${labels.badgeMono} (Code)</text>
    </g>
  </g>
</svg>`;
}
