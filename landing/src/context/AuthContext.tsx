"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { consumeAuthReturnPath } from "@/lib/auth-oauth";
import { captureBrowserAcquisitionContext } from "@/lib/traffic-source-attribution-browser";
import {
  shouldAttemptClientAttributionPersist,
  toAttributionPersistPayload,
} from "@/lib/traffic-source-attribution";
import type { User } from "@supabase/supabase-js";

export type AuthModalReason = "default" | "analyze_quota";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  showAuthModal: boolean;
  authModalReason: AuthModalReason;
  openAuthModal: (reason?: AuthModalReason) => void;
  closeAuthModal: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  showAuthModal: false,
  authModalReason: "default",
  openAuthModal: () => {},
  closeAuthModal: () => {},
  signOut: async () => {},
});

function persistAttributionForUser(
  nextUser: User | null,
  persistedUserIdRef: { current: string | null },
): void {
  if (!nextUser) {
    persistedUserIdRef.current = null;
    return;
  }
  if (
    !shouldAttemptClientAttributionPersist({
      userId: nextUser.id,
      isAnonymous: nextUser.is_anonymous,
      pathname: window.location.pathname,
      alreadyPersistedUserId: persistedUserIdRef.current,
    })
  ) {
    return;
  }
  persistedUserIdRef.current = nextUser.id;
  void (async () => {
    try {
      const captured = captureBrowserAcquisitionContext();
      await fetch("/api/me/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(toAttributionPersistPayload(captured)),
      });
    } catch (err) {
      console.warn("[attribution] client persist failed", err);
    }
  })();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<AuthModalReason>("default");
  const handledAuthCodeRef = useRef(false);
  const persistedAttributionUserIdRef = useRef<string | null>(null);

  const openAuthModal = useCallback((reason: AuthModalReason = "default") => {
    setAuthModalReason(reason);
    setShowAuthModal(true);
  }, []);
  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setAuthModalReason("default");
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    async function initAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      // `/auth/callback` owns PKCE exchange — do not race a second /token here.
      const onAuthCallback = url.pathname === "/auth/callback";

      // Fallback when provider returned `code` on an arbitrary page (legacy redirectTo).
      if (code && !onAuthCallback && !handledAuthCodeRef.current) {
        handledAuthCodeRef.current = true;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Client OAuth exchange failed:", error.message);
        }
        const returnPath = consumeAuthReturnPath();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("code");
        cleanUrl.searchParams.delete("state");
        cleanUrl.searchParams.delete("error");
        cleanUrl.searchParams.delete("error_code");
        cleanUrl.searchParams.delete("error_description");
        const cleaned =
          `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}` || "/";
        if (returnPath && returnPath !== cleaned) {
          window.location.replace(returnPath);
          return;
        }
        window.history.replaceState({}, "", cleaned);
      }

      if (onAuthCallback) {
        // Session cookies are set by the callback page; stay in loading until navigation.
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      persistAttributionForUser(user, persistedAttributionUserIdRef);
    }

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);
      persistAttributionForUser(nextUser, persistedAttributionUserIdRef);
      // Anonymous sessions still need the login modal for checkout / likes.
      if (nextUser && nextUser.is_anonymous !== true) {
        setShowAuthModal(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    persistedAttributionUserIdRef.current = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showAuthModal,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
