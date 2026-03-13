"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

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

  const toggleDebug = useCallback(() => {
    setDebugOpen((prev) => {
      const next = !prev;
      setPanelOpen(next);
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
  const ctx = useDebug();
  if (!ctx) return null;

  return (
    <button
      type="button"
      onClick={ctx.toggleDebug}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
        ctx.debugOpen
          ? "bg-amber-500 text-white shadow-amber-500/30 hover:bg-amber-600"
          : "bg-zinc-900 text-white shadow-zinc-900/20 hover:bg-zinc-800"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h.01M8.5 8.5a3.5 3.5 0 1 1 5 3c-.8.7-1.5 1.3-1.5 2.5M12 17h.01" />
      </svg>
      {ctx.debugOpen ? "Debug ON" : "Debug"}
    </button>
  );
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
      <div className="fixed bottom-20 right-6 z-50 w-[280px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/20">
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
