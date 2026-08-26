"use client";

import { useGenerateDock } from "@/context/GenerateDockContext";
import { GF_STACK, GF_SURFACE } from "@/components/generate/generaciya-foto-ui";
import { GENERACIYA_FOTO_TOOLS } from "@/lib/generaciya-foto-seo-copy";

export function GeneraciyaFotoToolsGrid() {
  const { seedBlankPrompt } = useGenerateDock();

  return (
    <ul className={`${GF_STACK} grid grid-cols-2 gap-3`}>
      {GENERACIYA_FOTO_TOOLS.items.map((item) => (
        <li key={item.title}>
          <button
            type="button"
            onClick={() =>
              seedBlankPrompt(item.prompt, {
                entrySource: "route",
                intent: "text",
                dockSurface: "prompt",
              })
            }
            className={`flex h-full min-h-11 w-full flex-col p-5 text-left ${GF_SURFACE}`}
          >
            <span className="text-base font-semibold text-zinc-900">
              {item.title}
            </span>
            <span className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              {item.text}
            </span>
            <span className="mt-auto pt-3 text-sm font-semibold text-indigo-700">
              {GENERACIYA_FOTO_TOOLS.tryLabel}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
