import type { Metadata } from "next";
import Link from "next/link";
import PlaceDetail from "@/components/PlaceDetail";

interface Props {
  params: { kakaoPlaceId: string };
  searchParams: Record<string, string | undefined>;
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const name = searchParams.name ?? "헬스장";
  const region = (searchParams.roadAddress ?? searchParams.address ?? "")
    .split(" ")
    .slice(0, 2)
    .join(" ");
  return {
    title: `${region} ${name} 가격`,
    description: `${name}의 회원권·PT·필라테스 실제 등록 가격을 이용자 제보로 확인하세요.`
  };
}

export default function PlacePage({ params, searchParams }: Props) {
  const placeSeed = {
    kakaoPlaceId: params.kakaoPlaceId,
    name: searchParams.name ?? "",
    address: searchParams.address ?? "",
    roadAddress: searchParams.roadAddress ?? "",
    lat: Number(searchParams.lat ?? 0),
    lng: Number(searchParams.lng ?? 0),
    category: searchParams.category ?? "gym"
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <nav className="mb-3">
        <Link href="/" className="focusable text-sm text-muted">
          ← 지도로 돌아가기
        </Link>
      </nav>
      <PlaceDetail seed={placeSeed} />
      <footer className="mt-10 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
        본 가격 정보는 이용자 제보 기반이며 실제와 다를 수 있습니다. 잘못된 정보는 각 항목의
        신고 버튼으로 알려주세요. 장소 정보 출처: Kakao
      </footer>
    </main>
  );
}
