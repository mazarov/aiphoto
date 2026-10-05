"use client";

import { useMemo, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import type { StickerStyle, StickerStyleGroup } from "@/lib/sticker";

export const STICKER_STYLE_PICKER_TITLE = "Стиль стикера";
export const STICKER_STYLE_PICKER_CONFIRM_CTA = "Выбрать";
export const STICKER_STYLE_PICKER_ALL_GROUPS = "Все";
export const STICKER_STYLE_PROMPT_SHOW = "Промт";
export const STICKER_STYLE_PROMPT_HIDE = "Скрыть промт";

type Props = {
  styles: readonly StickerStyle[];
  groups: readonly StickerStyleGroup[];
  loading?: boolean;
  selectedId: string;
  onSelect: (style: StickerStyle) => void;
  /** Confirm button — closes the sheet in the parent. */
  onConfirmed?: () => void;
  tone?: "light" | "dark";
  confirmCtaClassName: string;
};

export function filterStickerStylesByGroup(
  styles: readonly StickerStyle[],
  groupId: string | null,
): StickerStyle[] {
  if (!groupId) return [...styles];
  return styles.filter((style) => (style.groupId ?? null) === groupId);
}

/**
 * Sticker styles from the bot (`style_presets_v2`) inside the dock «Выбрать стиль» sheet.
 * Each card shows the Russian name, the short description and — on demand — the exact prompt block.
 */
export function StickerStylePicker({
  styles,
  groups,
  loading = false,
  selectedId,
  onSelect,
  onConfirmed,
  tone = "light",
  confirmCtaClassName,
}: Props) {
  const dark = tone === "dark";
  const [groupId, setGroupId] = useState<string | null>(null);
  const [promptOpenId, setPromptOpenId] = useState<string | null>(null);
  const visible = useMemo(() => filterStickerStylesByGroup(styles, groupId), [styles, groupId]);
  const showGroups = groups.length > 1;

  const chip = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition ${
      active
        ? dark
          ? "bg-white/20 text-white ring-1 ring-white/35"
          : "bg-zinc-900 text-white"
        : dark
          ? "bg-white/10 text-white/85 ring-1 ring-white/15"
          : "bg-zinc-100 text-zinc-800"
    }`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {showGroups ? (
        <div className="-mx-1 mb-3 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Группы стилей">
          <button type="button" role="tab" aria-selected={groupId === null} className={chip(groupId === null)} onClick={() => setGroupId(null)}>
            {STICKER_STYLE_PICKER_ALL_GROUPS}
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={groupId === group.id}
              className={chip(groupId === group.id)}
              onClick={() => setGroupId(group.id)}
            >
              {group.emoji ? <span aria-hidden>{group.emoji}</span> : null}
              {group.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {loading && !styles.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`h-24 animate-pulse rounded-2xl ${dark ? "bg-white/10" : "bg-zinc-100"}`} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={STICKER_STYLE_PICKER_TITLE}>
            {visible.map((style) => {
              const active = style.id === selectedId;
              const promptOpen = promptOpenId === style.id;
              return (
                <div
                  key={style.id}
                  className={`flex flex-col rounded-2xl p-3 text-left transition ${
                    active
                      ? dark
                        ? "bg-white/20 ring-2 ring-indigo-300"
                        : "bg-indigo-50 ring-2 ring-indigo-500"
                      : dark
                        ? "bg-white/10 ring-1 ring-white/15"
                        : "bg-zinc-50 ring-1 ring-zinc-200"
                  } ${promptOpen ? "col-span-2 sm:col-span-3" : ""}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelect(style)}
                    className={`${OVERLAY_BUTTON_UA_RESET} flex w-full flex-col items-start text-left`}
                  >
                    <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${dark ? "text-white" : "text-zinc-900"}`}>
                      {style.emoji ? <span aria-hidden>{style.emoji}</span> : null}
                      {style.label}
                    </span>
                    {style.description || style.hint ? (
                      <span className={`mt-1 line-clamp-2 text-[12px] leading-snug ${dark ? "text-white/70" : "text-zinc-600"}`}>
                        {style.description || style.hint}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-expanded={promptOpen}
                    onClick={() => setPromptOpenId(promptOpen ? null : style.id)}
                    className={`${OVERLAY_BUTTON_UA_RESET} mt-2 self-start text-[12px] font-medium underline-offset-2 hover:underline ${
                      dark ? "text-indigo-200" : "text-indigo-600"
                    }`}
                  >
                    {promptOpen ? STICKER_STYLE_PROMPT_HIDE : STICKER_STYLE_PROMPT_SHOW}
                  </button>
                  {promptOpen ? (
                    <p
                      className={`mt-2 whitespace-pre-wrap break-words rounded-xl p-2.5 font-mono text-[11px] leading-relaxed ${
                        dark ? "bg-black/30 text-white/85" : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                      }`}
                    >
                      {style.prompt}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {onConfirmed ? (
        <button type="button" onClick={onConfirmed} className={confirmCtaClassName} disabled={!selectedId}>
          {STICKER_STYLE_PICKER_CONFIRM_CTA}
        </button>
      ) : null}
    </div>
  );
}
