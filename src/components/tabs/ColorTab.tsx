import React from "react";
import { useSettings } from "../../context/SettingsContext";
import { COLOR_PRESETS } from "../../data/colorPresets";
import { PrimaryColorPresetId } from "../../types/theme";
import { Palette, CheckCircle2, ShieldAlert, Sparkles, Check } from "lucide-react";

export const ColorTab: React.FC = () => {
  const { settings, t, setColorPreset, currentEffectiveTheme } = useSettings();

  return (
    <div className="space-y-10">
      {/* Title & Overview */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("colorTitle")}</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          {t("colorDescription")}
        </p>
      </section>

      {/* 5 Primary Color Presets Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(Object.keys(COLOR_PRESETS) as PrimaryColorPresetId[]).map((presetId) => {
          const preset = COLOR_PRESETS[presetId];
          const isSelected = settings.colorPreset === presetId;
          const activeValues = currentEffectiveTheme === "dark" ? preset.dark : preset.light;

          return (
            <div
              key={presetId}
              onClick={() => setColorPreset(presetId)}
              className={`cursor-pointer p-5 rounded-lg bg-white dark:bg-gray-800 border transition-all duration-200 ease-out space-y-4 ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-gray-900 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              {/* Color Header Swatch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: activeValues.primary }}
                  >
                    {isSelected && <Check className="size-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {preset.name[settings.locale]}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("presetMeaningLabel")}: {preset.meaning[settings.locale]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Color Hex & Contrast Details */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <div>
                  <span className="text-gray-400 block">HEX</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                    {activeValues.primary}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">{t("contrastRatioLabel")}</span>
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {activeValues.contrastRatio}
                  </span>
                </div>
              </div>

              {/* Select Status */}
              {isSelected && (
                <div className="text-xs font-semibold text-primary flex items-center gap-1 pt-1">
                  <Sparkles className="size-3.5" />
                  {t("activeColorSwatch")}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Button & UI State Demonstration */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t("buttonVariants")}
        </h3>

        <div className="flex flex-wrap items-center gap-4">
          {/* Primary Button */}
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-150 ease-out focus-primary shadow-xs">
            {t("primaryButton")}
          </button>

          {/* Secondary Button */}
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150 ease-out focus-primary">
            {t("secondaryButton")}
          </button>

          {/* Ghost / Subtle Button */}
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-primary-subtle text-primary border border-primary-subtle hover:bg-primary/10 transition-colors duration-150 ease-out focus-primary">
            {t("ghostButton")}
          </button>

          {/* Danger Button */}
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors duration-150 ease-out focus-primary">
            <ShieldAlert className="size-4 inline mr-1" />
            {t("dangerButton")}
          </button>

          {/* Disabled Button */}
          <button
            disabled
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
          >
            {t("disabledButton")}
          </button>
        </div>
      </section>
    </div>
  );
};
