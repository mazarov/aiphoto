"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

const LS_KEY = "debug_open";

type DebugContextValue = {
  debugOpen: boolean;
  toggleDebug: () => void;
  setPanelOpen: (open: boolean) => void;
  panelOpen: boolean;
  hasFilterPanel: boolean;
  setHasFilterPanel: (v: boolean) => void;
  pendingDataset: string | null;
  setPendingDataset: (v: string | null) => void;
};

const DebugContext = createContext<DebugContextValue | null>(null);

export function useDebug() {
  const ctx = useContext(DebugContext);
  return ctx;
}

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [debugOpen, setDebugOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasFilterPanel, setHasFilterPanel] = useState(false);
  const [pendingDataset, setPendingDataset] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "1") setDebugOpen(true);
    } catch {}
  }, []);

  // Панель фильтров только на главной (HomeDebugCatalog).
  useEffect(() => {
    if (pathname !== "/" && panelOpen) {
      setPanelOpen(false);
    }
  }, [pathname, panelOpen]);

  useEffect(() => {
    if (pathname === "/" && debugOpen && hasFilterPanel) {
      setPanelOpen(true);
    }
  }, [pathname, debugOpen, hasFilterPanel]);

  const toggleDebug = useCallback(() => {
    setDebugOpen((prev) => {
      const next = !prev;
      setPanelOpen(next && pathname === "/");
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {}
      if (next && pathname === "/") {
        requestAnimationFrame(() => {
          document.getElementById("debug-catalog")?.scrollIntoView({ behavior: "smooth" });
        });
      }
      return next;
    });
  }, [pathname]);

  const value: DebugContextValue = {
    debugOpen,
    toggleDebug,
    setPanelOpen,
    panelOpen,
    hasFilterPanel,
    setHasFilterPanel,
    pendingDataset,
    setPendingDataset,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
      <DebugFAB />
    </DebugContext.Provider>
  );
}

function DebugFAB() {
  return null;
}
