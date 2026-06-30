"use client";

import { usePathname } from "next/navigation";
import { ExchangeRateMini } from "../components/ExchangeRateMini";
import { TopNav } from "../components/TopNav";

export function HomeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showExchangeMini = pathname !== "/" && pathname !== "/exchange-rates";

  return (
    <div className="relative min-h-screen">
      <TopNav />

      {children}

      {showExchangeMini && (
        <div className="fixed bottom-4 left-4 z-10 hidden sm:block">
          <ExchangeRateMini />
        </div>
      )}
    </div>
  );
}
