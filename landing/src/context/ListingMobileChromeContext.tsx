"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";

export type SearchMobileRegistration = {
  hideMobileBar: boolean;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
};

type FilterRegistration = {
  activeCount: number;
  open: () => void;
};

export type CatalogSearchRegistration = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  loading: boolean;
};

type ListingMobileChromeContextValue = {
  searchMobileRef: React.RefObject<SearchMobileRegistration | null>;
  searchMobileRevision: number;
  registerSearchMobile: (reg: SearchMobileRegistration | null) => void;
  filterActiveCount: number;
  filterOpenRef: React.RefObject<(() => void) | null>;
  filterRevision: number;
  registerFilter: (reg: FilterRegistration | null) => void;
  registerMobileSearchOpen: (open: (() => void) | null) => void;
  openMobileSearch: () => void;
  registerMenu: (open: (() => void) | null) => void;
  openMenu: () => void;
  catalogSearchRef: React.RefObject<CatalogSearchRegistration | null>;
  catalogSearchRevision: number;
  registerCatalogSearch: (reg: CatalogSearchRegistration | null) => void;
  catalogSearchPinned: boolean;
  setCatalogSearchPinned: (pinned: boolean) => void;
};

const ListingMobileChromeContext = createContext<ListingMobileChromeContextValue | null>(null);

function searchDisplayKey(reg: SearchMobileRegistration) {
  return `${reg.hideMobileBar}|${reg.value}|${reg.loading}|${reg.placeholder}`;
}

function catalogSearchDisplayKey(reg: CatalogSearchRegistration) {
  return `${reg.value}|${reg.loading}`;
}

export function ListingMobileChromeProvider({ children }: { children: ReactNode }) {
  const searchMobileRef = useRef<SearchMobileRegistration | null>(null);
  const searchDisplayKeyRef = useRef<string | null>(null);
  const [searchMobileRevision, setSearchMobileRevision] = useState(0);

  const filterOpenRef = useRef<(() => void) | null>(null);
  const filterActiveCountRef = useRef(0);
  const filterRegisteredRef = useRef(false);
  const [filterRevision, setFilterRevision] = useState(0);

  const mobileSearchOpenRef = useRef<(() => void) | null>(null);
  const menuOpenRef = useRef<(() => void) | null>(null);
  const catalogSearchRef = useRef<CatalogSearchRegistration | null>(null);
  const catalogSearchKeyRef = useRef<string | null>(null);
  const [catalogSearchRevision, setCatalogSearchRevision] = useState(0);
  const [catalogSearchPinned, setCatalogSearchPinnedState] = useState(false);

  const registerMobileSearchOpen = useCallback((open: (() => void) | null) => {
    mobileSearchOpenRef.current = open;
  }, []);

  const openMobileSearch = useCallback(() => {
    mobileSearchOpenRef.current?.();
  }, []);

  const registerMenu = useCallback((open: (() => void) | null) => {
    menuOpenRef.current = open;
  }, []);

  const openMenu = useCallback(() => {
    menuOpenRef.current?.();
  }, []);

  const registerCatalogSearch = useCallback((reg: CatalogSearchRegistration | null) => {
    catalogSearchRef.current = reg;
    const nextKey = reg ? catalogSearchDisplayKey(reg) : null;
    if (nextKey === catalogSearchKeyRef.current) return;
    catalogSearchKeyRef.current = nextKey;
    setCatalogSearchRevision((v) => v + 1);
  }, []);

  const setCatalogSearchPinned = useCallback((pinned: boolean) => {
    setCatalogSearchPinnedState((current) => (current === pinned ? current : pinned));
  }, []);

  const registerSearchMobile = useCallback((reg: SearchMobileRegistration | null) => {
    searchMobileRef.current = reg;
    const nextKey = reg ? searchDisplayKey(reg) : null;
    if (nextKey === searchDisplayKeyRef.current) return;
    searchDisplayKeyRef.current = nextKey;
    setSearchMobileRevision((v) => v + 1);
  }, []);

  const registerFilter = useCallback((reg: FilterRegistration | null) => {
    filterOpenRef.current = reg?.open ?? null;
    const nextCount = reg?.activeCount ?? 0;
    const hadOpen = filterRegisteredRef.current;
    const hasOpen = reg !== null;
    const prevCount = filterActiveCountRef.current;

    filterRegisteredRef.current = hasOpen;
    filterActiveCountRef.current = nextCount;

    if (prevCount === nextCount && hadOpen === hasOpen) return;
    setFilterRevision((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      searchMobileRef,
      searchMobileRevision,
      registerSearchMobile,
      filterActiveCount: filterActiveCountRef.current,
      filterOpenRef,
      filterRevision,
      registerFilter,
      registerMobileSearchOpen,
      openMobileSearch,
      registerMenu,
      openMenu,
      catalogSearchRef,
      catalogSearchRevision,
      registerCatalogSearch,
      catalogSearchPinned,
      setCatalogSearchPinned,
    }),
    [
      searchMobileRevision,
      registerSearchMobile,
      filterRevision,
      registerFilter,
      registerMobileSearchOpen,
      openMobileSearch,
      registerMenu,
      openMenu,
      catalogSearchRevision,
      registerCatalogSearch,
      catalogSearchPinned,
      setCatalogSearchPinned,
    ],
  );

  return (
    <ListingMobileChromeContext.Provider value={value}>
      {children}
    </ListingMobileChromeContext.Provider>
  );
}

export function useListingMobileChrome() {
  const ctx = useContext(ListingMobileChromeContext);
  if (!ctx) {
    throw new Error("useListingMobileChrome must be used within ListingMobileChromeProvider");
  }
  return ctx;
}

export function useListingMobileChromeOptional() {
  return useContext(ListingMobileChromeContext);
}

/** Header search + tab «Поиск»: listing sheet when registered, otherwise `/search`. */
export function useOpenMobileSearchEntry() {
  const chrome = useListingMobileChromeOptional();
  const router = useRouter();

  return useCallback(() => {
    const search = chrome?.searchMobileRef.current;
    if (search && !search.hideMobileBar) {
      chrome?.openMobileSearch();
      return;
    }
    router.push("/search");
  }, [chrome, router]);
}

/** Header burger on `/catalog`: opens the registered category drawer. */
export function useOpenMobileCatalogMenu() {
  const chrome = useListingMobileChromeOptional();

  return useCallback(() => {
    chrome?.openMenu();
  }, [chrome]);
}
