import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "parking-radar",
  description: "국내 공항 주차 현황과 요금 계산을 위한 반응형 대시보드"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

