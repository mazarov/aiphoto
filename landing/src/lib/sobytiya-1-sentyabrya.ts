export const SOBYTIYA_1_SENTYABRYA_PATH = "/sobytiya/1-sentyabrya";
export const SOBYTIYA_1_SENTYABRYA_TAG = "1_sentyabrya";
export const SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY = "1 сентября";

export function isSobytiya1SentyabryaPath(pathname: string): boolean {
  if (!pathname) return false;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return normalized === SOBYTIYA_1_SENTYABRYA_PATH;
}
