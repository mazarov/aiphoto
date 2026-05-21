"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyablePromptField } from "./CopyablePromptField";
import {
  DRAFT_PROMPT_COPY_VALUE,
  OverlayButtonMock,
  PAIN_REFERENCE_IMAGE_SRC,
} from "./stv-mock-shared";

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readErrorMessage(res: Response, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "message" in data && typeof (data as { message: string }).message === "string") {
    return (data as { message: string }).message;
  }
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: string }).error === "string") {
    return (data as { error: string }).error;
  }
  return res.statusText || "Request failed";
}

/**
 * Pain-секция: референс + загрузка своего фото → тот же pipeline, что в STV (upload → signed URL → extract → expand).
 */
export function PainReferenceVsDraftMock() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState(DRAFT_PROMPT_COPY_VALUE);
  const [fromExtract, setFromExtract] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokeBlob(), [revokeBlob]);

  const runPipeline = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    revokeBlob();
    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    try {
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload-generation-photo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const upData = (await upRes.json().catch(() => ({}))) as { storagePath?: string; error?: string };
      if (!upRes.ok) {
        if (upRes.status === 401) {
          throw new Error("unauthorized");
        }
        throw new Error(upData.error || (await readErrorMessage(upRes, upData)));
      }
      const storagePath = upData.storagePath;
      if (!storagePath) throw new Error("Upload failed");

      const signRes = await fetch(
        `/api/upload-generation-photo/signed-url?path=${encodeURIComponent(storagePath)}`,
        { credentials: "include" },
      );
      const signData = (await signRes.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!signRes.ok) {
        if (signRes.status === 401) throw new Error("unauthorized");
        throw new Error(signData.error || "Could not get image URL for analysis");
      }
      const imageUrl = signData.signedUrl;
      if (!imageUrl?.startsWith("http")) throw new Error("Invalid signed URL");

      const exRes = await fetch("/api/vibe/extract", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const exData = (await exRes.json().catch(() => ({}))) as {
        vibeId?: string;
        style?: unknown;
        error?: string;
      };
      if (!exRes.ok) {
        if (exRes.status === 401) throw new Error("unauthorized");
        throw new Error(await readErrorMessage(exRes, exData));
      }
      const { vibeId, style } = exData;
      if (!vibeId || !style) throw new Error("Extract returned no data");

      const expRes = await fetch("/api/vibe/expand", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibeId,
          style,
          groomingPolicy: { applyHair: true, applyMakeup: true },
        }),
      });
      const expData = (await expRes.json().catch(() => ({}))) as {
        finalPromptForGeneration?: string;
        error?: string;
        message?: string;
      };
      if (!expRes.ok) {
        if (expRes.status === 401) throw new Error("unauthorized");
        throw new Error(await readErrorMessage(expRes, expData));
      }
      const finalPrompt = String(expData.finalPromptForGeneration || "").trim();
      if (!finalPrompt) throw new Error("No prompt produced");

      setDraftValue(finalPrompt);
      setFromExtract(true);
    } catch (e) {
      revokeBlob();
      setPreviewUrl(null);
      if (e instanceof Error && e.message === "unauthorized") {
        setError("sign_in_required");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }, [revokeBlob]);

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!ALLOWED_MIME.has(file.type)) {
        setError("Use JPEG, PNG, or WebP.");
        return;
      }
      void runPipeline(file);
    },
    [runPipeline],
  );

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[rgb(24_24_27/0.45)] p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.5)] sm:p-5">
      <div className="mb-4 flex flex-col gap-1.5 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Image to prompt · live demo
          </span>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-zinc-500">
            Compare the pixels in front of you with the flat text most people type before they give up—then upload your
            own frame to run the real pipeline.
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-600">Live image analysis (signed in)</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-3 lg:gap-5">
        <div className="flex flex-col">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-white/[0.08] px-1 text-[10px] font-bold text-zinc-300">
              1
            </span>
            Reference
          </p>
          <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04]">
            <div className="relative aspect-[3/4] w-full">
              <div className="absolute inset-0 p-1.5 sm:p-2">
                <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-black">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Your uploaded reference"
                      className="h-full w-full object-contain object-center"
                    />
                  ) : (
                    <Image
                      src={PAIN_REFERENCE_IMAGE_SRC}
                      alt="Reference photo for style — example from PromptShot generations"
                      fill
                      unoptimized
                      className="object-contain object-center"
                      sizes="(max-width: 640px) 100vw, 340px"
                      quality={60}
                    />
                  )}
                </div>
              </div>
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/50 via-transparent to-black/20"
                aria-hidden
              />
              <div className="absolute right-2 top-2 z-10 sm:right-2.5 sm:top-2.5">
                <OverlayButtonMock />
              </div>

              <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3 pt-14">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={onPickFile}
                  disabled={busy}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-zinc-900 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? "Analyzing…" : "Add your photo"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className="hidden items-center justify-center self-center sm:flex sm:min-h-[120px] sm:pt-8"
          aria-hidden
        >
          <span className="text-lg font-medium text-zinc-500">→</span>
        </div>

        <div className="flex min-h-[280px] flex-col sm:min-h-0">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-white/[0.08] px-1 text-[10px] font-bold text-zinc-300">
              2
            </span>
            Prompt draft
          </p>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-zinc-950/35 p-1 ring-1 ring-inset ring-white/[0.06] sm:p-1.5">
            <CopyablePromptField value={draftValue} label="Prompt draft to copy" className="min-h-0 flex-1" />
          </div>
        </div>
      </div>

      {error === "sign_in_required" ? (
        <p className="mt-3 text-center text-xs text-amber-200/90 sm:mt-4">
          Sign in with Google on the{" "}
          <Link href="/" className="font-semibold text-indigo-300 underline-offset-2 hover:underline">
            homepage
          </Link>{" "}
          first, then add your photo again.
        </p>
      ) : error ? (
        <p className="mt-3 text-center text-xs text-red-400/90 sm:mt-4">{error}</p>
      ) : null}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500 sm:mt-5">
        {fromExtract
          ? "Same extract → expand stack as the Chrome overlay—your descriptive AI image prompt, grounded in the upload."
          : "Sample copy is deliberately generic—drop in a JPEG, PNG, or WebP to see a richer, reference-aware prompt."}
      </p>
    </div>
  );
}
