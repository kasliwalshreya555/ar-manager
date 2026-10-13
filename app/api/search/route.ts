import { NextResponse } from "next/server";
import { loadArData } from "@/lib/ar/load";
import { searchAr } from "@/lib/ar/search";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

/** Quick results for the header search box: up to 5 of each kind. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const asof = asOfDate(url.searchParams.get("asof") ?? undefined);
  try {
    const data = await loadArData();
    const all = searchAr(data, q, asof);
    const shown = searchAr(data, q, asof, 5);
    return NextResponse.json({ results: shown, total: all.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 500 });
  }
}
