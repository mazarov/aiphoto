"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "uploading" | "generating" | "done" | "error";

type Props = {
  resultUrl: string | null;
  phase: Phase;
  className?: string;
};

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Result plate backdrop with a clear regenerate transition:
 * previous photo → pixelated wait → new photo reveals in place.
 * Shared by dock (mobile/desktop) and non-dock card compose.
 */
export function GenerationResultBackdrop({
  resultUrl,
  phase,
  className = "",
}: Props) {
  const [baseUrl, setBaseUrl] = useState<string | null>(resultUrl);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [pixelate, setPixelate] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const baseUrlRef = useRef<string | null>(resultUrl);
  const revealGenRef = useRef(0);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  /** Clear everything when compose leaves result chrome. */
  useEffect(() => {
    if (resultUrl) return;
    revealGenRef.current += 1;
    setBaseUrl(null);
    setOverlayUrl(null);
    setPixelate(false);
    setRevealing(false);
  }, [resultUrl]);

  /** In-flight regenerate: keep previous frame and pixelate it. */
  useEffect(() => {
    if (phase !== "generating" && phase !== "uploading") return;
    if (!baseUrlRef.current && !resultUrl) return;
    if (resultUrl && !baseUrlRef.current) {
      setBaseUrl(resultUrl);
    }
    setOverlayUrl(null);
    setRevealing(false);
    setPixelate(true);
  }, [phase, resultUrl]);

  /** Failed / cancelled regenerate: restore sharp previous photo. */
  useEffect(() => {
    if (phase !== "done" && phase !== "error") return;
    if (revealing || overlayUrl) return;
    if (pixelate && resultUrl && resultUrl === baseUrlRef.current) {
      setPixelate(false);
    }
  }, [phase, pixelate, revealing, overlayUrl, resultUrl]);

  /** New result URL → preload, then reveal over pixelated base. */
  useEffect(() => {
    if (!resultUrl) return;

    const currentBase = baseUrlRef.current;
    if (!currentBase) {
      setBaseUrl(resultUrl);
      setPixelate(false);
      setOverlayUrl(null);
      setRevealing(false);
      return;
    }

    if (resultUrl === currentBase) return;
    if (overlayUrl === resultUrl && revealing) return;

    const gen = ++revealGenRef.current;
    let cancelled = false;

    void (async () => {
      await preloadImage(resultUrl);
      if (cancelled || gen !== revealGenRef.current) return;
      setPixelate(true);
      setOverlayUrl(resultUrl);
      setRevealing(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [resultUrl, overlayUrl, revealing]);

  /** Safety: animationend can miss if plate was display-collapsed mid-transition. */
  useEffect(() => {
    if (!revealing || !overlayUrl) return;
    const timer = window.setTimeout(() => {
      setBaseUrl(overlayUrl);
      setOverlayUrl(null);
      setRevealing(false);
      setPixelate(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [revealing, overlayUrl]);

  const finishReveal = () => {
    if (!overlayUrl) return;
    setBaseUrl(overlayUrl);
    setOverlayUrl(null);
    setRevealing(false);
    setPixelate(false);
  };

  if (!baseUrl && !overlayUrl) return null;

  const shownBase = baseUrl;
  const showOverlay = Boolean(overlayUrl && revealing);

  return (
    <div
      className={`ps-result-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {shownBase ? (
        <div className="ps-result-backdrop__layer">
          <div
            className={`ps-result-backdrop__pixel-host${
              pixelate ? " ps-result-backdrop__pixel-host--on" : ""
            }`}
          >
            <div className="ps-result-backdrop__pixel-scale">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownBase} alt="" className="ps-result-backdrop__img" />
            </div>
          </div>
        </div>
      ) : null}

      {showOverlay && overlayUrl ? (
        <div className="ps-result-backdrop__layer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={overlayUrl}
            alt=""
            className="ps-result-backdrop__img ps-result-backdrop__reveal"
            onAnimationEnd={finishReveal}
          />
        </div>
      ) : null}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.55)_0%,rgba(9,9,11,0.2)_45%,rgba(9,9,11,0.62)_100%)]" />
    </div>
  );
}
