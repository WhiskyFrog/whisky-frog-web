"use client";

// /admin/whisky 탭 공통 UI 조각.

import { actionBtn } from "../../components/actionButton";

export const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950";

/** 빈 문자열 → null (폼 입력 정규화). */
export function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

/** 숫자 입력 → number | null (빈/비정상 입력은 null). */
export function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 통제어휘 옵션 라벨 — 한글명 있으면 병기. */
export function vocabLabel(row: { value: string; korean: string | null }) {
  return row.korean ? `${row.korean} (${row.value})` : row.value;
}

/** 엔티티 옵션 라벨 — 한글명 있으면 병기. */
export function entityOptionLabel(row: {
  canonical_name: string;
  korean_name?: string | null;
}): string {
  return row.korean_name
    ? `${row.canonical_name} / ${row.korean_name}`
    : row.canonical_name;
}

export function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {label} {value}
    </span>
  );
}

/** 409/422 detail 등 서버 오류 그대로 노출. */
export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
      {message}
    </div>
  );
}

export function DataTable({
  loading,
  empty,
  head,
  children,
}: {
  loading: boolean;
  empty: boolean;
  head?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-gray-200 px-4 py-16 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
        불러오는 중
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-md border border-gray-200 px-4 py-16 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {head && (
          <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            {head}
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  deleteLabel = "삭제",
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-1.5">
      {onEdit && (
        <button type="button" className={actionBtn.edit} onClick={onEdit}>
          수정
        </button>
      )}
      {onDelete && (
        <button type="button" className={actionBtn.danger} onClick={onDelete}>
          {deleteLabel}
        </button>
      )}
    </div>
  );
}

/** offset 페이지네이션 — rows.length < limit 이면 다음 페이지 없음으로 간주. */
export function Pager({
  offset,
  limit,
  count,
  onMove,
}: {
  offset: number;
  limit: number;
  count: number;
  onMove: (nextOffset: number) => void;
}) {
  if (offset === 0 && count < limit) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-500 dark:text-gray-400">
      <button
        type="button"
        disabled={offset === 0}
        onClick={() => onMove(Math.max(0, offset - limit))}
        className={actionBtn.neutral}
      >
        이전
      </button>
      <span>
        {offset + 1}–{offset + count}
      </span>
      <button
        type="button"
        disabled={count < limit}
        onClick={() => onMove(offset + limit)}
        className={actionBtn.neutral}
      >
        다음
      </button>
    </div>
  );
}

/** 폼 저장/취소 버튼 묶음. */
export function FormButtons({
  saving,
  onCancel,
}: {
  saving: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button disabled={saving} className={actionBtn.run}>
        {saving ? "저장 중" : "저장"}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className={actionBtn.neutral}>
          취소
        </button>
      )}
    </div>
  );
}

export { actionBtn };
