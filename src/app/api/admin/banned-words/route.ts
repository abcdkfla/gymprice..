import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function authorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin()
    .from("banned_words")
    .select("id, word, match_type, category, created_at")
    .order("created_at", { ascending: false });
  return NextResponse.json({ words: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const word = String(body.word ?? "").trim();
  const matchType = body.matchType === "regex" ? "regex" : "contains";
  const category = ["profanity", "ad", "privacy"].includes(body.category) ? body.category : "profanity";
  if (!word) return NextResponse.json({ error: "단어를 입력해주세요" }, { status: 400 });

  if (matchType === "regex") {
    try {
      new RegExp(word);
    } catch {
      return NextResponse.json({ error: "올바르지 않은 정규식입니다" }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin()
    .from("banned_words")
    .insert({ word, match_type: matchType, category })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "추가에 실패했습니다" }, { status: 500 });
  return NextResponse.json({ ok: true, word: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
  const { error } = await supabaseAdmin().from("banned_words").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
