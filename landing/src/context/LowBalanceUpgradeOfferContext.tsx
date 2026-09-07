"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CREDIT_BALANCE_REFRESH_EVENT } from "@/lib/credit-balance-events";
import {
  isLowBalanceNudgeHiddenUntil,
  isLowBalanceUpgradeOffer,
  readLowBalanceNudgeHiddenUntil,
  rememberLowBalanceNudgeDismissed,
} from "@/lib/low-balance-upgrade-nudge";
import { type LivePricingOffer } from "@/lib/mail-checkout-offer";
import { useAuth } from "@/context/AuthContext";
import { usePricingModal } from "@/context/PricingModalContext";

type OfferContextValue = {
  offer: LivePricingOffer | null;
  dismiss: () => void;
  buy: () => void;
};

const OfferContext = createContext<OfferContextValue>({
  offer: null,
  dismiss: () => undefined,
  buy: () => undefined,
});

function recordOfferEvent(
  offerId: string,
  event: "seen" | "clicked" | "dismissed",
) {
  void fetch("/api/pricing-offers/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ offerId, event }),
  }).catch(() => undefined);
}

export function LowBalanceUpgradeOfferProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { open: openPricing } = usePricingModal();
  const [offer, setOffer] = useState<LivePricingOffer | null>(null);
  const seenOfferId = useRef<string | null>(null);

  const loadOffer = useCallback(async () => {
    if (!user || user.is_anonymous === true) {
      setOffer(null);
      return;
    }
    const response = await fetch("/api/me", {
      cache: "no-store",
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => null)) as {
      offer?: LivePricingOffer | null;
    } | null;
    const next = payload?.offer ?? null;
    if (!isLowBalanceUpgradeOffer(next)) {
      setOffer(null);
      return;
    }
    if (isLowBalanceNudgeHiddenUntil(readLowBalanceNudgeHiddenUntil(next.offerId))) {
      setOffer(null);
      return;
    }
    setOffer(next);
    if (seenOfferId.current !== next.offerId) {
      seenOfferId.current = next.offerId;
      recordOfferEvent(next.offerId, "seen");
    }
  }, [user]);

  useEffect(() => {
    void loadOffer();
    const onRefresh = () => {
      void loadOffer();
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, onRefresh);
    };
  }, [loadOffer]);

  const dismiss = useCallback(() => {
    if (!offer) return;
    rememberLowBalanceNudgeDismissed(offer.offerId);
    recordOfferEvent(offer.offerId, "dismissed");
    setOffer(null);
  }, [offer]);

  const buy = useCallback(() => {
    if (!offer) return;
    recordOfferEvent(offer.offerId, "clicked");
    openPricing();
  }, [offer, openPricing]);

  const value = useMemo(
    () => ({ offer, dismiss, buy }),
    [offer, dismiss, buy],
  );

  return <OfferContext.Provider value={value}>{children}</OfferContext.Provider>;
}

export function useLowBalanceUpgradeOffer() {
  return useContext(OfferContext);
}
