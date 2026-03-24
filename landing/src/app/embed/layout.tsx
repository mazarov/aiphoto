import type { ReactNode } from "react";

/** Minimal chrome for STV iframe document (same UI as extension side panel). */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</div>
  );
}
