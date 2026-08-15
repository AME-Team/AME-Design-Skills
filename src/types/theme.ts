export type Locale = "ja" | "en";

export type ThemeMode = "light" | "dark" | "system";

export type PrimaryColorPresetId =
  "trust-blue" | "stable-green" | "grounded-orange" | "sophisticated-indigo" | "clarity-teal";

export interface PrimaryColorPreset {
  id: PrimaryColorPresetId;
  name: { ja: string; en: string };
  meaning: { ja: string; en: string };
  light: {
    primary: string;
    hover: string;
    bgSubtle: string;
    border: string;
    contrastRatio: string;
  };
  dark: {
    primary: string;
    hover: string;
    bgSubtle: string;
    border: string;
    contrastRatio: string;
  };
}

export type FontPreset = "default" | "serif" | "custom";

export interface AppSettings {
  locale: Locale;
  themeMode: ThemeMode;
  colorPreset: PrimaryColorPresetId;
  fontPreset: FontPreset;
  customFont: string;
}
