"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RADIUS_OPTIONS, labelOf, CATEGORIES, type KakaoPlace } from "@/lib/constants";

declare global {
  interface Window {
    kakao: any;
  }
}

const SEOUL_CITY_HALL = { lat: 37.5663, lng: 126.9779 };

function markerImage(hasPrice: boolean) {
  // 초록(가격 있음) / 회색(정보 없음) SVG 마커
  const color = hasPrice ? "#0BA360" : "#9AA0A6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="14" r="6.5" fill="#fff"/>
    <text x="15" y="18" font-size="9" font-weight="bold" text-anchor="middle" fill="${color}">₩</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export default function MapView() {
  const mapRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [selected, setSelected] = useState<KakaoPlace | null>(null);
  const [radius, setRadius] = useState<number>(1000);
  const [query, setQuery] = useState("");
  const [showResearch, setShowResearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  // 카카오맵 SDK 로드
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) {
      setError("카카오맵 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 설정되지 않았습니다.");
      return;
    }
    if (window.kakao?.maps) {
      setReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => setReady(true));
    script.onerror = () => setError("카카오맵을 불러오지 못했습니다. 키와 도메인 설정을 확인하세요.");
    document.head.appendChild(script);
  }, []);

  // 지도 초기화 + 현재 위치
  useEffect(() => {
    if (!ready || !mapElRef.current || mapRef.current) return;
    const map = new window.kakao.maps.Map(mapElRef.current, {
      center: new window.kakao.maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
      level: 4
    });
    mapRef.current = map;

    window.kakao.maps.event.addListener(map, "dragend", () => setShowResearch(true));
    window.kakao.maps.event.addListener(map, "zoom_changed", () => setShowResearch(true));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
          map.setCenter(c);
          search(pos.coords.latitude, pos.coords.longitude, radius);
        },
        () => {
          setGeoDenied(true);
          search(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng, radius);
        },
        { timeout: 8000 }
      );
    } else {
      search(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng, radius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  };

  const renderMarkers = useCallback((items: KakaoPlace[]) => {
    const map = mapRef.current;
    if (!map) return;
    clearMarkers();
    items.forEach((p) => {
      const img = new window.kakao.maps.MarkerImage(
        markerImage(p.hasPrice),
        new window.kakao.maps.Size(30, 40),
        { offset: new window.kakao.maps.Point(15, 40) }
      );
      const marker = new window.kakao.maps.Marker({
        map,
        position: new window.kakao.maps.LatLng(p.lat, p.lng),
        image: img,
        title: p.name
      });
      window.kakao.maps.event.addListener(marker, "click", () => setSelected(p));
      markersRef.current.push(marker);
    });
  }, []);

  const search = useCallback(
    async (lat: number, lng: number, r: number, q?: string) => {
      setLoading(true);
      setError(null);
      setShowResearch(false);
      try {
        const sp = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(r) });
        if (q) sp.set("query", q);
        const res = await fetch(`/api/places/search?${sp}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "검색 실패");
        setPlaces(data.places);
        renderMarkers(data.places);
        if (q && data.places.length > 0 && mapRef.current) {
          mapRef.current.setCenter(
            new window.kakao.maps.LatLng(data.places[0].lat, data.places[0].lng)
          );
        }
      } catch (e: any) {
        setError(e.message ?? "검색 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    },
    [renderMarkers]
  );

  const searchHere = () => {
    const c = mapRef.current?.getCenter();
    if (c) search(c.getLat(), c.getLng(), radius, query || undefined);
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const c = mapRef.current?.getCenter();
    if (c) search(c.getLat(), c.getLng(), radius, query.trim() || undefined);
  };

  const detailHref = (p: KakaoPlace) =>
    `/place/${p.kakaoPlaceId}?` +
    new URLSearchParams({
      name: p.name,
      address: p.address,
      roadAddress: p.roadAddress,
      lat: String(p.lat),
      lng: String(p.lng),
      category: p.category
    }).toString();

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* 상단 검색바 */}
      <div className="absolute left-0 right-0 top-0 z-20 p-3">
        <form onSubmit={onSubmitSearch} className="mx-auto flex max-w-xl gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지역명 또는 업체명 검색 (예: 강남 필라테스)"
            className="focusable h-11 flex-1 rounded-xl border border-line bg-paper px-4 text-[15px] shadow-md placeholder:text-muted"
          />
          <button
            type="submit"
            className="focusable h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-paper shadow-md"
          >
            검색
          </button>
        </form>
        <div className="mx-auto mt-2 flex max-w-xl items-center gap-1.5">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRadius(r);
                const c = mapRef.current?.getCenter();
                if (c) search(c.getLat(), c.getLng(), r, query || undefined);
              }}
              className={`focusable rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${
                radius === r ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
              }`}
            >
              {r < 1000 ? `${r}m` : `${r / 1000}km`}
            </button>
          ))}
          <span className="ml-auto rounded-full bg-paper/90 px-2.5 py-1 text-[11px] text-muted shadow-sm">
            <b className="text-priced">●</b> 가격 있음 <b className="text-muted">●</b> 정보 없음
          </span>
        </div>
      </div>

      {/* 재검색 버튼 */}
      {showResearch && !loading && (
        <button
          onClick={searchHere}
          className="focusable absolute left-1/2 top-28 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-lg"
        >
          ↻ 이 지역에서 재검색
        </button>
      )}

      {/* 지도 */}
      <div ref={mapElRef} className="h-full w-full bg-mist" />

      {/* 상태 메시지 */}
      {loading && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 rounded-full bg-ink/85 px-4 py-2 text-sm text-paper">
          주변 검색 중…
        </div>
      )}
      {error && (
        <div className="absolute left-1/2 top-28 z-20 w-[90%] max-w-md -translate-x-1/2 rounded-xl bg-danger px-4 py-2 text-center text-sm text-paper shadow-lg">
          {error}
        </div>
      )}
      {geoDenied && !error && (
        <div className="absolute bottom-[46%] left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1.5 text-xs text-paper">
          위치 권한이 꺼져 있어요 — 검색으로 동네를 찾아보세요
        </div>
      )}

      {/* 하단 시트: 결과 리스트 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[42%] overflow-y-auto rounded-t-2xl bg-paper shadow-sheet">
        <div className="sticky top-0 bg-paper px-4 pb-1 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
          <p className="mt-2 text-sm font-semibold">
            주변 결과 {places.length}곳
            <span className="ml-2 font-normal text-muted">
              가격 제보 {places.filter((p) => p.hasPrice).length}곳
            </span>
          </p>
        </div>
        <ul className="divide-y divide-line px-4 pb-6">
          {places.map((p) => (
            <li key={p.kakaoPlaceId}>
              <Link
                href={detailHref(p)}
                className="focusable flex items-center gap-3 py-3"
                onClick={() => setSelected(p)}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.hasPrice ? "bg-priced" : "bg-line"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {labelOf(CATEGORIES, p.category)}
                    {p.distance != null && ` · ${p.distance}m`} · {p.roadAddress || p.address}
                  </span>
                </span>
                {p.hasPrice ? (
                  <span className="price-sticker">제보 {p.priceCount}건</span>
                ) : (
                  <span className="shrink-0 text-xs text-muted">첫 제보하기 →</span>
                )}
              </Link>
            </li>
          ))}
          {!loading && places.length === 0 && (
            <li className="py-8 text-center text-sm text-muted">
              결과가 없어요. 반경을 넓히거나 다른 키워드로 검색해보세요.
            </li>
          )}
        </ul>
      </div>

      {/* 선택 업체 미니 카드 */}
      {selected && (
        <div className="absolute bottom-[44%] left-1/2 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-line bg-paper p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{selected.name}</p>
              <p className="truncate text-xs text-muted">
                {selected.roadAddress || selected.address}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="닫기"
              className="focusable -mr-1 -mt-1 rounded-full p-1 text-muted"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {selected.hasPrice ? (
              <span className="price-sticker">가격 제보 {selected.priceCount}건</span>
            ) : (
              <span className="text-xs text-muted">아직 가격 정보가 없어요</span>
            )}
            <Link
              href={detailHref(selected)}
              className="focusable rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper"
            >
              {selected.hasPrice ? "가격 보기" : "첫 제보 남기기"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
