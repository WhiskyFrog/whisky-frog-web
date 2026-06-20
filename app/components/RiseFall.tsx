/**
 * 등락 표시 — 방향은 rate_krw vs prev_rate_krw 비교로 도출하고(rise_fall은 등락 '폭'),
 * 방향 화살표 + 색(상승=빨강, 하락=파랑, 한국 관례)에 폭("6.23")이 있으면 함께 표시.
 * prev 없음/같음/판별 불가 → "–".
 */
export function RiseFall({
  rate,
  prev,
  magnitude,
}: {
  rate: number | string;
  prev: number | string | null;
  magnitude: string | null;
}) {
  if (prev === null || prev === "") {
    return (
      <span className="text-gray-400 dark:text-gray-500" aria-label="변동 없음">
        –
      </span>
    );
  }
  const r = Number(rate);
  const p = Number(prev);
  if (Number.isNaN(r) || Number.isNaN(p) || r === p) {
    return (
      <span className="text-gray-400 dark:text-gray-500" aria-label="변동 없음">
        –
      </span>
    );
  }
  const up = r > p;
  const amount =
    magnitude && magnitude.trim() !== "" ? ` ${magnitude.trim()}` : "";
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${up ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
      aria-label={up ? "상승" : "하락"}
    >
      {up ? "↑" : "↓"}
      {amount}
    </span>
  );
}
