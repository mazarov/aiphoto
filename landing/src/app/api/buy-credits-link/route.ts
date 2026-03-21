import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

/**
 * Must produce an absolute https URL so extension window.open() does not resolve
 * relative to chrome-extension:// (which breaks Telegram deep links).
 */
function normalizeTelegramBotBase(raw: string): string {
  let base = raw.trim();
  if (!base) {
    throw new Error("Missing TELEGRAM_BOT_LINK env var");
  }
  if (base.startsWith("@")) {
    base = base.slice(1);
  }
  if (/^[A-Za-z0-9_]+$/.test(base)) {
    base = `https://t.me/${base}`;
  } else if (base.startsWith("t.me/")) {
    base = `https://${base}`;
  } else if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      "TELEGRAM_BOT_LINK must be a full URL (e.g. https://t.me/YourBot) or bare bot username"
    );
  }
  return base.replace(/\/+$/, "");
}

function buildBotLink(path: string): string {
  const base = normalizeTelegramBotBase(process.env.TELEGRAM_BOT_LINK || "");
  return `${base}${path}`;
}

function createOtp(): string {
  return randomBytes(6).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServer();

    await supabase.from("landing_link_tokens").delete().lt("expires_at", new Date().toISOString());

    const { data: existingLink } = await supabase
      .from("landing_user_telegram_links")
      .select("telegram_id")
      .eq("landing_user_id", user.id)
      .maybeSingle();

    if (existingLink?.telegram_id) {
      return NextResponse.json({
        deepLink: buildBotLink("?start=webcredits"),
        linked: true,
      });
    }

    const otp = createOtp();
    const { error: tokenError } = await supabase.from("landing_link_tokens").insert({
      landing_user_id: user.id,
      otp,
    });

    if (tokenError) {
      console.error("[buy-credits-link] token insert failed:", tokenError.message);
      return NextResponse.json({ error: "failed_to_create_link" }, { status: 500 });
    }

    return NextResponse.json({
      deepLink: buildBotLink(`?start=weblink_${otp}`),
      linked: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[buy-credits-link] failed:", message);
    return NextResponse.json({ error: "internal_error", message }, { status: 500 });
  }
}
