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
import {
  consumeAuthReturnMarkerInWindow,
  consumeAuthReturnPath,
  markAuthReturnComplete,
  peekAuthReturnDoneCookie,
} from "@/lib/auth-return-path";
import {
  appendAuthReturnDestination,
  peekAuthReturnOverlay,
} from "@/lib/auth-return-screen";
import {
  resolveHydratedAuthUser,
  shouldHydrateAuthOnPageShow,
  shouldHydrateAuthOnVisible,
} from "@/lib/auth-session-hydrate";
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
  const userRef = useRef<User | null>(null);

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
    let cancelled = false;

    const applyUser = (nextUser: User | null) => {
      if (cancelled) return;
      userRef.current = nextUser;
      setUser(nextUser);
      setLoading(false);
      persistAttributionForUser(nextUser, persistedAttributionUserIdRef);
      if (nextUser && nextUser.is_anonymous !== true) {
        setShowAuthModal(false);
      }
    };

    async function hydrateUser() {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;
      if (sessionUser) {
        applyUser(sessionUser);
      }

      let verifiedUser: User | null = null;
      let verifyFailed = false;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          verifyFailed = true;
        } else {
          verifiedUser = data.user ?? null;
        }
      } catch {
        verifyFailed = true;
      }

      applyUser(
        resolveHydratedAuthUser({
          sessionUser,
          verifiedUser,
          verifyFailed,
        }),
      );
    }

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
        } else {
          markAuthReturnComplete();
        }
        const returnPath = consumeAuthReturnPath();
        const overlay = peekAuthReturnOverlay();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("code");
        cleanUrl.searchParams.delete("state");
        cleanUrl.searchParams.delete("error");
        cleanUrl.searchParams.delete("error_code");
        cleanUrl.searchParams.delete("error_description");
        const cleaned =
          `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}` || "/";
        window.location.replace(
          appendAuthReturnDestination(returnPath ?? cleaned, overlay)
        );
        return;
      }

      if (onAuthCallback) {
        // Session cookies are set by the callback page; stay in loading until navigation.
        return;
      }

      consumeAuthReturnMarkerInWindow();
      await hydrateUser();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // First paint is hydrateUser (getSession overlay + getUser). INITIAL_SESSION
      // can arrive as null before cookies are readable and would flash guest.
      if (event === "INITIAL_SESSION") return;
      applyUser(session?.user ?? null);
    });

    void initAuth();

    const onPageShow = (event: PageTransitionEvent) => {
      if (
        !shouldHydrateAuthOnPageShow(event.persisted, peekAuthReturnDoneCookie())
      ) {
        return;
      }
      consumeAuthReturnMarkerInWindow();
      void hydrateUser();
    };
    const onVisible = () => {
      if (!shouldHydrateAuthOnVisible(document.visibilityState, Boolean(userRef.current))) {
        return;
      }
      void hydrateUser();
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    persistedAttributionUserIdRef.current = null;
    userRef.current = null;
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
