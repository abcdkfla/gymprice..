export interface KakaoDocument {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
  phone: string;
  distance: string;
  category_name: string;
}

/** 카카오 로컬 키워드 검색. REST 키는 서버에서만 사용한다. */
export async function kakaoKeywordSearch(params: {
  query: string;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
}): Promise<KakaoDocument[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다");

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", params.query);
  url.searchParams.set("size", "15");
  url.searchParams.set("page", String(params.page ?? 1));
  if (params.lat != null && params.lng != null) {
    url.searchParams.set("y", String(params.lat));
    url.searchParams.set("x", String(params.lng));
    if (params.radius) {
      url.searchParams.set("radius", String(Math.min(params.radius, 20000)));
      url.searchParams.set("sort", "distance");
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 300 } // 동일 요청 5분 캐시
  });
  if (!res.ok) throw new Error(`카카오 API 오류: ${res.status}`);
  const data = await res.json();
  return (data.documents ?? []) as KakaoDocument[];
}

/** 카카오 카테고리 문자열 → 우리 서비스 카테고리 */
export function mapCategory(categoryName: string): string {
  if (categoryName.includes("필라테스")) return "pilates";
  if (categoryName.includes("크로스핏")) return "crossfit";
  if (categoryName.includes("헬스") || categoryName.includes("피트니스")) return "gym";
  return "etc";
}
