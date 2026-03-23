import Image from "next/image";

/** Публичный SVG бренда (совпадает с favicon). */
export const SITE_LOGO_MARK_SRC = "/favicon.svg";

type SiteLogoMarkProps = {
  size: number;
  className?: string;
};

export function SiteLogoMark({ size, className }: SiteLogoMarkProps) {
  return (
    <Image
      src={SITE_LOGO_MARK_SRC}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}
