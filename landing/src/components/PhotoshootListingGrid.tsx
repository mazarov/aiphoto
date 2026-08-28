import Image from "next/image";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";

type Props = {
  urls: string[];
  alt: string;
  priority?: boolean;
};

/** Same 2×2 flush contact sheet as `/generations` history cards. */
export function PhotoshootListingGrid({ urls, alt, priority = false }: Props) {
  return (
    <div className="photoshoot-history-grid absolute inset-0 z-[2] grid grid-cols-2 grid-rows-2 bg-zinc-900">
      {urls.slice(0, 4).map((url, index) => (
        <div key={`${url}-${index}`} className="photoshoot-history-tile relative overflow-hidden">
          <Image
            src={url}
            alt={index === 0 ? alt : ""}
            fill
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
            priority={priority && index === 0}
            fetchPriority={priority && index === 0 ? "high" : undefined}
            className="photoshoot-history-tile__img object-cover"
          />
        </div>
      ))}
    </div>
  );
}
