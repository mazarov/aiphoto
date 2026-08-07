"use client";

import { useEffect, useId, useRef } from "react";

export type GenerationMenuAction =
  | "select"
  | "share"
  | "download"
  | "copyPrompt"
  | "use"
  | "publish"
  | "delete";

type Props = {
  open: boolean;
  onClose: () => void;
  showSelect?: boolean;
  hasResult: boolean;
  hasPrompt: boolean;
  canPublish: boolean;
  isPublished: boolean;
  busyAction: GenerationMenuAction | null;
  onAction: (action: GenerationMenuAction) => void;
};

const ITEM =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

function IconSelect({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 12.5 10.5 15 16 9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 6.5 20 12l-6 5.5V14c-5 0-8 2-10 5 1-5 4-8.5 10-9V6.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function IconUse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14.5 13v5M12 15.5h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M9 7V5h6v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPublish({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GenerationCardMenu({
  open,
  onClose,
  showSelect = true,
  hasResult,
  hasPrompt,
  canPublish,
  isPublished,
  busyAction,
  onAction,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const root = menuRef.current?.closest("[data-generation-menu-root]");
      if (root && target && !root.contains(target)) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const run = (action: GenerationMenuAction) => {
    if (busyAction) return;
    onAction(action);
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-labelledby={labelId}
      className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-2xl bg-zinc-900 p-1.5 shadow-xl ring-1 ring-white/10"
    >
      <span id={labelId} className="sr-only">
        Действия с генерацией
      </span>

      {showSelect ? (
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          disabled={Boolean(busyAction)}
          onClick={() => run("select")}
        >
          <IconSelect className="h-4 w-4 shrink-0" />
          Выбрать
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={!hasResult || Boolean(busyAction)}
        onClick={() => run("share")}
      >
        <IconShare className="h-4 w-4 shrink-0" />
        Поделиться
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={!hasResult || Boolean(busyAction)}
        onClick={() => run("download")}
      >
        <IconDownload className="h-4 w-4 shrink-0" />
        Скачать
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={!hasPrompt || Boolean(busyAction)}
        onClick={() => run("copyPrompt")}
      >
        <IconCopy className="h-4 w-4 shrink-0" />
        Скопировать промпт
      </button>

      <div className="my-1.5 h-px bg-white/10" role="separator" />

      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={!hasResult || Boolean(busyAction)}
        onClick={() => run("use")}
      >
        <IconUse className="h-4 w-4 shrink-0" />
        {busyAction === "use" ? "Сохраняем…" : "Использовать"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={!canPublish || isPublished || Boolean(busyAction)}
        onClick={() => run("publish")}
      >
        <IconPublish className="h-4 w-4 shrink-0" />
        {busyAction === "publish"
          ? "Публикация…"
          : isPublished
            ? "Опубликовано"
            : "Опубликовать"}
      </button>

      <div className="my-1.5 h-px bg-white/10" role="separator" />

      <button
        type="button"
        role="menuitem"
        className={`${ITEM} text-rose-400 hover:bg-rose-500/15 hover:text-rose-300`}
        disabled={Boolean(busyAction)}
        onClick={() => run("delete")}
      >
        <IconTrash className="h-4 w-4 shrink-0" />
        {busyAction === "delete" ? "Удаляем…" : "Удалить"}
      </button>
    </div>
  );
}
