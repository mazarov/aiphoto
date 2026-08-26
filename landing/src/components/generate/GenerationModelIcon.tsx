import {
  isFluxImageModel,
  isGrokImageModel,
  isGrokVideoModel,
  isSeedreamImageModel,
} from "@/lib/generation/image-options";

export function GoogleGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

export function GrokGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#111111"
        d="M12 2.4 14.3 9.7 21.6 12 14.3 14.3 12 21.6 9.7 14.3 2.4 12 9.7 9.7Z"
      />
    </svg>
  );
}

export function SeedreamGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#3250FF"
        d="M12 2.2c3.4 3.2 7.6 7.4 7.6 12.1A7.6 7.6 0 0 1 4.4 14.3C4.4 9.6 8.6 5.4 12 2.2Z"
      />
      <path
        fill="#7B93FF"
        d="M12 7.2c1.7 1.7 3.6 3.8 3.6 5.8a3.6 3.6 0 1 1-7.2 0c0-2 1.9-4.1 3.6-5.8Z"
      />
    </svg>
  );
}

export function FluxGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FF6B2C"
        d="M12 2.3 20.2 7v10L12 21.7 3.8 17V7L12 2.3Z"
      />
      <path
        fill="#1A1A1A"
        d="M12 6.4 16.6 9v6L12 17.6 7.4 15V9L12 6.4Z"
      />
    </svg>
  );
}

export function GenerationModelIcon({
  modelId,
  className = "h-5 w-5",
}: {
  modelId?: string | null;
  className?: string;
}) {
  if (isGrokImageModel(modelId) || isGrokVideoModel(modelId)) {
    return <GrokGenerationModelIcon className={className} />;
  }
  if (isFluxImageModel(modelId)) {
    return <FluxGenerationModelIcon className={className} />;
  }
  if (isSeedreamImageModel(modelId)) {
    return <SeedreamGenerationModelIcon className={className} />;
  }
  return <GoogleGenerationModelIcon className={className} />;
}
