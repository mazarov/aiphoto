import Link from "next/link";
import Image from "next/image";
import {
  CARD_IMAGE_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";

type Props = {
  label: string;
  href: string;
  totalCount: number;
  photoUrl: string | null;
  secondPhotoUrl: string | null;
  priority?: boolean;
};

function pluralPrompts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} промт`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} промта`;
  return `${n} промтов`;
}

export function CategoryCard({
  label,
  href,
  totalCount,
  photoUrl,
  secondPhotoUrl,
  priority = false,
}: Props) {
  const hasStack = !!secondPhotoUrl;

  return (
    <Link href={href} className="group block">
      <div className={`relative ${hasStack ? "pb-2 pr-2" : ""}`}>
        {/* Back card */}
        {hasStack && (
          <div className="absolute top-3 left-3 right-0 bottom-0 rounded-2xl bg-zinc-300 overflow-hidden rotate-[2deg] shadow-md transition-transform duration-300 group-hover:rotate-[4deg] group-hover:translate-x-1 group-hover:translate-y-1">
            <Image
              src={secondPhotoUrl}
              alt=""
              fill
              className="object-cover opacity-60"
              sizes={SIZES_CARD_GRID}
              quality={CARD_IMAGE_NEXT_QUALITY}
            />
          </div>
        )}

        {/* Front card */}
        <div className="relative z-10 overflow-hidden rounded-2xl transition-all duration-200 group-hover:shadow-xl group-hover:shadow-zinc-900/10 group-hover:-translate-y-0.5">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`Промт для фото — ${label}`}
                fill
                className="object-cover"
                sizes={SIZES_CARD_GRID}
                quality={CARD_IMAGE_NEXT_QUALITY}
                priority={priority}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
                {label}
              </div>
            )}

            {/* Overlay with title */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-3 px-3 pointer-events-none">
              <h3 className="text-[13px] font-semibold text-white leading-snug">{label}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Count badge */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-xs text-zinc-500">{pluralPrompts(totalCount)}</span>
      </div>
    </Link>
  );
}
