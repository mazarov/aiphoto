import { createSupabaseBrowser } from "@/lib/supabase-browser";

export const YANDEX_OAUTH_PROVIDER = "custom:yandex" as const;

export type OAuthSignInProvider = "google" | typeof YANDEX_OAUTH_PROVIDER;

export function getOAuthReturnUrl(): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export async function signInWithOAuthProvider(provider: OAuthSignInProvider) {
  const supabase = createSupabaseBrowser();
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getOAuthReturnUrl() },
  });
}
