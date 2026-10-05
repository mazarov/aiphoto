import { STICKER_EXAMPLES_PER_STYLE } from "@/lib/sticker-examples";

type Props = {
  urls: readonly string[] | undefined;
  /** Style name for alt text: «Пример стикера в стиле …». */
  styleLabel: string;
  size?: "sm" | "md";
  className?: string;
};

export function stickerExampleAlt(styleLabel: string, index: number): string {
  return index === 0 ? `Пример стикера в стиле «${styleLabel}»` : `Пример стикера в стиле «${styleLabel}», ${index + 1}`;
}

/**
 * Up to three real stickers of a style, straight on the card — no checker plate.
 * Server-safe (plain `<img>`: the files live in the bot's public bucket, not behind imgproxy).
 * Renders nothing when the style has no live examples.
 */
export function StickerExampleStrip({ urls, styleLabel, size = "sm", className = "" }: Props) {
  const list = (urls ?? []).slice(0, STICKER_EXAMPLES_PER_STYLE);
  if (!list.length) return null;
  const cell = size === "md" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-14 w-14";
  return (
    <div className={`flex min-w-0 max-w-full gap-1.5 ${className}`} aria-label={`Примеры стиля «${styleLabel}»`}>
      {list.map((url, index) => (
        <span key={url} className={`relative min-w-0 shrink overflow-hidden rounded-xl ${cell}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- external public bucket, fixed tiny size */}
          <img
            src={url}
            alt={stickerExampleAlt(styleLabel, index)}
            loading="lazy"
            decoding="async"
            width={size === "md" ? 96 : 56}
            height={size === "md" ? 96 : 56}
            className="h-full w-full object-contain p-0.5"
          />
        </span>
      ))}
    </div>
  );
}
