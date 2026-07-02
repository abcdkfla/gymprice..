import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "짐프라이스 — 내 주변 헬스장·필라테스 실제 가격", template: "%s | 짐프라이스" },
  description:
    "가격 안 알려주는 헬스장, 이용자들이 직접 공유합니다. 내 주변 헬스장·필라테스의 실제 등록 가격을 확인하세요."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
