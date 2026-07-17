"use client";

import { useEffect, useState } from "react";
import { getProductPriceHistory, type PriceHistoryItem } from "../lib/priceHistory";
import { formatDateTime, formatLocalPrice } from "../lib/products";

const HISTORY_LIMIT = 30;

/**
 * 마켓 하나의 현지가 추이 — 의존성 없는 SVG 스파크라인.
 * 등락 색은 RiseFall과 같은 관례(상승=빨강, 하락=파랑, 한국식).
 */
function Sparkline({ items }: { items: PriceHistoryItem[] }) {
  // items는 최신순(desc)으로 오므로 그래프는 시간순(oldest→newest)으로 뒤집는다.
  const points = [...items].reverse();
  const values = points.map((p) => Number(p.local_price));
  const width = 148;
  const height = 32;
  const pad = 3;

  if (values.length < 2) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500">
        추이 데이터 부족
      </span>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const coords = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const first = values[0];
  const last = values[values.length - 1];
  const up = last > first;
  const down = last < first;
  const stroke = up
    ? "stroke-red-500"
    : down
      ? "stroke-blue-500"
      : "stroke-gray-400";
  const dot = up ? "fill-red-500" : down ? "fill-blue-500" : "fill-gray-400";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={`최근 ${values.length}개 가격 추이`}
    >
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        className={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === coords.length - 1 ? 2.2 : 0}
          className={dot}
        />
      ))}
    </svg>
  );
}

function groupByMarket(
  items: PriceHistoryItem[],
): Map<string, { marketName: string; rows: PriceHistoryItem[] }> {
  const groups = new Map<string, { marketName: string; rows: PriceHistoryItem[] }>();
  for (const item of items) {
    const existing = groups.get(item.market_code);
    if (existing) existing.rows.push(item);
    else groups.set(item.market_code, { marketName: item.market_name, rows: [item] });
  }
  return groups;
}

/** 마켓별 최신가 한 줄 — 스파크라인 + 최신 원가 + 최신 수집 시각. */
function MarketHistoryRow({
  marketCode,
  marketName,
  rows,
}: {
  marketCode: string;
  marketName: string;
  rows: PriceHistoryItem[];
}) {
  const latest = rows[0];
  return (
    <li className="flex items-center justify-between gap-3 rounded px-2 py-1.5 odd:bg-gray-50/60 dark:odd:bg-gray-900/40">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
          {marketName}
        </div>
        <div className="text-[11px] text-gray-400 dark:text-gray-500">
          {formatDateTime(latest.crawled_at)}
          {!latest.available && " · 품절"}
        </div>
      </div>
      <Sparkline items={rows} />
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {formatLocalPrice(latest.local_price, latest.currency)}
      </div>
    </li>
  );
}

/**
 * 카탈로그 카드 확장 섹션 — 상품의 마켓별 현지가 이력. 펼칠 때만 조회한다
 * (카드 50개마다 선조회하면 N+1 부담이라 지연 로딩, module-api.md 계약 참조).
 * local_price는 환율·세금 미적용 원가라 오퍼 카드의 직구가/환산가와는 별도 축이다.
 */
export function PriceHistorySection({ productId }: { productId: number }) {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [items, setItems] = useState<PriceHistoryItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    getProductPriceHistory(productId, { limit: HISTORY_LIMIT }, controller.signal)
      .then((data) => {
        setItems(data.items);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [productId]);

  if (status === "loading") {
    return (
      <div className="px-2 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
        가격 이력을 불러오는 중…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-2 py-3 text-center text-xs text-red-500 dark:text-red-400">
        가격 이력을 불러오지 못했습니다.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-2 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
        아직 수집된 가격 이력이 없습니다.
      </div>
    );
  }

  const groups = groupByMarket(items);

  return (
    <div>
      <ul className="space-y-0.5">
        {[...groups.entries()].map(([marketCode, { marketName, rows }]) => (
          <MarketHistoryRow
            key={marketCode}
            marketCode={marketCode}
            marketName={marketName}
            rows={rows}
          />
        ))}
      </ul>
      <p className="mt-1.5 px-2 text-[11px] text-gray-400 dark:text-gray-500">
        마켓 현지 통화 원가 기준(환율·세금·배송 미포함), 최근 {items.length}건.
      </p>
    </div>
  );
}
