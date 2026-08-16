"use client";

import { isVideoGenerationResult } from "@/lib/video-generation-contract";

const THUMB = "h-full w-full object-cover";

export function AdminResultThumb({
  url,
  alt = "",
}: {
  url: string | null;
  alt?: string;
}) {
  if (!url) return null;
  if (isVideoGenerationResult({ url })) {
    return (
      <span className="relative block h-full w-full">
        <video src={url} muted playsInline loop preload="metadata" className={THUMB} />
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          видео
        </span>
      </span>
    );
  }
  return <img src={url} alt={alt} className={THUMB} />;
}

export function AdminResultLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const video = isVideoGenerationResult({ url });
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
    >
      {video ? (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          onClick={(event) => event.stopPropagation()}
          className="max-h-[90vh] max-w-full rounded-2xl"
        />
      ) : (
        <img
          src={url}
          alt=""
          onClick={(event) => event.stopPropagation()}
          className="max-h-[90vh] max-w-full rounded-2xl object-contain"
        />
      )}
    </div>
  );
}
