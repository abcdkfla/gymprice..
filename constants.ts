export const PRODUCT_TYPES = [
  { value: "membership", label: "헬스 회원권" },
  { value: "pt", label: "PT (개인 트레이닝)" },
  { value: "pilates_group", label: "필라테스 그룹" },
  { value: "pilates_private", label: "필라테스 개인" },
  { value: "ot", label: "OT" },
  { value: "locker", label: "락커·운동복" },
  { value: "etc", label: "기타" }
] as const;

export const DURATIONS = [
  { value: "1m", label: "1개월" },
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "12m", label: "12개월" },
  { value: "per10", label: "10회권" },
  { value: "per20", label: "20회권" },
  { value: "per30", label: "30회권" },
  { value: "once", label: "1회" }
] as const;

export const CATEGORIES = [
  { value: "gym", label: "헬스" },
  { value: "pilates", label: "필라테스" },
  { value: "crossfit", label: "크로스핏" },
  { value: "etc", label: "기타" }
] as const;

export const RADIUS_OPTIONS = [500, 1000, 3000, 5000] as const;

export function labelOf(list: readonly { value: string; label: string }[], value: string) {
  return list.find((x) => x.value === value)?.label ?? value;
}

export function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

export interface KakaoPlace {
  kakaoPlaceId: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  phone?: string;
  distance?: number; // meters
  hasPrice: boolean;
  priceCount: number;
}

export interface PriceReport {
  id: string;
  anon_nickname: string;
  product_type: string;
  duration: string;
  price: number;
  is_event_price: boolean;
  visited_at: string | null;
  created_at: string;
}

export interface PlaceComment {
  id: string;
  anon_nickname: string;
  content: string;
  created_at: string;
}
