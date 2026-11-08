import { isGeneraciyaSeoImagePath } from "./generaciya-foto-routes";
import { isSchoolDaySeoImagePath } from "./school-day-hubs";

/** Referer allowlist for bot image logs. Catalog and /p/ stay out. */
export function isSeoImageStackRefererPath(pathname: string): boolean {
  return isGeneraciyaSeoImagePath(pathname) || isSchoolDaySeoImagePath(pathname);
}
