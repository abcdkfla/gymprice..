import MapView from "@/components/MapView";

export default function HomePage() {
  return (
    <main>
      <h1 className="sr-only">짐프라이스 — 내 주변 헬스장·필라테스 실제 가격</h1>
      <MapView />
    </main>
  );
}
