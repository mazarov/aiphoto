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
};

const DebugContext = createContext<DebugContextValue | null>(null);

export function useDebug() {
  const ctx = useContext(DebugContext);
  return ctx;
}

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasFilterPanel, setHasFilterPanel] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "1") setDebugOpen(true);
    } catch {}
  }, []);

  const toggleDebug = useCallback(() => {
    setDebugOpen((prev) => {
      const next = !prev;
      setPanelOpen(next);
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  const value: DebugContextValue = {
    debugOpen,
    toggleDebug,
    setPanelOpen,
    panelOpen,
    hasFilterPanel,
    setHasFilterPanel,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
      <DebugFAB />
      {debugOpen && !hasFilterPanel && panelOpen && <DebugMinimalPanel />}
    </DebugContext.Provider>
  );
}

function DebugFAB() {
  return null;
}

function DebugMinimalPanel() {
  const ctx = useDebug();
  const pathname = usePathname();
  if (!ctx) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={() => ctx.setPanelOpen(false)}
      />
      <div className="fixed bottom-36 sm:bottom-20 right-6 z-50 w-[280px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-zinc-900">Debug</span>
          <button
            type="button"
            onClick={() => ctx.setPanelOpen(false)}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2 text-xs font-mono text-zinc-600">
          <div><span className="text-zinc-400">path:</span> {pathname || "/"}</div>
        </div>
      </div>
    </>
  );
}
