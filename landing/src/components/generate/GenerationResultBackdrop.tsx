"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "uploading" | "generating" | "done" | "error";

type Props = {
  resultUrl: string | null;
  phase: Phase;
  className?: string;
  kind?: "image" | "video";
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
  kind = "image",
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

  if (kind === "video" && (baseUrl || resultUrl)) {
    const src = resultUrl || baseUrl;
    return (
      <div
        className={`ps-result-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
        aria-hidden
      >
        {src ? <ResultFitVideo src={src} /> : null}
      </div>
    );
  }

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
              <ResultFitStack src={shownBase} />
            </div>
          </div>
        </div>
      ) : null}

      {showOverlay && overlayUrl ? (
        <div className="ps-result-backdrop__layer">
          <ResultFitStack
            src={overlayUrl}
            imgClassName="ps-result-backdrop__reveal"
            onAnimationEnd={finishReveal}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Full frame: contain + blurred fill, same as the prompt-card hero. */
function ResultFitStack({
  src,
  imgClassName = "",
  onAnimationEnd,
}: {
  src: string;
  imgClassName?: string;
  onAnimationEnd?: () => void;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="ps-result-backdrop__fill" />
      <div className="ps-result-backdrop__tint" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`ps-result-backdrop__img ${imgClassName}`.trim()}
        onAnimationEnd={onAnimationEnd}
      />
    </>
  );
}

function ResultFitVideo({ src }: { src: string }) {
  return (
    <>
      <video src={src} className="ps-result-backdrop__fill" autoPlay muted loop playsInline />
      <div className="ps-result-backdrop__tint" />
      <video src={src} className="ps-result-backdrop__img" autoPlay muted loop playsInline />
    </>
  );
}
