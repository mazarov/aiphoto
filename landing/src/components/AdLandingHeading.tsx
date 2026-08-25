"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { resolveAdLandingTitle } from "@/lib/ad-landing-title";

type AdLandingHeadingProps = {
  path: string;
  fallback: string;
  className?: string;
  id?: string;
};

export function AdLandingHeading({
  path,
  fallback,
  className,
  id,
}: AdLandingHeadingProps) {
  const searchParams = useSearchParams();
  const adLandingTitle = resolveAdLandingTitle({
    path,
    search: searchParams.toString(),
  });
  const title = adLandingTitle ?? fallback;

  useEffect(() => {
    if (!adLandingTitle) return;
    document.title = adLandingTitle;
  }, [adLandingTitle]);

  return (
    <h1 className={className} id={id}>
      {title}
    </h1>
  );
}
