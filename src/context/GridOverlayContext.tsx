import React, { createContext, useContext, useState } from "react";

interface GridOverlayContextType {
  showGridOverlay: boolean;
  setShowGridOverlay: (show: boolean) => void;
}

const GridOverlayContext = createContext<GridOverlayContextType | undefined>(undefined);

// 8px グリッドオーバーレイはデモ検証用の一時 UI 状態（app_settings に永続化しない）
export const GridOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  return (
    <GridOverlayContext.Provider value={{ showGridOverlay, setShowGridOverlay }}>
      {children}
    </GridOverlayContext.Provider>
  );
};

export const useGridOverlay = () => {
  const context = useContext(GridOverlayContext);
  if (!context) {
    throw new Error("useGridOverlay must be used within a GridOverlayProvider");
  }
  return context;
};
