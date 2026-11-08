"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckIcon,
  CrossIcon,
  PlusIcon,
  REVEAL_ON_HOVER,
  SpinnerIcon,
  TILE_BUTTON,
} from "@/components/admin/tile-action-ui";
import { useAuth } from "@/context/AuthContext";
import { useDebugCardHidden } from "@/hooks/useDebugCardHidden";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";
import type { GenerationExampleCard } from "@/lib/generation/example-card";
import { heroTileAction, type HeroTileMode } from "@/lib/page-hero-ui";

type PageHeroPin = {
  cardId: string;
  slug: string;
  title: string;
  photoUrl: string | null;
  hidden: boolean;
};

type HeroNotice = { kind: "ok" | "error"; text: string };

type HeroWrite = { op: "pin" | "unpin"; cardId?: string; query?: string };

type HeroCurationValue = {
  isAdmin: boolean;
  ready: boolean;
  pins: PageHeroPin[];
  pinnedIds: ReadonlySet<string>;
  /** Public carousel after the last admin read or write; null until loaded. */
  carousel: GenerationExampleCard[] | null;
  pendingKey: string | null;
  notice: HeroNotice | null;
  write: (body: HeroWrite) => Promise<boolean>;
};

const HeroCurationContext = createContext<HeroCurationValue | null>(null);

export function useHeroCuration(): HeroCurationValue | null {
  return useContext(HeroCurationContext);
}

type HeroResponse = { pins: PageHeroPin[]; carousel: GenerationExampleCard[] };

async function readHero(response: Response): Promise<HeroResponse> {
  const body = (await response.json()) as Partial<HeroResponse> & { error?: string };
  if (!response.ok) throw new Error(body.error || "Не удалось сохранить шапку");
  return { pins: body.pins ?? [], carousel: body.carousel ?? [] };
}

export function HeroCurationScope({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const isAdmin = isCatalogAdminEmail(user?.email);
  const [pins, setPins] = useState<PageHeroPin[]>([]);
  const [carousel, setCarousel] = useState<GenerationExampleCard[] | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<HeroNotice | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void fetch(`/api/page-hero?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then((response) => readHero(response))
      .then((next) => {
        if (cancelled) return;
        setPins(next.pins);
        setCarousel(next.carousel);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setNotice({
          kind: "error",
          text: err instanceof Error ? err.message : "Не удалось загрузить шапку",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, path]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.kind === "ok" ? 2500 : 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const write = useCallback(
    async (body: HeroWrite) => {
      setPendingKey(body.cardId ?? body.query ?? "");
      try {
        const response = await fetch("/api/page-hero", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ path, ...body }),
        });
        const next = await readHero(response);
        setPins(next.pins);
        setCarousel(next.carousel);
        setNotice({
          kind: "ok",
          text: body.op === "pin" ? "Добавлено в шапку" : "Убрано из шапки",
        });
        return true;
      } catch (err) {
        setNotice({
          kind: "error",
          text: err instanceof Error ? err.message : "Не удалось сохранить шапку",
        });
        return false;
      } finally {
        setPendingKey(null);
      }
    },
    [path],
  );

  useDebugCardHidden(
    useCallback((detail) => {
      setPins((current) =>
        current.some((pin) => pin.cardId === detail.cardId && !pin.hidden)
          ? current.map((pin) => (pin.cardId === detail.cardId ? { ...pin, hidden: true } : pin))
          : current,
      );
      setCarousel((current) =>
        current?.some((card) => card.id === detail.cardId)
          ? current.filter((card) => card.id !== detail.cardId)
          : current,
      );
    }, []),
  );

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.cardId)), [pins]);

  const value = useMemo<HeroCurationValue>(
    () => ({ isAdmin, ready, pins, pinnedIds, carousel, pendingKey, notice, write }),
    [isAdmin, ready, pins, pinnedIds, carousel, pendingKey, notice, write],
  );

  return (
    <HeroCurationContext.Provider value={value}>
      {children}
      {isAdmin ? <HeroCurationNotice /> : null}
    </HeroCurationContext.Provider>
  );
}

function HeroCurationNotice() {
  const curation = useHeroCuration();
  const notice = curation?.notice;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4"
    >
      {notice ? (
        <p
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-xl shadow-zinc-900/20 ring-1 ring-white/10 backdrop-blur-md ${
            notice.kind === "ok" ? "bg-zinc-900/90" : "bg-red-600/95"
          }`}
        >
          {notice.kind === "ok" ? <CheckIcon /> : <CrossIcon />}
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}

const TILE_TONE = {
  add: `${REVEAL_ON_HOVER} bg-white/90 text-zinc-900 ring-black/5 hover:bg-white disabled:opacity-50`,
  active: "bg-indigo-600 text-white ring-indigo-500/40 shadow-indigo-600/30 hover:bg-zinc-900",
  remove: `${REVEAL_ON_HOVER} bg-zinc-950/70 text-white ring-white/15 hover:bg-red-600`,
} as const;

/** Carousel source: the admin's live set once loaded, otherwise the ISR cards. */
export function useHeroCarouselCards(cards: GenerationExampleCard[]): GenerationExampleCard[] {
  const curation = useHeroCuration();
  return curation?.isAdmin && curation.carousel ? curation.carousel : cards;
}

export function HeroTileButton({
  cardId,
  mode,
  decorative = false,
}: {
  cardId: string;
  mode: HeroTileMode;
  decorative?: boolean;
}) {
  const curation = useHeroCuration();
  if (!curation?.isAdmin || !curation.ready) return null;
  const action = heroTileAction({ mode, pinned: curation.pinnedIds.has(cardId) });
  const pending = curation.pendingKey === cardId;
  return (
    <button
      type="button"
      title={action.title}
      aria-label={action.tone === "active" ? "В шапке — убрать" : action.label}
      aria-pressed={mode === "pin" ? action.tone === "active" : undefined}
      aria-busy={pending || undefined}
      tabIndex={decorative ? -1 : undefined}
      disabled={pending}
      className={`group/hero ${TILE_BUTTON} ${TILE_TONE[action.tone]}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void curation.write({ op: action.op, cardId });
      }}
    >
      {pending ? (
        <SpinnerIcon />
      ) : action.tone === "add" ? (
        <PlusIcon />
      ) : action.tone === "remove" ? (
        <CrossIcon />
      ) : (
        <>
          <span className="group-hover/hero:hidden">
            <CheckIcon />
          </span>
          <span className="hidden group-hover/hero:inline">
            <CrossIcon />
          </span>
        </>
      )}
      {action.tone === "active" ? (
        <>
          <span className="group-hover/hero:hidden">{action.label}</span>
          <span className="hidden group-hover/hero:inline">Убрать</span>
        </>
      ) : (
        action.label
      )}
    </button>
  );
}

function cardsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "карточка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "карточки";
  return "карточек";
}

export function HeroCurationBar() {
  const curation = useHeroCuration();
  const [query, setQuery] = useState("");
  if (!curation?.isAdmin) return null;
  const current = curation;
  const hiddenPins = current.pins.filter((pin) => pin.hidden);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    if (!next) return;
    const ok = await current.write({ op: "pin", query: next });
    if (ok) setQuery("");
  }

  const count = current.pins.length;
  const submitting = current.pendingKey !== null && current.pendingKey === query.trim();

  return (
    <section
      aria-label="Шапка страницы — только для админа"
      className="mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3 text-left sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
          Шапка страницы
        </p>
        <p className="text-xs font-medium tabular-nums text-zinc-500">
          {count} {cardsWord(count)}
        </p>
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="page-hero-card-query">
          id или slug карточки
        </label>
        <input
          id="page-hero-card-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="id или slug карточки"
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={!query.trim() || current.pendingKey !== null}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {submitting ? <SpinnerIcon /> : <PlusIcon />}
          Добавить
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        «В шапку» на любой карточке ниже ставит её первой. «Убрать» — на кадре в ленте.
      </p>

      {hiddenPins.length > 0 ? (
        <div className="mt-3 border-t border-zinc-200 pt-3">
          <p className="text-xs font-medium text-amber-700">
            Скрыты с витрины, но занимают слот
          </p>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {hiddenPins.map((pin) => (
              <li key={pin.cardId} className="w-16 shrink-0">
                {pin.photoUrl ? (
                  <Image
                    src={pin.photoUrl}
                    alt={pin.title}
                    width={64}
                    height={80}
                    className="h-20 w-16 rounded-lg object-cover opacity-50 grayscale"
                  />
                ) : (
                  <div className="h-20 w-16 rounded-lg bg-zinc-200" />
                )}
                <button
                  type="button"
                  className="mt-1 min-h-11 w-full rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  disabled={current.pendingKey === pin.cardId}
                  onClick={() => void current.write({ op: "unpin", cardId: pin.cardId })}
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
