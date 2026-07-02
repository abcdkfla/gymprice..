import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkBannedWords, logFilterHit } from "@/lib/filter";
import { isRateLimited } from "@/lib/ratelimit";
import { ipHashFrom } from "@/lib/ip";

export const runtime = "nodejs";

/**
 * POST /api/places/[kakaoPlaceId]/comments
 * body: { nickname, content, place?: {...lazy 생성용}, website?: honeypot }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { kakaoPlaceId: string } }
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  if (body.website) return NextResponse.json({ ok: true }); // honeypot

  const ipHash = ipHashFrom(req);

  if (await isRateLimited("comments", ipHash, 10)) {
    return NextResponse.json(
      { error: "등록이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const nickname = String(body.nickname ?? "익명").trim().slice(0, 20) || "익명";
  const content = String(body.content ?? "").trim();
  if (!content || content.length > 500) {
    return NextResponse.json({ error: "내용은 1~500자로 입력해주세요" }, { status: 400 });
  }

  // 금칙어 필터: 닉네임 + 본문 모두
  const hit = await checkBannedWords(nickname + "\n" + content);
  if (hit.blocked) {
    await logFilterHit(ipHash, content, hit.matched ?? "");
    return NextResponse.json(
      { error: "등록할 수 없는 단어가 포함되어 있습니다" },
      { status: 422 }
    );
  }

  const db = supabaseAdmin();

  // place 조회, 없으면 lazy 생성
  let { data: place } = await db
    .from("places")
    .select("id")
    .eq("kakao_place_id", params.kakaoPlaceId)
    .maybeSingle();

  if (!place) {
    const p = body.place ?? {};
    if (!p.name || p.lat == null || p.lng == null) {
      return NextResponse.json({ error: "업체 정보가 누락되었습니다" }, { status: 400 });
    }
    const { data: created, error } = await db
      .from("places")
      .upsert(
        {
          kakao_place_id: params.kakaoPlaceId,
          name: String(p.name).slice(0, 100),
          address: p.address ? String(p.address).slice(0, 200) : null,
          road_address: p.roadAddress ? String(p.roadAddress).slice(0, 200) : null,
          lat: Number(p.lat),
          lng: Number(p.lng),
          category: ["gym", "pilates", "crossfit", "etc"].includes(p.category) ? p.category : "etc"
        },
        { onConflict: "kakao_place_id" }
      )
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "업체 정보 저장에 실패했습니다" }, { status: 500 });
    }
    place = created;
  }

  const { data: inserted, error: insertErr } = await db
    .from("comments")
    .insert({ place_id: place.id, anon_nickname: nickname, content, ip_hash: ipHash })
    .select("id, anon_nickname, content, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: "등록에 실패했습니다" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, comment: inserted }, { status: 201 });
}
