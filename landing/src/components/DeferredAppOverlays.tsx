"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { useGenerateMobileModal } from "@/context/GenerateMobileModalContext";
import { useGeneration } from "@/context/GenerationContext";
import { usePricingModal } from "@/context/PricingModalContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";

const ClientCardModal = dynamic(
  () =>
    import("@/components/ClientCardModal").then((module) => module.ClientCardModal),
  { ssr: false }
);
const ClientPricingModal = dynamic(
  () =>
    import("@/components/ClientPricingModal").then(
      (module) => module.ClientPricingModal
    ),
  { ssr: false }
);
const AuthModal = dynamic(
  () => import("@/components/AuthModal").then((module) => module.AuthModal),
  { ssr: false }
);
const FotoVPromtMobileModal = dynamic(
  () =>
    import("@/components/foto-v-promt/FotoVPromtMobileModal").then(
      (module) => module.FotoVPromtMobileModal
    ),
  { ssr: false }
);
const GenerateMobileModal = dynamic(
  () =>
    import("@/components/generate/GenerateMobileModal").then(
      (module) => module.GenerateMobileModal
    ),
  { ssr: false }
);
const GenerationModal = dynamic(
  () =>
    import("@/components/GenerationModal").then((module) => module.GenerationModal),
  { ssr: false }
);

function useStickyFlag(active: boolean): boolean {
  const [keep, setKeep] = useState(active);
  useEffect(() => {
    if (active) setKeep(true);
  }, [active]);
  return keep || active;
}

/**
 * Overlay chunks (card page, pricing, auth, STV, generate/foto portals) stay
 * out of the first-load graph until something actually opens them.
 */
export function DeferredAppOverlays() {
  const { currentSlug } = usePromptCardModal();
  const { isOpen: pricingOpen } = usePricingModal();
  const { showAuthModal } = useAuth();
  const { isOpen: fotoOpen } = useFotoVPromtMobileModal();
  const { isOpen: generateOpen } = useGenerateMobileModal();
  const generation = useGeneration();

  const loadCard = useStickyFlag(Boolean(currentSlug));
  const loadPricing = useStickyFlag(pricingOpen);
  const loadAuth = useStickyFlag(showAuthModal);
  const loadFoto = useStickyFlag(fotoOpen);
  const loadGenerate = useStickyFlag(generateOpen);
  const loadStv = useStickyFlag(Boolean(generation?.isOpen));

  return (
    <>
      {loadCard ? <ClientCardModal /> : null}
      {loadPricing ? <ClientPricingModal /> : null}
      {loadAuth ? <AuthModal /> : null}
      {loadFoto ? <FotoVPromtMobileModal /> : null}
      {loadGenerate ? <GenerateMobileModal /> : null}
      {loadStv ? <GenerationModal /> : null}
    </>
  );
}
