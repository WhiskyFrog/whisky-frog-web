"use client";

import { useState } from "react";

/**
 * 상품 썸네일 — 후보 URL을 순서대로 시도하고(무카와처럼 확장자를 유도한 경우
 * jpg→png 폴백), 전부 실패하거나 후보가 없으면 플레이스홀더를 그린다.
 */
export function ProductThumb({
  srcs,
  alt,
  className,
}: {
  srcs: string[];
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(0);
  const src = srcs[failed];
  const box = `flex shrink-0 items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 ${className ?? ""}`;

  if (!src) {
    return (
      <div className={box} aria-hidden>
        <svg
          className="h-1/2 w-1/2 text-gray-300 dark:text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div className={box}>
      {/* 외부 마켓 호스트 이미지 — next/image 도메인 화이트리스트 회피 위해 일반 img. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed((n) => n + 1)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
