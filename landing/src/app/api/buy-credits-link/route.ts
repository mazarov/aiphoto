import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { createSupabaseServerAuth } from "@/lib/supabase-server-auth";

function buildBotLink(path: string): string {
  const base = (process.env.TELEGRAM_BOT_LINK || "").trim();
  if (!base) {
    throw new Error("Missing TELEGRAM_BOT_LINK env var");
  }
  return `${base.replace(/\/+$/, "")}${path}`;
}

function createOtp(): string {
  return randomBytes(6).toString("hex");
}

export async function POST() {
  try {
    const supabaseAuth = await createSupabaseServerAuth();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

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
