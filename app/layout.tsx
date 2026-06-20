import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whisky Bungee",
  description: "해외 쇼핑몰 가격(현지가+배송+관세) + 리뷰 통합 비교",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
