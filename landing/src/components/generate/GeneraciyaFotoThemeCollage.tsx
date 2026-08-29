import Image from "next/image";
import Link from "next/link";
import { CARD_IMAGE_LISTING_NEXT_QUALITY } from "@/lib/card-image-presets";
import { pluralPrompts, pluralTemplates } from "@/lib/plural-prompts";

const THEME_SLOTS = 6;
const SIZES_THEME_HERO =
  "(max-width: 639px) 33vw, (max-width: 1023px) 22vw, 17vw";
const SIZES_THEME_CELL =
  "(max-width: 639px) 17vw, (max-width: 1023px) 11vw, 8vw";

export type ThemeCollageItem = {
  title: string;
  href: string;
};

export type ThemeCountKind = "templates" | "prompts";

function formatThemeCount(kind: ThemeCountKind, count: number): string {
  return kind === "prompts" ? pluralPrompts(count) : pluralTemplates(count);
}

function ThemePhoto({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-zinc-100">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100"
          aria-hidden
        />
      )}
    </div>
  );
}

export function GeneraciyaFotoThemeCollage({
  item,
  photos,
  count,
  priority = false,
  countKind = "templates",
}: {
  item: ThemeCollageItem;
  photos: string[];
  count: number;
  priority?: boolean;
  countKind?: ThemeCountKind;
}) {
  const slots = Array.from(
    { length: THEME_SLOTS },
    (_, index) => photos[index] ?? null
  );

  return (
    <Link
      href={item.href}
      scroll={false}
      className="group relative block overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
    >
      <div className="relative aspect-[4/5]">
        <div className="absolute inset-0 flex flex-col gap-px bg-zinc-200">
          <div className="grid min-h-0 flex-[7] grid-cols-3 gap-px">
            <div className="relative col-span-2">
              <ThemePhoto
                src={slots[0]}
                alt=""
                sizes={SIZES_THEME_HERO}
                priority={priority}
              />
            </div>
            <div className="grid grid-rows-2 gap-px">
              <div className="relative min-h-0">
                <ThemePhoto src={slots[1]} alt="" sizes={SIZES_THEME_CELL} />
              </div>
              <div className="relative min-h-0">
                <ThemePhoto src={slots[2]} alt="" sizes={SIZES_THEME_CELL} />
              </div>
            </div>
          </div>
          <div className="grid min-h-0 flex-[4] grid-cols-3 gap-px">
            {slots.slice(3).map((src, index) => (
              <div key={index} className="relative min-h-0">
                <ThemePhoto src={src} alt="" sizes={SIZES_THEME_CELL} />
              </div>
            ))}
          </div>
        </div>

        {count > 0 ? (
          <div className="pointer-events-none absolute left-2.5 top-2.5">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              {formatThemeCount(countKind, count)}
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent px-3 pb-3 pt-20">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition group-hover:brightness-105">
            {item.title}
          </span>
        </div>
      </div>
    </Link>
  );
}
