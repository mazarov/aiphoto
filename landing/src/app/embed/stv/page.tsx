"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __stvEmbedInjected?: boolean;
  }
}

/**
 * Loads the same Steal This Vibe bundle as the Chrome extension (`extension/sidepanel`).
 * Run `npm run build:stv-web` so `/stv-panel/boot.mjs` exists (also runs before `next build`).
 */
export default function EmbedStvPage() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__stvEmbedInjected) return;
    window.__stvEmbedInjected = true;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/stv-panel/styles.css";
    link.setAttribute("data-stv-embed", "1");
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.type = "module";
    script.src = "/stv-panel/boot.mjs";
    document.body.appendChild(script);
  }, []);

  return <div id="app" className="min-h-dvh min-h-screen" />;
}
