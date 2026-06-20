"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminToken, setAdminToken } from "../lib/markets";

/** 좌측 사이드바 메뉴. 첫 항목 = 마켓 관리. 이후 항목은 여기에 추가. */
const MENU = [{ href: "/admin/markets", label: "마켓 관리" }];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [token, setToken] = useState("");

  // 저장된 관리자 토큰 로드(브라우저에서만).
  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 px-4 py-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← 사이트로
          </Link>
          <h1 className="mt-1 text-lg font-bold text-gray-900">관리자</h1>
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
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* 관리자 토큰 — 백엔드 ADMIN_API_TOKEN 설정 시 필요. 로컬은 비워둬도 됨. */}
        <div className="border-t border-gray-200 px-3 py-3">
          <label className="block text-xs font-medium text-gray-500">
            관리자 토큰
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onBlur={() => setAdminToken(token.trim())}
            placeholder="로컬은 비워둠"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <p className="mt-1 text-[10px] leading-tight text-gray-400">
            입력 후 포커스 해제 시 이 브라우저에 저장됩니다.
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto px-6 py-6">{children}</main>
    </div>
  );
}
