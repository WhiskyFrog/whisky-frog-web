import { ExchangeRateMini } from "./components/ExchangeRateMini";
import { TopNav } from "./components/TopNav";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <TopNav />

      <main className="flex flex-col items-center justify-center gap-4 px-8 py-24">
        <h1 className="text-3xl font-bold">Whisky Bungee</h1>
        <p className="text-gray-500">
          Phase 1 — 환경 골격. 상품 목록/상세는 Phase 6에서 구현됩니다.
        </p>
      </main>

      {/* 좌하단 요약 환율표 — 전체보기 클릭 시 /exchange-rates 상세 페이지로 이동 */}
      <div className="fixed bottom-4 left-4 z-10">
        <ExchangeRateMini />
      </div>
    </div>
  );
}
