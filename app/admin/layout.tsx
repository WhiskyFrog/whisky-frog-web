"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthed, logout } from "../lib/auth";

/** 좌측 사이드바 메뉴. 첫 항목 = 마켓 관리. 이후 항목은 여기에 추가. */
const MENU = [
  { href: "/admin/markets", label: "마켓 관리" },
  { href: "/admin/crawls", label: "데이터 수집 관리" },
  { href: "/admin/reviews", label: "검토" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // 모바일 드로어 열림 상태(데스크톱 md+ 에선 무시됨).
  const [navOpen, setNavOpen] = useState(false);
  // 인증 확인 전 깜빡임 방지 게이트.
  const [authChecked, setAuthChecked] = useState(false);

  // 인증 가드 — 토큰 없으면 홈으로(로그인은 홈 상단 관리자 버튼에서). 최종 강제는 백엔드 401.
  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // 라우트 이동 시 모바일 드로어 자동 닫기.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    router.replace("/");
  }

  // 미인증이면 리다이렉트 진행 중 — 내용 렌더 안 함.
  if (!authChecked) return null;

  return (
    <div className="flex min-h-screen">
      {/* 모바일 상단바 — md 이상에선 숨김. 햄버거로 드로어 오픈. */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="메뉴 열기"
          className="rounded p-1 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-base font-bold text-gray-900 dark:text-gray-100">
          관리자
        </span>
      </header>

      {/* 드로어 백드롭(모바일·열렸을 때만). 클릭 시 닫힘. */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden dark:bg-black/60"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 transform flex-col border-r border-gray-200 bg-gray-50 transition-transform duration-200 md:static md:translate-x-0 dark:border-gray-800 dark:bg-gray-900 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-800">
          <div>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← 사이트로
            </Link>
            <h1 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
              관리자
            </h1>
          </div>
          {/* 모바일 전용 닫기 버튼. */}
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="메뉴 닫기"
            className="rounded p-1 text-gray-500 hover:bg-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-2 py-3">
          {MENU.map((m) => {
            const active =
              pathname === m.href || pathname.startsWith(`${m.href}/`);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* 로그아웃 — JWT 폐기 후 홈으로. */}
        <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 모바일은 상단 고정바 높이만큼 pt 확보, 데스크톱은 원래대로. */}
      <main className="flex-1 overflow-x-auto px-6 py-6 pt-16 md:pt-6">
        {children}
      </main>
    </div>
  );
}
