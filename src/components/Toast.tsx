import React from "react";
import { CheckCircle2 } from "lucide-react";

interface ToastProps {
  message: string;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, visible }) => {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg shadow-md transition-opacity duration-200 ease-out"
    >
      <CheckCircle2 className="size-5 text-green-400 dark:text-green-600" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
