import type { User } from "@supabase/supabase-js";

export const STV_GUEST_VIRTUAL_CREDITS = 999;

export function isStvGuestModeEnabled(): boolean {
  const configured = process.env.STV_GUEST_MODE?.trim();
  if (configured === "1" || configured === "true") return true;
  if (configured === "0" || configured === "false") return false;
  return process.env.NODE_ENV === "development";
}

export function isStvGuestUser(user: User): boolean {
  return isStvGuestModeEnabled() && user.is_anonymous === true;
}
