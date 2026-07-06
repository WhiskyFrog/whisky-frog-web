"use client";

// 위스키 도메인 관리 — 분류기 위키(제품/브랜드/증류소/병입자/캐스크/별칭/노트) CRUD.
// 계약: 볼트 docs/handoff-frontend-whisky-admin.md → /api/admin/whisky/* (adminWhisky.ts).

import { useEffect, useState } from "react";
import ProductsTab from "./ProductsTab";
import BrandsTab from "./BrandsTab";
import DistilleriesTab from "./DistilleriesTab";
import BottlersTab from "./BottlersTab";
import CasksTab from "./CasksTab";
import AliasesTab from "./AliasesTab";
import NotesTab from "./NotesTab";

type Tab =
  | "products"
  | "brands"
  | "distilleries"
  | "bottlers"
  | "casks"
  | "aliases"
  | "notes";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "products", label: "제품" },
  { key: "brands", label: "브랜드" },
  { key: "distilleries", label: "증류소" },
  { key: "bottlers", label: "병입자" },
  { key: "casks", label: "캐스크" },
  { key: "aliases", label: "별칭" },
  { key: "notes", label: "노트" },
];

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value);
}

export default function AdminWhiskyPage() {
  const [tab, setTab] = useState<Tab>("products");

  // ?tab= 딥링크 — SSR 하이드레이션 불일치를 피하려고 마운트 후 반영.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <header className="mb-5">
        <h2 className="text-xl font-bold">위스키 도메인 관리</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          분류기 위키(제품·브랜드·증류소·병입자·캐스크·별칭·분류노트)를
          조회/교정합니다. 검수 큐와 별개로 위키 자체를 정리하는 도구입니다.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => switchTab(item.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === item.key
                ? "border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab />}
      {tab === "brands" && <BrandsTab />}
      {tab === "distilleries" && <DistilleriesTab />}
      {tab === "bottlers" && <BottlersTab />}
      {tab === "casks" && <CasksTab />}
      {tab === "aliases" && <AliasesTab />}
      {tab === "notes" && <NotesTab />}
    </div>
  );
}
