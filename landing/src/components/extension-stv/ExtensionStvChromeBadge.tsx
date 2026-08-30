import { ChromeMark } from "@/components/foto-v-promt/ChromeMark";

export function ExtensionStvChromeBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300 ${className ?? ""}`}
    >
      <ChromeMark className="h-3.5 w-3.5 shrink-0" />
      Chrome extension
    </span>
  );
}
