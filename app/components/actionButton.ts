// 그리드(테이블) 행 액션 버튼 공통 스타일.
// 테두리 + 옅은 배경으로 버튼 인지성을 높인다. 용도별 색상 변형.

const baseActionBtn =
  "rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";

/** 행 액션 버튼 클래스 변형. */
export const actionBtn = {
  /** 중립/보조 (예: 상품 URL) */
  neutral: `${baseActionBtn} border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700`,
  /** 수정 등 */
  edit: `${baseActionBtn} border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50`,
  /** 실행/수집 등 긍정 동작 */
  run: `${baseActionBtn} border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/50`,
  /** 보조 실행(예: 상세 파싱 stage-2) — 수집(run)과 구분되는 강조색 */
  accent: `${baseActionBtn} border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50`,
  /** 종료 등 주의 */
  warn: `${baseActionBtn} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50`,
  /** 삭제/강제 종료 등 위험 */
  danger: `${baseActionBtn} border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50`,
};
