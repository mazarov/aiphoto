"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import { TAG_REGISTRY } from "@/lib/tag-registry";
import { PromptCard } from "./PromptCard";
import { GroupedCard } from "./GroupedCard";
import { useDebug } from "./DebugFAB";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";

type Props = {
  cards: PromptCardFull[];
  /** First N grid cells use `priority` + no lazy on main photo (listing LCP). */
  lcpPriorityCount?: number;
};

function getSeoTagSlugs(seoTags: unknown): string[] {
  const t = seoTags as Record<string, string[]> | null;
  if (!t) return [];
  return ["audience_tag", "style_tag", "occasion_tag", "object_tag"].flatMap(
    (d) => (t[d] || []) as string[]
  );
}

type Filters = {
  hasWarnings: "all" | "yes" | "no";
  scoreMin: number;
  scoreMax: number;
  hasRuPrompt: "all" | "yes" | "no";
  selectedTag: string;
  hasBefore: "all" | "yes";
  dataset: string;
};

type GridItem =
  | { type: "single"; card: PromptCardFull }
  | { type: "group"; key: string; cards: PromptCardFull[] };

export function FilterableGrid({
  cards,
  lcpPriorityCount = LISTING_LCP_PRIORITY_GRID_ITEMS,
}: Props) {
  const debugCtx = useDebug();
  const debugMode = debugCtx?.debugOpen ?? false;
  const panelOpen = debugCtx?.panelOpen ?? false;
  const [filters, setFilters] = useState<Filters>({
    hasWarnings: "all",
    scoreMin: 0,
    scoreMax: 100,
    hasRuPrompt: "all",
    selectedTag: "",
    hasBefore: "all",
    dataset: "",
  });
  const [datasets, setDatasets] = useState<string[]>([]);

  const [idSearch, setIdSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PromptCardFull[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [filterResults, setFilterResults] = useState<PromptCardFull[] | null>(null);
  const [filterSearching, setFilterSearching] = useState(false);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isIdMode = idSearch.trim().length >= 4;
  const isFilterMode =
    !isIdMode &&
    (filters.hasWarnings !== "all" ||
      filters.scoreMin > 0 ||
      filters.scoreMax < 100 ||
      filters.hasRuPrompt !== "all" ||
      filters.selectedTag !== "" ||
      filters.hasBefore !== "all" ||
      filters.dataset !== "");

  const setHasFilterPanel = debugCtx?.setHasFilterPanel;
  useEffect(() => {
    if (!setHasFilterPanel) return;
    setHasFilterPanel(true);
    return () => setHasFilterPanel(false);
  }, [setHasFilterPanel]);

  useEffect(() => {
    if (!debugMode) return;
    if (datasets.length > 0) return;
    fetch("/api/datasets").then((r) => r.json()).then((d) => setDatasets(d.datasets || [])).catch(() => {});
  }, [debugMode, datasets.length]);

  const doIdSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 4) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search-card?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setSearchResults(data.cards || []);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  }, []);

  const doFilterSearch = useCallback(async () => {
    setFilterSearching(true);
    try {
      const u = new URLSearchParams({
        hasWarnings: filters.hasWarnings,
        scoreMin: String(filters.scoreMin),
        scoreMax: String(filters.scoreMax),
        hasRuPrompt: filters.hasRuPrompt,
        hasBefore: filters.hasBefore,
        ...(filters.selectedTag && { seoTag: filters.selectedTag }),
        ...(filters.dataset && { dataset: filters.dataset }),
      });
      const res = await fetch(`/api/search-cards?${u}`);
      const data = await res.json();
      setFilterResults(data.cards || []);
    } catch { setFilterResults([]); } finally { setFilterSearching(false); }
  }, [filters.hasWarnings, filters.scoreMin, filters.scoreMax, filters.hasRuPrompt, filters.hasBefore, filters.selectedTag, filters.dataset]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = idSearch.trim();
    if (trimmed.length < 4) { setSearchResults(null); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => doIdSearch(trimmed), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [idSearch, doIdSearch]);

  useEffect(() => {
    if (!isFilterMode) { setFilterResults(null); setFilterSearching(false); return; }
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    setFilterSearching(true);
    filterDebounceRef.current = setTimeout(doFilterSearch, 300);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [isFilterMode, doFilterSearch]);

  const allTags = useMemo(() => {
    const set = new Set<string>(TAG_REGISTRY.map((e) => e.slug));
    for (const c of cards) { for (const slug of getSeoTagSlugs(c.seo_tags)) set.add(slug); }
    if (filterResults) { for (const c of filterResults) { for (const slug of getSeoTagSlugs(c.seo_tags)) set.add(slug); } }
    return Array.from(set).sort();
  }, [cards, filterResults]);

  const filtered = useMemo(() => {
    const sourceCards =
      isIdMode ? (searchResults || []) : isFilterMode ? (filterResults || []) : cards;
    if (isIdMode || isFilterMode) return sourceCards;
    return sourceCards.filter((c) => {
      if (filters.hasWarnings === "yes" && c.warnings.length === 0) return false;
      if (filters.hasWarnings === "no" && c.warnings.length > 0) return false;
      if (c.seoReadinessScore < filters.scoreMin) return false;
      if (c.seoReadinessScore > filters.scoreMax) return false;
      if (filters.hasRuPrompt === "yes" && !c.hasRuPrompt) return false;
      if (filters.hasRuPrompt === "no" && c.hasRuPrompt) return false;
      if (filters.hasBefore === "yes" && !c.beforePhotoUrl) return false;
      if (filters.selectedTag) {
        const slugs = getSeoTagSlugs(c.seo_tags);
        if (!slugs.includes(filters.selectedTag)) return false;
      }
      return true;
    });
  }, [isIdMode, searchResults, isFilterMode, filterResults, cards, filters]);

  const shouldGroup = true;

  const gridItems: GridItem[] = useMemo(() => {
    if (!shouldGroup) return filtered.map((card) => ({ type: "single" as const, card }));
    const groupMap = new Map<string, PromptCardFull[]>();
    for (const card of filtered) {
      if (card.sourceGroupKey && card.cardSplitTotal > 1) {
        const arr = groupMap.get(card.sourceGroupKey) || [];
        arr.push(card);
        groupMap.set(card.sourceGroupKey, arr);
      }
    }
    const items: GridItem[] = [];
    const seen = new Set<string>();
    for (const card of filtered) {
      if (card.sourceGroupKey && card.cardSplitTotal > 1) {
        if (seen.has(card.sourceGroupKey)) continue;
        seen.add(card.sourceGroupKey);
        items.push({ type: "group", key: card.sourceGroupKey, cards: groupMap.get(card.sourceGroupKey)! });
      } else {
        items.push({ type: "single", card });
      }
    }
    return items;
  }, [filtered, shouldGroup]);

  const groupCount = useMemo(() => {
    return gridItems.filter((i) => i.type === "group").length;
  }, [gridItems]);

  function handleReset() {
    setFilters({ hasWarnings: "all", scoreMin: 0, scoreMax: 100, hasRuPrompt: "all", selectedTag: "", hasBefore: "all", dataset: "" });
    setIdSearch("");
    setSearchResults(null);
    setFilterResults(null);
  }

  const statsText = isIdMode
    ? (searching ? "Поиск..." : `${filtered.length} найдено`)
    : isFilterMode
      ? (filterSearching ? "Поиск..." : `${filtered.length} найдено`)
      : `${gridItems.length} (${groupCount} групп) из ${cards.length}`;

  const cardIds = useMemo(
    () => filtered.map((c) => c.id),
    [filtered]
  );

  return (
    <CardInteractionsProvider cardIds={cardIds}>
    <div>
      {/* Grid */}
      {(isIdMode && searching) || (isFilterMode && filterSearching) ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-zinc-400">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            Поиск по базе...
          </div>
        </div>
      ) : gridItems.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-zinc-400">{isIdMode || isFilterMode ? "Карточки не найдены." : "Нет карточек по выбранным фильтрам."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {gridItems.map((item, index) =>
            item.type === "single" ? (
              <div key={item.card.id} className="min-w-0">
                <PromptCard
                  card={item.card}
                  debug={debugMode}
                  priorityLoad={index < lcpPriorityCount}
                />
              </div>
            ) : (
              <div key={item.key} className="min-w-0">
                <GroupedCard
                  cards={item.cards}
                  debug={debugMode}
                  priorityLoad={index < lcpPriorityCount}
                />
              </div>
            )
          )}
        </div>
      )}

      {/* Floating filter panel overlay (FAB is in layout) */}
      {debugMode && panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => debugCtx?.setPanelOpen(false)} />
          <div className="fixed bottom-20 right-6 z-50 w-[340px] max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-zinc-900">Фильтры</span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-zinc-400">{statsText}</span>
                <button type="button" onClick={() => debugCtx?.setPanelOpen(false)} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* ID search */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">ID (поиск по базе)</label>
                <div className="relative">
                  <input type="text" value={idSearch} onChange={(e) => setIdSearch(e.target.value)} placeholder="f8ada5bf-3100..."
                    className={`w-full rounded-xl border bg-zinc-50 px-3 py-2 text-sm font-mono placeholder:text-zinc-300 transition-colors ${isIdMode ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-zinc-200 text-zinc-700"}`}
                  />
                  {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">...</span>}
                </div>
              </div>

              {/* Warnings */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Warnings</label>
                <select value={filters.hasWarnings} onChange={(e) => setFilters((f) => ({ ...f, hasWarnings: e.target.value as Filters["hasWarnings"] }))} disabled={isIdMode}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40"
                ><option value="all">Все</option><option value="yes">С warnings</option><option value="no">Без warnings</option></select>
              </div>

              {/* Score */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Score</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100} step={20} value={filters.scoreMin} onChange={(e) => setFilters((f) => ({ ...f, scoreMin: Number(e.target.value) }))} disabled={isIdMode}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40" />
                  <span className="text-zinc-300 flex-shrink-0">—</span>
                  <input type="number" min={0} max={100} step={20} value={filters.scoreMax} onChange={(e) => setFilters((f) => ({ ...f, scoreMax: Number(e.target.value) }))} disabled={isIdMode}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40" />
                </div>
              </div>

              {/* RU prompt */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Промт RU</label>
                <select value={filters.hasRuPrompt} onChange={(e) => setFilters((f) => ({ ...f, hasRuPrompt: e.target.value as Filters["hasRuPrompt"] }))} disabled={isIdMode}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40"
                ><option value="all">Все</option><option value="yes">Есть</option><option value="no">Нет</option></select>
              </div>

              {/* Tag */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Тег</label>
                <select value={filters.selectedTag} onChange={(e) => setFilters((f) => ({ ...f, selectedTag: e.target.value }))} disabled={isIdMode}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40"
                ><option value="">Все теги</option>{allTags.map((tag) => (<option key={tag} value={tag}>{tag}</option>))}</select>
              </div>

              {/* Было */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Было</label>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, hasBefore: f.hasBefore === "yes" ? "all" : "yes" }))}
                  disabled={isIdMode}
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-medium transition-all disabled:opacity-40 ${
                    filters.hasBefore === "yes"
                      ? "border-amber-400 bg-amber-500 text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {filters.hasBefore === "yes" ? "Только с «было»" : "Показать с «было»"}
                </button>
              </div>

              {/* Dataset */}
              {datasets.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 block mb-1.5">Датасет</label>
                  <select
                    value={filters.dataset}
                    onChange={(e) => setFilters((f) => ({ ...f, dataset: e.target.value }))}
                    disabled={isIdMode}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40"
                  >
                    <option value="">Все датасеты</option>
                    {datasets.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset */}
              <div className="pt-1">
                <button type="button" onClick={handleReset}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                >Сбросить</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </CardInteractionsProvider>
  );
}
