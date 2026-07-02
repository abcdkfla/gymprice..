import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** 서버 전용. RLS를 우회하므로 절대 클라이언트 코드에서 import 금지. */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인)");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
