"use client";

import Image from "next/image";
import Link from "next/link";
import { PricingCards } from "@/components/pricing/PricingCards";
import {
  usePricingPaywallVariant,
  type PricingPaywallVariant,
} from "@/lib/pricing-paywall-experiment";

type Props = {
  /** page = listing-shell offsets; modal = overlay; embed = landing block. */
  variant: "page" | "modal" | "embed";
  paywallVariant?: PricingPaywallVariant | null;
  returnPath?: string;
};

function LegalFooter({
  dark = false,
  layout = "stacked",
}: {
  dark?: boolean;
  layout?: "stacked" | "inline";
}) {
  const textClass = dark ? "text-zinc-600" : "text-zinc-400/90";
  const linkClass = dark
    ? "text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
    : "text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline";
  const offer = (
    <>
      Покупая пакет, вы принимаете условия{" "}
      <Link href="/terms" className={linkClass}>
        оферты
      </Link>{" "}
      и{" "}
      <Link href="/policy" className={linkClass}>
        политики обработки данных
      </Link>
      .
    </>
  );
  const email = (
    <a href="mailto:support_ru@promptshot.ru" className={linkClass}>
      support_ru@promptshot.ru
    </a>
  );
  const requisites = "СМЗ Азарова Мария Петровна · ИНН 673201018413";

  if (layout === "inline") {
    return (
      <footer
        className={`mt-3 pl-4 text-left text-xs leading-relaxed tracking-tight sm:pl-6 sm:whitespace-nowrap ${textClass}`}
      >
        {offer} {email} {requisites}
      </footer>
    );
  }

  return (
    <footer className={`space-y-0.5 px-1 pt-5 text-center text-[10px] leading-snug sm:text-xs ${textClass}`}>
      <p>{offer}</p>
      <p>{email}</p>
      <p>{requisites}</p>
    </footer>
  );
}

function CompactPricingScreen({
  mode,
  paywallVariant,
  headingId,
  returnPath,
}: {
  mode: "page" | "modal" | "embed";
  paywallVariant: PricingPaywallVariant;
  headingId: string;
  returnPath?: string;
}) {
  const HeadingTag = mode === "embed" ? "h2" : "h1";
  const isEmbed = mode === "embed";
  const paywall = (
    <main
      data-mode={mode}
      className={`pricing-paywall-shell relative isolate flex min-h-0 w-full flex-col overflow-hidden border border-indigo-100/80 bg-white text-zinc-900 shadow-[0_30px_90px_-38px_rgba(79,70,229,0.42)] ${
        isEmbed
          ? "rounded-[1.75rem] border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)]"
          : "max-w-[36rem] rounded-[28px]"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(ellipse_75%_65%_at_50%_0%,rgba(99,102,241,0.13),rgba(139,92,246,0.035)_52%,transparent_78%)]"
        aria-hidden
      />
      {isEmbed ? null : (
        <div className="pricing-paywall-hero relative m-2 mb-0 shrink-0 overflow-hidden rounded-[22px] bg-zinc-100">
          <Image
            src="/pricing/paywall-hero-v2.jpg"
            alt="Примеры индивидуальной, семейной и парной ИИ-фотосессии"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 544px"
            className="object-cover object-top"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/85 via-black/45 to-transparent"
            aria-hidden
          />
          <header className="absolute inset-x-0 bottom-0 px-4 pb-4 text-center text-white sm:px-6 sm:pb-5">
            <HeadingTag
              id={headingId}
              className="text-2xl font-bold leading-tight tracking-[-0.035em] drop-shadow-sm sm:text-3xl"
            >
              Теперь фотосессия — это просто
            </HeadingTag>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-snug text-white/85 drop-shadow-sm sm:text-base">
              Создавайте красивые фото себя по готовым шаблонам в несколько кликов
            </p>
          </header>
          <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
        </div>
      )}

      <div
        className={`pricing-paywall-body relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6 ${
          isEmbed
            ? "pb-5 pt-5 sm:pb-7 sm:pt-7"
            : "pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:pb-6 sm:pt-5"
        }`}
      >
        {isEmbed ? (
          <HeadingTag
            id={headingId}
            className="mb-5 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          >
            Тарифы
          </HeadingTag>
        ) : null}
        <section
          className="flex min-h-0 flex-1 flex-col"
          aria-label="Пакеты токенов"
        >
          <PricingCards
            variant={paywallVariant}
            legalFooter={isEmbed ? undefined : <LegalFooter />}
            returnPath={returnPath}
            sortBy={isEmbed ? "price" : "swipe"}
          />
        </section>
      </div>
    </main>
  );

  if (mode === "modal") return paywall;
  if (mode === "embed") {
    return (
      <div className="w-full">
        {paywall}
        <LegalFooter layout="inline" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--ps-header-height,57px))] w-full items-start justify-center bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 py-6 sm:px-6 sm:py-10">
      {paywall}
    </div>
  );
}

export function PricingScreen({
  variant,
  paywallVariant: providedPaywallVariant,
  returnPath,
}: Props) {
  const assignedPaywallVariant = usePricingPaywallVariant();
  const paywallVariant =
    variant === "embed"
      ? "treatment"
      : providedPaywallVariant ?? assignedPaywallVariant;

  if (!paywallVariant) {
    return (
      <main
        className="flex min-h-[70dvh] w-full items-center justify-center bg-white"
        aria-busy="true"
      >
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600" />
        <span className="sr-only">Загружаем тарифы</span>
      </main>
    );
  }

  return (
    <CompactPricingScreen
      mode={variant}
      paywallVariant={paywallVariant}
      headingId={variant === "embed" ? "tarify-heading" : "pricing-heading"}
      returnPath={returnPath}
    />
  );
}
