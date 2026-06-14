import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Minimal chrome for STV iframe document (same UI as extension side panel). */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</div>
  );
}
