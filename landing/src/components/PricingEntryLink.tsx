"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { usePricingModal } from "@/context/PricingModalContext";

function isModifiedClick(event: MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href?: string;
};

/**
 * In-app entry to tariffs: plain click opens the overlay (`pushState /pricing`);
 * modified click / new-tab keeps a hard navigation. Already on `/pricing` → native link.
 */
export function PricingEntryLink({
  href = "/pricing",
  onClick,
  children,
  ...rest
}: Props) {
  const { open, isOpen } = usePricingModal();

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedClick(event)) return;
        if (typeof window !== "undefined") {
          const path = window.location.pathname.replace(/\/$/, "") || "/";
          if (path === "/pricing" && !isOpen) return;
        }
        event.preventDefault();
        open();
      }}
    >
      {children}
    </Link>
  );
}
