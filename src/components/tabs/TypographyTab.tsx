import React from "react";
import { useSettings } from "../../context/SettingsContext";
import { Type, Code, Globe } from "lucide-react";

export const TypographyTab: React.FC = () => {
  const { settings, t } = useSettings();

  return (
    <div className="space-y-10">
      {/* Overview Header */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="size-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("typographyTitle")}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          {t("typographyDescription")}
        </p>
      </section>

      {/* Heading Scale & Body Demo */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Type className="size-4 text-primary" />
          {t("headingHierarchy")}
        </h3>

        <div className="space-y-6 border-t border-gray-100 dark:border-gray-700/60 pt-4">
          {/* h1 */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-gray-400">h1 (text-2xl font-bold)</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("h1DemoText")}
            </h1>
          </div>

          {/* h2 */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-gray-400">h2 (text-xl font-bold)</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("h2DemoText")}
            </h2>
          </div>

          {/* h3 */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-gray-400">h3 (text-lg font-semibold)</span>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {t("h3DemoText")}
            </h3>
          </div>

          {/* Body Text */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-gray-400">
              Body Text (text-sm font-normal leading-relaxed tracking-wide)
            </span>
            <p className="text-sm font-normal text-gray-600 dark:text-gray-400 leading-relaxed tracking-wide max-w-prose">
              {t("bodyDemoText")}
            </p>
          </div>
        </div>
      </section>

      {/* Side-by-Side Japanese vs English Font Rendering */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Japanese Font Demo */}
        <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Globe className="size-4" />
            日本語 (ja) - Google Fonts: Noto Sans JP / Noto Serif JP
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed tracking-wide">
            引き算のデザインと一貫した8pxグリッドにより、開発ツールとして洗練された視認性を提供します。
          </p>
          <div className="text-xs font-mono text-gray-400 pt-2">
            font-family: 'Noto Sans JP', sans-serif;
          </div>
        </div>

        {/* English Font Demo */}
        <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Globe className="size-4" />
            English (en) - Google Fonts: Noto Sans / Noto Serif
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed tracking-normal">
            Subtractive design and spatial whitespace grid provide refined visual clarity for
            engineering tools.
          </p>
          <div className="text-xs font-mono text-gray-400 pt-2">
            font-family: 'Noto Sans', sans-serif;
          </div>
        </div>
      </section>

      {/* Mono Code Block Typography Section */}
      <section className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Code className="size-5 text-primary" />
            {t("monoCodeSection")}
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            Noto Sans Mono + Fallback
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">{t("monoDescription")}</p>

        <pre className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono-code text-xs overflow-x-auto border border-gray-800 leading-relaxed">
          <code>{t("codeExample")}</code>
        </pre>
      </section>
    </div>
  );
};
