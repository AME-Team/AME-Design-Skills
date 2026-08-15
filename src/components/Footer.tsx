import React from "react";
import { useSettings } from "../context/SettingsContext";
import { Sparkles } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";

export const Footer: React.FC = () => {
  const { t } = useSettings();

  return (
    <footer className="w-full border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-8 transition-colors duration-200 ease-out">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span>{t("footerText")}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono">MIT License</span>
            <a
              href="https://github.com/AME-Team/AME-Design-Skills"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <GithubIcon className="size-4" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
