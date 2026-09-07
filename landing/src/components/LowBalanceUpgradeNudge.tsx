"use client";

import { usePathname } from "next/navigation";
import { LowBalanceUpgradeOfferCard } from "@/components/LowBalanceUpgradeOfferCard";
import { lowBalanceNudgeBlockedByPath } from "@/lib/low-balance-upgrade-nudge";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePricingModal } from "@/context/PricingModalContext";

export function LowBalanceUpgradeNudge() {
  const pathname = usePathname();
  const { showAuthModal } = useAuth();
  const { isOpen: pricingOpen } = usePricingModal();
  const { plateOpen } = useGenerateDock();

  if (
    pricingOpen ||
    showAuthModal ||
    plateOpen ||
    lowBalanceNudgeBlockedByPath(pathname || "/")
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--ps-tabbar-reserve,3.5rem)+0.75rem)] z-[55] lg:hidden">
      <div className="pointer-events-auto mx-auto max-w-md">
        <LowBalanceUpgradeOfferCard variant="mobile" />
      </div>
    </div>
  );
}
