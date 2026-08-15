import React from "react";
import { useSettings } from "../../context/SettingsContext";
import { Sparkles, Grid, AlignLeft, Layers, Contrast } from "lucide-react";

export const PhilosophyTab: React.FC = () => {
  const { t } = useSettings();

  return (
    <div className="space-y-10">
      {/* Core Philosophy Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("philosophyTitle")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="size-8 rounded-md bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("philosophy1Title")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("philosophy1Desc")}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="size-8 rounded-md bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("philosophy2Title")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("philosophy2Desc")}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="size-8 rounded-md bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("philosophy3Title")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("philosophy3Desc")}
            </p>
          </div>
        </div>
      </section>

      {/* 4 Design Principles Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("principlesTitle")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Proximity */}
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-base">
              <Grid className="size-4" />
              {t("proximityTitle")}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("proximityDesc")}</p>

            {/* Interactive Proximity Visualizer */}
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 space-y-3 border border-gray-200 dark:border-gray-800">
              <div className="text-xs font-semibold text-gray-500 uppercase">
                Proximity Demo (gap-2 vs gap-6)
              </div>
              <div className="flex flex-col gap-2">
                <div className="p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-medium">
                  Related Action A (gap-2 close)
                </div>
                <div className="p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-medium">
                  Related Action B (gap-2 close)
                </div>
              </div>
              <div className="mt-6 p-2 rounded bg-primary-subtle text-primary border border-primary-subtle text-xs font-medium">
                Unrelated Section Block (mt-6 separated by whitespace)
              </div>
            </div>
          </div>

          {/* Alignment */}
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-base">
              <AlignLeft className="size-4" />
              {t("alignmentTitle")}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("alignmentDesc")}</p>

            {/* Alignment Visualizer */}
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 space-y-2 border border-gray-200 dark:border-gray-800 text-left">
              <div className="text-xs font-semibold text-gray-500 uppercase">
                Strict Left Alignment (text-left)
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Left Aligned Component Header
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Reading flow is predictable and linear, preventing unnecessary eye movement across
                columns.
              </p>
            </div>
          </div>

          {/* Repetition (8px Grid) */}
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-base">
              <Grid className="size-4" />
              {t("repetitionTitle")}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("repetitionDesc")}</p>

            {/* 8px Spatial Grid Visualizer */}
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 space-y-2 border border-gray-200 dark:border-gray-800">
              <div className="text-xs font-semibold text-gray-500 uppercase">
                Spatial Grid Steps (4, 8, 16, 24, 32px)
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="p-1 rounded bg-gray-200 dark:bg-gray-700 font-mono">
                  4px (gap-1)
                </span>
                <span className="p-2 rounded bg-gray-200 dark:bg-gray-700 font-mono">
                  8px (gap-2)
                </span>
                <span className="p-4 rounded bg-gray-200 dark:bg-gray-700 font-mono">
                  16px (p-4)
                </span>
                <span className="p-6 rounded bg-primary-subtle text-primary font-mono font-semibold">
                  24px (p-6)
                </span>
              </div>
            </div>
          </div>

          {/* Contrast */}
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-base">
              <Contrast className="size-4" />
              {t("contrastTitle")}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("contrastDesc")}</p>

            {/* Contrast Visualizer */}
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 space-y-2 border border-gray-200 dark:border-gray-800">
              <div className="text-xs font-semibold text-gray-500 uppercase">
                Hierarchy Distinction (Size + Weight + Color)
              </div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                Primary Title (16px, Bold, High Contrast)
              </div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                Secondary Subtext (12px, Regular, Muted Contrast)
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
