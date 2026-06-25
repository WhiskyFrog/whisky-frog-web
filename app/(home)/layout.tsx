import { HomeShell } from "./HomeShell";

/**
 * 공개(홈) 셸 레이아웃 — 상단 네비와 공통 홈 UI를 유지한다.
 * `/`(홈)·`/direct-price` 등 자식 라우트 간 이동 시 이 셸은 그대로 마운트된 채
 * {children}(메인 컨텐츠)만 교체돼 화면 전체가 깜빡이며 바뀌지 않는다.
 */
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeShell>{children}</HomeShell>;
}
