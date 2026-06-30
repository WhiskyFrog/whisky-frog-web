import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whisky Frog",
  description:
    "Good whisky, good friends, good time. 취향에 맞는 위스키를 찾고 즐기는 작은 숲속 왕국.",
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
