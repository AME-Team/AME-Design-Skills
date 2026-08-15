import React, { useState } from "react";
import { Palette, Sun, Moon, Laptop, Type, Globe, Check, ChevronDown } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { COLOR_PRESETS } from "../data/colorPresets";
import { FontPreset, PrimaryColorPresetId, ThemeMode } from "../types/theme";

export const InteractiveToolbar: React.FC = () => {
  const {
    settings,
    t,
    setLocale,
    setThemeMode,
    setColorPreset,
    setFontPreset,
    setCustomFont,
    currentEffectiveTheme,
  } = useSettings();

  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  return (
    <aside
      aria-label={t("demoPlayground")}
      className="sticky top-0 z-40 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors duration-200 ease-out"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Section Title */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Palette className="size-4" />
              {t("demoPlayground")}
            </span>
          </div>

          {/* Controls Group */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* 1-Point Primary Color Presets */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">
                {t("primaryColor")}:
              </span>
              <div
                className="flex items-center gap-1.5"
                role="radiogroup"
                aria-label={t("primaryColor")}
              >
                {(Object.keys(COLOR_PRESETS) as PrimaryColorPresetId[]).map((presetId) => {
                  const preset = COLOR_PRESETS[presetId];
                  const colorHex =
                    currentEffectiveTheme === "dark" ? preset.dark.primary : preset.light.primary;
                  const isSelected = settings.colorPreset === presetId;

                  return (
                    <button
                      key={presetId}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${preset.name[settings.locale]} (${preset.meaning[settings.locale]})`}
                      title={`${preset.name[settings.locale]} - ${preset.meaning[settings.locale]}`}
                      onClick={() => setColorPreset(presetId)}
                      className={`relative size-6 rounded-full flex items-center justify-center transition-all duration-150 ease-out focus-primary ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-primary ring-offset-white dark:ring-offset-gray-900 scale-110"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: colorHex }}
                    >
                      {isSelected && <Check className="size-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Mode Toggle */}
            <div
              className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md"
              role="radiogroup"
              aria-label={t("themeMode")}
            >
              {[
                { mode: "light" as ThemeMode, label: t("lightMode"), icon: Sun },
                { mode: "dark" as ThemeMode, label: t("darkMode"), icon: Moon },
                { mode: "system" as ThemeMode, label: t("systemMode"), icon: Laptop },
              ].map(({ mode, label, icon: Icon }) => {
                const active = settings.themeMode === mode;
                return (
                  <button
                    key={mode}
                    role="radio"
                    aria-checked={active}
                    aria-label={label}
                    title={label}
                    onClick={() => setThemeMode(mode)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors duration-150 ease-out focus-primary ${
                      active
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span className="hidden md:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Font Style Selector */}
            <div className="relative">
              <button
                onClick={() => setFontMenuOpen(!fontMenuOpen)}
                aria-expanded={fontMenuOpen}
                aria-haspopup="true"
                aria-label={t("fontStyle")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 ease-out focus-primary"
              >
                <Type className="size-3.5 text-primary" />
                <span>
                  {settings.fontPreset === "default" && t("fontDefault")}
                  {settings.fontPreset === "serif" && t("fontSerif")}
                  {settings.fontPreset === "custom" && t("fontCustom")}
                </span>
                <ChevronDown className="size-3 text-gray-400" />
              </button>

              {fontMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md p-2 space-y-1 z-50">
                  <div className="text-[11px] font-semibold uppercase text-gray-400 px-2 py-1">
                    {t("fontStyle")}
                  </div>
                  {[
                    { key: "default" as FontPreset, label: t("fontDefault") },
                    { key: "serif" as FontPreset, label: t("fontSerif") },
                    { key: "custom" as FontPreset, label: t("fontCustom") },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setFontPreset(key);
                        if (key !== "custom") setFontMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left text-xs transition-colors duration-150 ${
                        settings.fontPreset === key
                          ? "bg-primary-subtle text-primary font-semibold"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span>{label}</span>
                      {settings.fontPreset === key && <Check className="size-3" />}
                    </button>
                  ))}

                  {settings.fontPreset === "custom" && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 px-1">
                      <input
                        type="text"
                        placeholder={t("customFontPlaceholder")}
                        value={settings.customFont}
                        onChange={(e) => setCustomFont(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus-primary"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Language Selector (i18n) */}
            <div
              className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md"
              role="radiogroup"
              aria-label={t("language")}
            >
              <button
                role="radio"
                aria-checked={settings.locale === "ja"}
                onClick={() => setLocale("ja")}
                className={`px-2 py-1 rounded-md transition-colors duration-150 ease-out focus-primary ${
                  settings.locale === "ja"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Globe className="size-3" /> 日本語
                </span>
              </button>

              <button
                role="radio"
                aria-checked={settings.locale === "en"}
                onClick={() => setLocale("en")}
                className={`px-2 py-1 rounded-md transition-colors duration-150 ease-out focus-primary ${
                  settings.locale === "en"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <span>English</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
