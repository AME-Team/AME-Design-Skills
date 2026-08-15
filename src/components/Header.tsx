import React from "react";
import { Sparkles, Terminal, Copy, Check } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { useSettings } from "../context/SettingsContext";

interface HeaderProps {
  onCopyInstall: () => void;
  copied: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onCopyInstall, copied }) => {
  const { t } = useSettings();

  return (
    <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-200 ease-out">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xs">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {t("siteTitle")}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-subtle text-primary border border-primary-subtle">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                {t("siteSubtitle")}
              </p>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onCopyInstall}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 ease-out focus-primary"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-green-500" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <Terminal className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">{t("copyCommand")}</span>
                  <Copy className="size-3 text-gray-400" />
                </>
              )}
            </button>

            <a
              href="https://github.com/AME-Team/AME-Design-Skills"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-150 ease-out focus-primary"
            >
              <GithubIcon className="size-4" />
              <span>{t("viewGithub")}</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
