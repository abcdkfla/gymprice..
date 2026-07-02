import { supabaseAdmin } from "./supabaseAdmin";

/**
 * MVP용 DB 카운트 방식 rate limit.
 * 트래픽 증가 시 Upstash Redis(@upstash/ratelimit)로 교체 권장 — 인터페이스 동일하게 유지.
 */
export async function isRateLimited(
  table: "price_reports" | "comments",
  ipHash: string,
  maxPerHour: number
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) return true; // 판단 불가 시 차단 (fail-closed)
  return (count ?? 0) >= maxPerHour;
}

/** 동일 IP + 동일 업체 + 동일 상품 조합의 24시간 내 중복 제보 차단 */
export async function isDuplicateReport(
  ipHash: string,
  placeId: string,
  productType: string,
  duration: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("price_reports")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("place_id", placeId)
    .eq("product_type", productType)
    .eq("duration", duration)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) > 0;
}
