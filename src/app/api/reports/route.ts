import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipHashFrom } from "@/lib/ip";

export const runtime = "nodejs";

/** POST /api/reports  body: { targetType: 'price_report'|'comment', targetId, reason } */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "");
  const reason = String(body.reason ?? "").slice(0, 300);

  if (!["price_report", "comment"].includes(targetType) || !targetId) {
    return NextResponse.json({ error: "신고 대상이 올바르지 않습니다" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    ip_hash: ipHashFrom(req)
  });
  if (error) return NextResponse.json({ error: "신고 접수에 실패했습니다" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
