import React, { createContext, useContext, useEffect, useState } from "react";
import { COLOR_PRESETS } from "../data/colorPresets";
import { TRANSLATIONS } from "../data/i18n";
import { AppSettings, FontPreset, Locale, PrimaryColorPresetId, ThemeMode } from "../types/theme";

interface SettingsContextType {
  settings: AppSettings;
  t: (key: keyof typeof TRANSLATIONS.ja) => string;
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setColorPreset: (presetId: PrimaryColorPresetId) => void;
  setFontPreset: (preset: FontPreset) => void;
  setCustomFont: (font: string) => void;
  showGridOverlay: boolean;
  setShowGridOverlay: (show: boolean) => void;
  currentEffectiveTheme: "light" | "dark";
}

const DEFAULT_SETTINGS: AppSettings = {
  locale: "ja",
  themeMode: "system",
  colorPreset: "trust-blue",
  fontPreset: "default",
  customFont: "",
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem("app_settings");
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to parse app_settings from localStorage", e);
    }
    return DEFAULT_SETTINGS;
  });

  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [currentEffectiveTheme, setCurrentEffectiveTheme] = useState<"light" | "dark">("light");

  // Translation lookup helper
  const t = (key: keyof typeof TRANSLATIONS.ja): string => {
    const localeDict = TRANSLATIONS[settings.locale] || TRANSLATIONS.ja;
    return localeDict[key] || TRANSLATIONS.ja[key] || key;
  };

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("app_settings", JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save app_settings to localStorage", e);
    }
  }, [settings]);

  // Handle Theme Mode (light / dark / system)
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
        setCurrentEffectiveTheme("dark");
      } else {
        root.classList.remove("dark");
        setCurrentEffectiveTheme("light");
      }
    };

    if (settings.themeMode === "system") {
      const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(systemQuery.matches);

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      systemQuery.addEventListener("change", listener);
      return () => systemQuery.removeEventListener("change", listener);
    } else {
      applyTheme(settings.themeMode === "dark");
    }
  }, [settings.themeMode]);

  // Handle Primary Color CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const preset = COLOR_PRESETS[settings.colorPreset] || COLOR_PRESETS["trust-blue"];

    const values = currentEffectiveTheme === "dark" ? preset.dark : preset.light;

    root.style.setProperty("--color-primary", values.primary);
    root.style.setProperty("--color-primary-hover", values.hover);
    root.style.setProperty("--color-primary-bg-subtle", values.bgSubtle);
    root.style.setProperty("--color-primary-border", values.border);
  }, [settings.colorPreset, currentEffectiveTheme]);

  // Handle Font variables based on locale and font preset
  useEffect(() => {
    const root = document.documentElement;
    let uiFont = "var(--font-ui-ja-sans)";

    if (settings.fontPreset === "custom" && settings.customFont.trim()) {
      uiFont = settings.customFont;
    } else if (settings.fontPreset === "serif") {
      uiFont = settings.locale === "ja" ? "var(--font-ui-ja-serif)" : "var(--font-ui-en-serif)";
    } else {
      uiFont = settings.locale === "ja" ? "var(--font-ui-ja-sans)" : "var(--font-ui-en-sans)";
    }

    root.style.setProperty("--font-current-ui", uiFont);
    document.body.style.fontFamily = uiFont;
  }, [settings.fontPreset, settings.customFont, settings.locale]);

  const setLocale = (locale: Locale) => setSettings((prev) => ({ ...prev, locale }));

  const setThemeMode = (themeMode: ThemeMode) => setSettings((prev) => ({ ...prev, themeMode }));

  const setColorPreset = (colorPreset: PrimaryColorPresetId) =>
    setSettings((prev) => ({ ...prev, colorPreset }));

  const setFontPreset = (fontPreset: FontPreset) =>
    setSettings((prev) => ({ ...prev, fontPreset }));

  const setCustomFont = (customFont: string) => setSettings((prev) => ({ ...prev, customFont }));

  return (
    <SettingsContext.Provider
      value={{
        settings,
        t,
        setLocale,
        setThemeMode,
        setColorPreset,
        setFontPreset,
        setCustomFont,
        showGridOverlay,
        setShowGridOverlay,
        currentEffectiveTheme,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
