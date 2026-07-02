import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** GET /api/places/[kakaoPlaceId] → 업체 + 가격 제보 + 코멘트 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { kakaoPlaceId: string } }
) {
  const db = supabaseAdmin();
  const { data: place } = await db
    .from("places")
    .select("id, kakao_place_id, name, address, road_address, lat, lng, category")
    .eq("kakao_place_id", params.kakaoPlaceId)
    .maybeSingle();

  if (!place) {
    // 아직 아무 제보가 없는 업체 — 빈 상태로 응답 (프론트는 카카오 데이터로 표시)
    return NextResponse.json({ place: null, prices: [], comments: [] });
  }

  const [{ data: prices }, { data: comments }] = await Promise.all([
    db
      .from("price_reports")
      .select("id, anon_nickname, product_type, duration, price, is_event_price, visited_at, created_at")
      .eq("place_id", place.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("comments")
      .select("id, anon_nickname, content, created_at")
      .eq("place_id", place.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  return NextResponse.json({ place, prices: prices ?? [], comments: comments ?? [] });
}
