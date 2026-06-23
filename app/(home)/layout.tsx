import { ExchangeRateMini } from "../components/ExchangeRateMini";
import { TopNav } from "../components/TopNav";

/**
 * 공개(홈) 셸 레이아웃 — 상단 네비와 좌하단 요약 환율을 고정으로 유지한다.
 * `/`(홈)·`/direct-price` 등 자식 라우트 간 이동 시 이 셸은 그대로 마운트된 채
 * {children}(메인 컨텐츠)만 교체돼 화면 전체가 깜빡이며 바뀌지 않는다.
 */
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <TopNav />

      {children}

      {/* 좌하단 요약 환율표 — 전체보기 클릭 시 /exchange-rates 상세 페이지로 이동 */}
      <div className="fixed bottom-4 left-4 z-10">
        <ExchangeRateMini />
      </div>
    </div>
  );
}
