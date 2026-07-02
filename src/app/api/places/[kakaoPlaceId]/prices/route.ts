import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkBannedWords, logFilterHit } from "@/lib/filter";
import { isRateLimited, isDuplicateReport } from "@/lib/ratelimit";
import { ipHashFrom } from "@/lib/ip";
import { PRODUCT_TYPES, DURATIONS } from "@/lib/constants";

export const runtime = "nodejs";

const VALID_PRODUCTS = new Set(PRODUCT_TYPES.map((p) => p.value));
const VALID_DURATIONS = new Set(DURATIONS.map((d) => d.value));

/**
 * POST /api/places/[kakaoPlaceId]/prices
 * body: { nickname, productType, duration, price, isEventPrice, visitedAt?,
 *         place: { name, address, roadAddress, lat, lng, category },  // lazy 생성용
 *         website?: string }  // honeypot — 값이 있으면 봇
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

  // 0) honeypot: 사람 눈에는 안 보이는 필드가 채워져 있으면 봇
  if (body.website) return NextResponse.json({ ok: true }); // 조용히 무시

  const ipHash = ipHashFrom(req);

  // 1) rate limit: 가격 제보 시간당 5건
  if (await isRateLimited("price_reports", ipHash, 5)) {
    return NextResponse.json(
      { error: "등록이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  // 2) 유효성 검사
  const nickname = String(body.nickname ?? "익명").trim().slice(0, 20) || "익명";
  const productType = String(body.productType ?? "");
  const duration = String(body.duration ?? "");
  const price = Number(body.price);
  const isEventPrice = Boolean(body.isEventPrice);
  const visitedAt = body.visitedAt ? String(body.visitedAt) : null;

  if (!VALID_PRODUCTS.has(productType as any) || !VALID_DURATIONS.has(duration as any)) {
    return NextResponse.json({ error: "상품 종류와 기간을 선택해주세요" }, { status: 400 });
  }
  if (!Number.isInteger(price) || price <= 0 || price >= 100000000) {
    return NextResponse.json({ error: "가격을 올바르게 입력해주세요" }, { status: 400 });
  }

  // 3) 금칙어 필터 (닉네임)
  const hit = await checkBannedWords(nickname);
  if (hit.blocked) {
    await logFilterHit(ipHash, nickname, hit.matched ?? "");
    return NextResponse.json(
      { error: "등록할 수 없는 단어가 포함되어 있습니다" },
      { status: 422 }
    );
  }

  const db = supabaseAdmin();

  // 4) places lazy 생성 (첫 제보 시점에 row 생성)
  const p = body.place ?? {};
  if (!p.name || p.lat == null || p.lng == null) {
    return NextResponse.json({ error: "업체 정보가 누락되었습니다" }, { status: 400 });
  }
  const { data: place, error: upsertErr } = await db
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

  if (upsertErr || !place) {
    console.error(upsertErr);
    return NextResponse.json({ error: "업체 정보 저장에 실패했습니다" }, { status: 500 });
  }

  // 5) 24시간 내 동일 조합 중복 제보 차단
  if (await isDuplicateReport(ipHash, place.id, productType, duration)) {
    return NextResponse.json(
      { error: "같은 상품의 가격을 이미 등록하셨습니다. (24시간 후 다시 등록 가능)" },
      { status: 409 }
    );
  }

  // 6) insert
  const { data: inserted, error: insertErr } = await db
    .from("price_reports")
    .insert({
      place_id: place.id,
      anon_nickname: nickname,
      product_type: productType,
      duration,
      price,
      is_event_price: isEventPrice,
      visited_at: visitedAt,
      ip_hash: ipHash
    })
    .select("id, anon_nickname, product_type, duration, price, is_event_price, visited_at, created_at")
    .single();

  if (insertErr) {
    console.error(insertErr);
    return NextResponse.json({ error: "등록에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: inserted }, { status: 201 });
}
