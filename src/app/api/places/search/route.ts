import { NextRequest, NextResponse } from "next/server";
import { kakaoKeywordSearch, mapCategory, type KakaoDocument } from "@/lib/kakao";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { KakaoPlace } from "@/lib/constants";

export const runtime = "nodejs";

const DEFAULT_QUERIES = ["헬스장", "필라테스"];

/**
 * GET /api/places/search?lat=..&lng=..&radius=1000[&query=업체명]
 * 카카오 로컬 검색 결과에 우리 DB의 가격정보 보유 여부(hasPrice)를 병합해 반환.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const radius = sp.get("radius") ? Number(sp.get("radius")) : 1000;
  const query = sp.get("query")?.trim();

  if (query == null && (lat == null || lng == null)) {
    return NextResponse.json({ error: "lat/lng 또는 query가 필요합니다" }, { status: 400 });
  }

  try {
    // 검색어가 있으면 해당 키워드만, 없으면 기본 카테고리(헬스장/필라테스) 검색
    const queries = query ? [query] : DEFAULT_QUERIES;
    const results = await Promise.all(
      queries.map((q) =>
        kakaoKeywordSearch({ query: q, lat, lng, radius: query ? undefined : radius })
      )
    );

    // place id 기준 dedupe
    const byId = new Map<string, KakaoDocument>();
    for (const docs of results) for (const d of docs) byId.set(d.id, d);
    const docs = [...byId.values()];

    // 우리 DB에서 가격 제보 수 병합
    let priceCounts = new Map<string, number>();
    if (docs.length > 0) {
      const { data } = await supabaseAdmin()
        .from("places")
        .select("kakao_place_id, price_reports(count)")
        .in("kakao_place_id", docs.map((d) => d.id));
      priceCounts = new Map(
        (data ?? []).map((row: any) => [
          row.kakao_place_id as string,
          (row.price_reports?.[0]?.count as number) ?? 0
        ])
      );
    }

    const places: KakaoPlace[] = docs
      .map((d) => {
        const count = priceCounts.get(d.id) ?? 0;
        return {
          kakaoPlaceId: d.id,
          name: d.place_name,
          address: d.address_name,
          roadAddress: d.road_address_name,
          lat: Number(d.y),
          lng: Number(d.x),
          category: mapCategory(d.category_name),
          phone: d.phone || undefined,
          distance: d.distance ? Number(d.distance) : undefined,
          hasPrice: count > 0,
          priceCount: count
        };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    return NextResponse.json({ places });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다" }, { status: 500 });
  }
}
