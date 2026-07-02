import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function authorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

/** GET /api/admin/reports → 대기 중 신고 + 대상 콘텐츠 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();

  const { data: reports } = await db
    .from("reports")
    .select("id, target_type, target_id, reason, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  // 대상 콘텐츠 붙이기
  const enriched = await Promise.all(
    (reports ?? []).map(async (r) => {
      const table = r.target_type === "comment" ? "comments" : "price_reports";
      const { data: target } = await db
        .from(table)
        .select("*, places(name)")
        .eq("id", r.target_id)
        .maybeSingle();
      return { ...r, target };
    })
  );

  return NextResponse.json({ reports: enriched });
}

/**
 * POST /api/admin/reports
 * body: { reportId, action: 'hide' | 'restore' | 'reject' }
 *  - hide: 대상 콘텐츠 status='hidden' + 신고 resolved
 *  - restore: 대상 콘텐츠 status='active' + 신고 resolved
 *  - reject: 신고만 rejected 처리
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { reportId, action } = body;
  const db = supabaseAdmin();

  const { data: report } = await db
    .from("reports")
    .select("id, target_type, target_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "신고를 찾을 수 없습니다" }, { status: 404 });

  const table = report.target_type === "comment" ? "comments" : "price_reports";

  if (action === "hide" || action === "restore") {
    await db
      .from(table)
      .update({ status: action === "hide" ? "hidden" : "active" })
      .eq("id", report.target_id);
    await db.from("reports").update({ status: "resolved" }).eq("id", reportId);
  } else if (action === "reject") {
    await db.from("reports").update({ status: "rejected" }).eq("id", reportId);
  } else {
    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
