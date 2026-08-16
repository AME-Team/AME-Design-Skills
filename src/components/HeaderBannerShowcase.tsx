import React, { useMemo, useState } from "react";
import { Download, Copy, Check, Image as ImageIcon, Sparkles } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { generateHeaderSvg } from "../utils/generateHeaderSvg";

interface HeaderBannerShowcaseProps {
  onNotify?: (msg: string) => void;
}

export const HeaderBannerShowcase: React.FC<HeaderBannerShowcaseProps> = ({ onNotify }) => {
  const { settings, currentEffectiveTheme, t } = useSettings();
  const [copied, setCopied] = useState(false);

  // Dynamically generate SVG string whenever settings or theme change
  const svgString = useMemo(() => {
    return generateHeaderSvg({
      locale: settings.locale,
      fontPreset: settings.fontPreset,
      customFont: settings.customFont,
      colorPreset: settings.colorPreset,
      themeMode: currentEffectiveTheme,
    });
  }, [
    settings.locale,
    settings.fontPreset,
    settings.customFont,
    settings.colorPreset,
    currentEffectiveTheme,
  ]);

  const handleCopySvg = () => {
    navigator.clipboard.writeText(svgString).then(() => {
      setCopied(true);
      if (onNotify) {
        onNotify(t("svgCopied"));
      }
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ame-header-${settings.locale}-${settings.colorPreset}-${currentEffectiveTheme}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onNotify) {
      onNotify(t("downloadSvg"));
    }
  };

  return (
    <section className="w-full space-y-4">
      {/* Section Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary-subtle text-primary flex items-center justify-center">
            <ImageIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {t("headerBannerTitle")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("headerBannerSubtitle")}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ease-out focus-primary shadow-xs"
            aria-label={t("copySvg")}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {t("copied")}
                </span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-gray-500" />
                <span>{t("copySvg")}</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-150 ease-out focus-primary shadow-xs"
            aria-label={t("downloadSvg")}
          >
            <Download className="size-3.5" />
            <span>{t("downloadSvg")}</span>
          </button>
        </div>
      </div>

      {/* SVG Image Container */}
      <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2 sm:p-4 transition-colors duration-200 ease-out shadow-xs">
        <div
          className="w-full aspect-[1200/440] flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      </div>

      {/* Live Sync Indicator Pill */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1 font-mono">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary" />
          <span>Live Synchronized SVG Component</span>
        </span>
        <span className="hidden sm:inline text-gray-400 dark:text-gray-500">
          locale: {settings.locale} | font: {settings.fontPreset} | preset: {settings.colorPreset} |
          theme: {currentEffectiveTheme}
        </span>
      </div>
    </section>
  );
};
