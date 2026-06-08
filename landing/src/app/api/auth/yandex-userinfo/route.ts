import { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  fetchYandexUserinfo,
  mapYandexUserinfoToOAuthClaims,
} from "@/lib/yandex-userinfo-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GoTrue custom:yandex userinfo adapter.
 * Yandex returns default_email and expects Authorization: OAuth <token>;
 * GoTrue sends Bearer and reads the email claim.
 */
export async function GET(req: NextRequest) {
  const accessToken = extractBearerToken(req.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "missing_bearer_token" }, { status: 401 });
  }

  try {
    const yandexProfile = await fetchYandexUserinfo(accessToken);
    const claims = mapYandexUserinfoToOAuthClaims(yandexProfile);

    if (!claims.email) {
      return NextResponse.json({ error: "yandex_email_missing" }, { status: 422 });
    }

    return NextResponse.json(claims);
  } catch (err) {
    const message = err instanceof Error ? err.message : "yandex_userinfo_failed";
    if (message === "yandex_subject_missing") {
      return NextResponse.json({ error: "yandex_subject_missing" }, { status: 422 });
    }
    if (message.startsWith("yandex_userinfo_401")) {
      return NextResponse.json({ error: "yandex_unauthorized" }, { status: 401 });
    }
    if (message.startsWith("yandex_userinfo_403")) {
      return NextResponse.json({ error: "yandex_forbidden" }, { status: 403 });
    }
    console.error("[yandex-userinfo]", message);
    return NextResponse.json({ error: "yandex_userinfo_failed" }, { status: 502 });
  }
}
