import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";
import {
  listPageHeroAdminPins,
  loadPageHeroCarousel,
  writePageHeroPin,
} from "@/lib/page-hero-data";
import {
  isHeroCuratablePath,
  normalizeHeroPath,
  parsePageHeroWrite,
} from "@/lib/page-hero";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export const dynamic = "force-dynamic";

async function requireCatalogAdmin(req: NextRequest) {
  const { user, error } = await getSupabaseUserForApiRoute(req);
  if (error || !user || !isCatalogAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireCatalogAdmin(req);
  if (denied) return denied;

  const path = normalizeHeroPath(req.nextUrl.searchParams.get("path") ?? "");
  if (!path || !isHeroCuratablePath(path)) {
    return NextResponse.json({ error: "Неизвестная страница" }, { status: 400 });
  }

  const [pins, carousel] = await Promise.all([
    listPageHeroAdminPins(path),
    loadPageHeroCarousel(path),
  ]);
  if (!pins) {
    return NextResponse.json({ error: "Не удалось прочитать шапку" }, { status: 500 });
  }
  return NextResponse.json({ pins, carousel });
}

export async function POST(req: NextRequest) {
  const denied = await requireCatalogAdmin(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const parsed = parsePageHeroWrite(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await writePageHeroPin(parsed.value);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath(parsed.value.path);
  const carousel = await loadPageHeroCarousel(parsed.value.path);
  return NextResponse.json({ pins: result.pins, carousel });
}
