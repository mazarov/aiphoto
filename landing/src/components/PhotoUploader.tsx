"use client";

import { useState, useRef } from "react";

export type PhotoFile = {
  file: File;
  storagePath: string | null;
  preview: string;
  uploading: boolean;
  error: string | null;
};

type Props = {
  photos: PhotoFile[];
  onPhotosChange: (photos: PhotoFile[] | ((prev: PhotoFile[]) => PhotoFile[])) => void;
  maxPhotos: number;
  disabled?: boolean;
};

export function PhotoUploader({
  photos,
  onPhotosChange,
  maxPhotos,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const remaining = maxPhotos - photos.length;
    const toAdd = files.slice(0, remaining);

    const newPhotos: PhotoFile[] = toAdd.map((file) => ({
      file,
      storagePath: null,
      preview: URL.createObjectURL(file),
      uploading: true,
      error: null,
    }));

    onPhotosChange([...photos, ...newPhotos]);

    for (let i = 0; i < newPhotos.length; i++) {
      const formData = new FormData();
      formData.append("file", newPhotos[i].file);
      const previewUrl = newPhotos[i].preview;

      try {
        const res = await fetch("/api/upload-generation-photo", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        onPhotosChange((prev) =>
          prev.map((p) =>
            p.preview === previewUrl
              ? { ...p, storagePath: data.storagePath, uploading: false, error: null }
              : p
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка загрузки";
        onPhotosChange((prev) =>
          prev.map((p) =>
            p.preview === previewUrl ? { ...p, uploading: false, error: msg } : p
          )
        );
      }
    }
  };

  const removePhoto = (index: number) => {
    const p = photos[index];
    if (p?.preview) URL.revokeObjectURL(p.preview);
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div
            key={i}
            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
          >
            <img
              src={p.preview}
              alt=""
              className="h-full w-full object-cover"
            />
            {p.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="text-xs font-medium text-white">...</span>
              </div>
            )}
            {p.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 p-1">
                <span className="text-[10px] text-white">{p.error}</span>
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {photos.length < maxPhotos && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100"
          >
            <span className="text-xs font-medium">+</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <p className="text-xs text-zinc-500">
        {photos.length}/{maxPhotos} фото
      </p>
    </div>
  );
}
