"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listPublicMarkets, type PublicMarket } from "../lib/markets";
import { isAuthed } from "../lib/auth";
import { LoginModal } from "./LoginModal";

/** 홈 상단 메뉴 바. "마켓" 호버 시 등록된 마켓 드롭다운, 우측 끝 관리자 버튼. */
export function TopNav() {
  const router = useRouter();
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // 관리자 버튼: 이미 로그인돼 있으면 바로 이동, 아니면 로그인 모달.
  function handleAdminClick() {
    if (isAuthed()) router.push("/admin");
    else setShowLogin(true);
  }

  useEffect(() => {
    const controller = new AbortController();
    listPublicMarkets(controller.signal)
      .then((data) => {
        setMarkets(data);
        setLoaded(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoaded(true); // 실패해도 빈 목록으로 표시
      });
    return () => controller.abort();
  }, []);

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          Whisky Frog
        </Link>

        {/* 마켓 — 호버 시 등록된 마켓 목록 드롭다운 */}
        <div className="group relative">
          <Link
            href="/admin/markets"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            마켓
          </Link>
          {/* top-full에 바로 붙여 호버 유지(중간 빈틈 없음) */}
          <div className="invisible absolute left-0 top-full z-20 min-w-[200px] rounded-md border border-gray-200 bg-white py-1 opacity-0 shadow-lg transition-opacity duration-100 group-hover:visible group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-900">
            {!loaded ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                불러오는 중…
              </p>
            ) : markets.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                등록된 마켓이 없습니다.
              </p>
            ) : (
              markets.map((m) => (
                <Link
                  key={m.id}
                  href="/admin/markets"
                  className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {m.currency}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* 직구가격 — 수동입력 확인용 계산 페이지 */}
        <Link
          href="/direct-price"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          직구가격
        </Link>
      </div>

      <button
        onClick={handleAdminClick}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        관리자
      </button>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            router.push("/admin");
          }}
        />
      )}
    </nav>
  );
}
