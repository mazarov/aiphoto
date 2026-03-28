import type { ReactNode } from "react";

/**
 * Маркетинговый превью-лендинг расширения STV (без каталога / сайдбара).
 * Спека: docs/extension-landing-pain-hope-solution.md
 * Цвета: как в extension/sidepanel/styles.css (--stv-*).
 */
export default function ExtensionStvMarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased [--stv-primary:#6366f1] [--stv-primary-hover:#4f46e5] [--stv-accent:#8b5cf6] [--stv-border:rgb(255_255_255/0.08)] [--stv-surface:rgb(24_24_27/0.92)]">
      {children}
    </div>
  );
}
