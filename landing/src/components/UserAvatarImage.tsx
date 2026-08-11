import Image, { type ImageProps } from "next/image";
import { isHotlinkSensitiveAvatarUrl } from "@/lib/oauth-avatar-url";

type Props = Omit<ImageProps, "referrerPolicy" | "unoptimized" | "src"> & {
  src: string;
};

/**
 * Avatar image for OAuth profile photos.
 * Googleusercontent (and sometimes Yandex) block hotlinks with Referer —
 * including Next.js `/_next/image` proxy fetches — so we load them directly
 * with `referrerPolicy="no-referrer"`.
 */
export function UserAvatarImage({ src, alt = "", ...props }: Props) {
  const sensitive = isHotlinkSensitiveAvatarUrl(src);
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      unoptimized={sensitive}
    />
  );
}
