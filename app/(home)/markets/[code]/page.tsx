"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { MarketPageView } from "../../../components/MarketView";

/**
 * Real Next.js wiring only: reads the live router/search params and the encoded market-code path
 * segment, then feeds the pure, `next/navigation`-free `MarketPageView` (kept in its own module so
 * it can be unit-tested without a router context).
 */
function MarketPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ code: string }>();
  const marketCode = params.code;
  const rawSearch = searchParams.toString();

  const onSearchChange = useCallback(
    (search: string, mode: "push" | "replace") => {
      const url = search ? `${pathname}?${search}` : pathname;
      if (mode === "replace") router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router],
  );

  return (
    <MarketPageView
      marketCode={marketCode}
      rawSearch={rawSearch}
      onSearchChange={onSearchChange}
      initialSearchInput={searchParams.get("search") ?? ""}
    />
  );
}

export default function MarketProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="py-20 text-center text-gray-500 dark:text-gray-400">
            상품을 불러오는 중…
          </div>
        </main>
      }
    >
      <MarketPageContent />
    </Suspense>
  );
}
