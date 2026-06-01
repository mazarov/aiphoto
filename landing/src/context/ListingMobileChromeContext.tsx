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

type MenuRegistration = {
  open: () => void;
};

type ListingMobileChromeContextValue = {
  searchMobileRef: React.RefObject<SearchMobileRegistration | null>;
  searchMobileRevision: number;
  registerSearchMobile: (reg: SearchMobileRegistration | null) => void;
  filterActiveCount: number;
  filterOpenRef: React.RefObject<(() => void) | null>;
  filterRevision: number;
  registerFilter: (reg: FilterRegistration | null) => void;
  menuOpenRef: React.RefObject<(() => void) | null>;
  menuRevision: number;
  registerMenu: (reg: MenuRegistration | null) => void;
};

const ListingMobileChromeContext = createContext<ListingMobileChromeContextValue | null>(null);

function searchDisplayKey(reg: SearchMobileRegistration) {
  return `${reg.hideMobileBar}|${reg.value}|${reg.loading}|${reg.placeholder}`;
}

export function ListingMobileChromeProvider({ children }: { children: ReactNode }) {
  const searchMobileRef = useRef<SearchMobileRegistration | null>(null);
  const searchDisplayKeyRef = useRef<string | null>(null);
  const [searchMobileRevision, setSearchMobileRevision] = useState(0);

  const filterOpenRef = useRef<(() => void) | null>(null);
  const filterActiveCountRef = useRef(0);
  const filterRegisteredRef = useRef(false);
  const [filterRevision, setFilterRevision] = useState(0);

  const menuOpenRef = useRef<(() => void) | null>(null);
  const [menuRevision, setMenuRevision] = useState(0);

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

  const registerMenu = useCallback((reg: MenuRegistration | null) => {
    const hadMenu = menuOpenRef.current !== null;
    menuOpenRef.current = reg?.open ?? null;
    const hasMenu = menuOpenRef.current !== null;
    if (hadMenu === hasMenu) return;
    setMenuRevision((v) => v + 1);
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
      menuOpenRef,
      menuRevision,
      registerMenu,
    }),
    [
      searchMobileRevision,
      registerSearchMobile,
      filterRevision,
      registerFilter,
      menuRevision,
      registerMenu,
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
