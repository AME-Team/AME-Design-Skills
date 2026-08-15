import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsProvider } from "./context/SettingsContext";
import { GridOverlayProvider } from "./context/GridOverlayContext";
import { AppContent } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      <GridOverlayProvider>
        <AppContent />
      </GridOverlayProvider>
    </SettingsProvider>
  </React.StrictMode>
);
