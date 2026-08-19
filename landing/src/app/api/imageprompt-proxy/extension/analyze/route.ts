import { NextRequest, NextResponse } from "next/server";
import { getImagePromptApiOrigin } from "@/lib/foto-v-promt-config";
import {
  ACQUISITION_SESSION_HEADER,
  ACQUISITION_VISITOR_HEADER,
} from "@/lib/acquisition-request";

export const runtime = "nodejs";

/** Dev-only same-origin proxy so LAN/localhost avoid browser CORS to imageprompt.tools. */
async function forwardAnalyze(body: string, request: NextRequest): Promise<Response> {
  const upstream = `${getImagePromptApiOrigin()}/api/extension/analyze`;
  try {
    return await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get(ACQUISITION_VISITOR_HEADER)
          ? { [ACQUISITION_VISITOR_HEADER]: request.headers.get(ACQUISITION_VISITOR_HEADER)! }
          : {}),
        ...(request.headers.get(ACQUISITION_SESSION_HEADER)
          ? { [ACQUISITION_SESSION_HEADER]: request.headers.get(ACQUISITION_SESSION_HEADER)! }
          : {}),
      },
      body,
    });
  } catch {
    return NextResponse.json(
      { error: "upstream_failed", message: "Could not reach imageprompt.tools." },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await forwardAnalyze(body, req);
  if (res instanceof NextResponse) return res;

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}
