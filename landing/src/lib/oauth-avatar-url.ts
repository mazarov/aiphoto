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
