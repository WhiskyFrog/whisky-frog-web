"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthed } from "../lib/auth";
import { listPublicMarkets, type PublicMarket } from "../lib/markets";
import { LoginModal } from "./LoginModal";

export function TopNav() {
  const router = useRouter();
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

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
        setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <nav className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-[#D8A868] bg-[#FFF8EA]/95 px-5 text-[#302818] backdrop-blur sm:px-8 lg:px-12">
      <div className="flex items-center gap-5 sm:gap-7">
        <Link href="/" className="text-lg font-black tracking-wide">
          Whisky Frog
        </Link>

        <div className="group relative -mx-3">
          <span className="inline-flex cursor-default select-none items-center px-3 py-3 text-sm font-bold text-[#5A421F] group-hover:text-[#302818]">
            마켓
          </span>
          {/* top-full에 바로 붙이고 pt-2는 투명 브리지 — 트리거~카드 사이 호버 유지(틈 없음) */}
          <div className="invisible absolute left-0 top-full z-20 pt-2 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100">
            <div className="min-w-[210px] rounded-md border-2 border-[#D8A868] bg-[#FFF8EA] py-1 shadow-[0_8px_0_rgba(128,88,24,0.14)]">
              {!loaded ? (
                <p className="px-3 py-2 text-xs font-semibold text-[#987850]">
                  불러오는 중
                </p>
              ) : markets.length === 0 ? (
                <p className="px-3 py-2 text-xs font-semibold text-[#987850]">
                  등록된 마켓이 없습니다.
                </p>
              ) : (
                markets.map((market) => (
                  <Link
                    key={market.id}
                    href={`/markets/${market.code}`}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm text-[#4B3418] hover:bg-[#F8E7C6]"
                  >
                    <span className="font-bold">{market.name}</span>
                    <span className="text-xs font-semibold text-[#9A6A20]">
                      {market.currency}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <Link
          href="/direct-price"
          className="text-sm font-bold text-[#5A421F] hover:text-[#302818]"
        >
          직구가 계산
        </Link>
      </div>

      <button
        onClick={handleAdminClick}
        className="rounded-md border-2 border-[#805818] bg-[#F8E7C6] px-3 py-1.5 text-sm font-bold text-[#4B3418] hover:bg-[#FFEFCF]"
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
