import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "referrerPolicy" | "unoptimized" | "src"> & {
  src: string;
};

function isHotlinkSensitiveAvatarHost(hostname: string): boolean {
  return (
    hostname === "avatars.yandex.net" ||
    hostname.endsWith(".googleusercontent.com") ||
    hostname === "googleusercontent.com"
  );
}

/** True for Google/Yandex avatar CDNs that often 403 when a Referer is sent. */
export function isHotlinkSensitiveAvatarUrl(src: string): boolean {
  try {
    return isHotlinkSensitiveAvatarHost(new URL(src).hostname);
  } catch {
    return false;
  }
}

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
