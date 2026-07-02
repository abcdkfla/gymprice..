import { supabaseAdmin } from "./supabaseAdmin";
import { decomposeHangul } from "./hangul";

interface BannedWord {
  word: string;
  match_type: "contains" | "regex";
}

// 금칙어 목록 60초 메모리 캐시 (서버리스 인스턴스별)
let cache: { words: BannedWord[]; at: number } | null = null;
const CACHE_MS = 60_000;

async function loadBannedWords(): Promise<BannedWord[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.words;
  const { data, error } = await supabaseAdmin()
    .from("banned_words")
    .select("word, match_type");
  if (error) {
    // 필터 로드 실패 시 등록을 막는 쪽이 안전 (fail-closed)
    throw new Error("금칙어 목록을 불러오지 못했습니다");
  }
  cache = { words: (data ?? []) as BannedWord[], at: Date.now() };
  return cache.words;
}

/**
 * 우회 입력 대응 정규화:
 * - NFKC(전각→반각), 소문자화
 * - 공백/구두점/기호 제거 ("문 의 주 세 요", "문.의.주.세.요" → "문의주세요")
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\.\-_\*~!@#$%^&+=|\\/:;'"<>?,()\[\]{}·ㆍ…‥]/g, "");
}

export interface FilterResult {
  blocked: boolean;
  matched?: string;
}

/**
 * 3중 매칭:
 *  1) 원문에 대해 regex 패턴 검사 (전화번호/URL/주민번호 등)
 *  2) 정규화 텍스트에 contains 검사
 *  3) 자모 분해 텍스트에 contains 검사 ("ㅅl발" 류 우회 차단)
 */
export async function checkBannedWords(text: string): Promise<FilterResult> {
  if (!text) return { blocked: false };
  const words = await loadBannedWords();

  const normalized = normalizeText(text);
  const jamo = decomposeHangul(normalized);

  for (const bw of words) {
    if (bw.match_type === "regex") {
      try {
        const re = new RegExp(bw.word, "iu");
        if (re.test(text) || re.test(normalized)) {
          return { blocked: true, matched: bw.word };
        }
      } catch {
        // 잘못된 정규식은 무시 (관리자 입력 실수 방어)
        continue;
      }
    } else {
      const target = normalizeText(bw.word);
      const targetJamo = decomposeHangul(target);
      if (normalized.includes(target) || jamo.includes(targetJamo)) {
        return { blocked: true, matched: bw.word };
      }
    }
  }
  return { blocked: false };
}

/** 차단 시도 기록 — 반복 시도 IP 파악용. 실패해도 요청 흐름은 막지 않음. */
export async function logFilterHit(ipHash: string, originalText: string, matched: string) {
  try {
    await supabaseAdmin().from("filter_logs").insert({
      ip_hash: ipHash,
      original_text: originalText.slice(0, 500),
      matched_word: matched
    });
  } catch {
    /* noop */
  }
}
