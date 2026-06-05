import Image from "next/image";
import Link from "next/link";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import type { ResolvedSeoIllustration } from "@/lib/seo-illustrations";

type Props = {
  illustration: ResolvedSeoIllustration;
  /** Компактный вариант рядом с FAQ. */
  compact?: boolean;
};

export function SeoIllustrationFigure({ illustration, compact = false }: Props) {
  const aspect =
    illustration.width > 0 && illustration.height > 0
      ? `${illustration.width} / ${illustration.height}`
      : "3 / 4";

  return (
    <figure className={compact ? "sm:w-44 flex-shrink-0" : "max-w-sm"}>
      <Link
        href={`/p/${illustration.cardSlug}/`}
        className="group block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 transition-colors hover:border-indigo-300"
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: aspect }}
        >
          <Image
            src={illustration.photoUrl}
            alt={illustration.alt}
            fill
            sizes={compact ? "176px" : SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      </Link>
      <figcaption className="mt-2 text-xs leading-relaxed text-zinc-500">
        {illustration.caption}
      </figcaption>
    </figure>
  );
}
