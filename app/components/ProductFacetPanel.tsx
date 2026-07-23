"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FacetResponseV2 } from "../lib/api/facet-contract";
import type { FacetSelection, FacetValue, ProductQueryState } from "../lib/api/product-query";
import {
  buildFacetGroupViewModels,
  EMPTY_FACET_VIEW_STATE,
  forgetRetainedFacet,
  reconcileFacetViewState,
  valueKey,
  type FacetGroupViewModel,
  type FacetOptionViewModel,
  type FacetViewState,
  type RangeFacetGroupViewModel,
  type TermsFacetGroupViewModel,
} from "../lib/facet-view";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function selectionActiveCount(selection: ProductQueryState["facets"]): number {
  let total = 0;
  for (const value of Object.values(selection)) {
    if (value.kind === "terms") total += value.values.length;
    else total += (value.min !== null ? 1 : 0) + (value.max !== null ? 1 : 0);
  }
  return total;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
    >
      {count}
    </span>
  );
}

/** Contiguous runs of options sharing the same server-supplied dependency-parent chain. */
function groupOptionsByParents(options: readonly FacetOptionViewModel[]) {
  const buckets: {
    signature: string;
    parents: FacetOptionViewModel["parents"];
    options: FacetOptionViewModel[];
  }[] = [];
  for (const option of options) {
    const signature = option.parents?.map((p) => `${p.key}:${p.value}`).join("|") ?? "";
    const last = buckets.at(-1);
    if (last && last.signature === signature) {
      last.options.push(option);
    } else {
      buckets.push({ signature, parents: option.parents, options: [option] });
    }
  }
  return buckets;
}

function TermsSection({
  group,
  onChange,
}: {
  group: TermsFacetGroupViewModel;
  onChange: (next: FacetSelection | null) => void;
}) {
  const selectedCount = group.options.filter((o) => o.selected).length;
  const groupName = `facet-${group.key}`;
  const headingId = `${groupName}-label`;

  const setValue = (value: FacetValue, checked: boolean) => {
    if (group.selection_mode === "single") {
      onChange(checked ? { kind: "terms", values: [value] } : null);
      return;
    }
    const current = group.options.filter((o) => o.selected).map((o) => o.value);
    const vk = valueKey(value);
    const next = checked
      ? [...current.filter((v) => valueKey(v) !== vk), value]
      : current.filter((v) => valueKey(v) !== vk);
    onChange(next.length > 0 ? { kind: "terms", values: next } : null);
  };

  const clearValue = (value: FacetValue) => setValue(value, false);

  // Deliberately no aria-disabled here: an irrelevant group's controls are dimmed and
  // annotated but stay genuinely operable (users may pre-select a value the current result
  // set doesn't support yet), so marking the group aria-disabled would misreport that to
  // assistive tech and automation that honor ARIA semantics.
  return (
    <section
      role="group"
      aria-labelledby={headingId}
      className={!group.relevant ? "opacity-60" : undefined}
    >
      <div className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">
        <span id={headingId} className="flex items-center gap-1.5">
          {group.label}
          <CountBadge count={selectedCount} />
        </span>
        {selectedCount > 0 && group.selection_mode === "single" && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${group.label} 선택 해제`}
            className="text-[11px] font-normal text-gray-400 underline hover:text-gray-600"
          >
            지우기
          </button>
        )}
      </div>
      {!group.relevant && (
        <p className="pb-1 text-[11px] text-gray-400">현재 선택과 맞지 않는 항목입니다</p>
      )}
      <div className="space-y-1 pb-3">
        {groupOptionsByParents(group.options).map((bucket, index) => (
          <div key={`${bucket.signature}-${index}`}>
            {bucket.parents && bucket.parents.length > 0 && (
              <p className="truncate px-1.5 pt-1 text-[10px] uppercase tracking-wide text-gray-400">
                {bucket.parents.map((p) => p.label).join(" › ")}
              </p>
            )}
            {bucket.options.map((option) => {
              const noteId = option.retained ? `${groupName}-${valueKey(option.value)}-note` : undefined;
              return (
                <div
                  key={valueKey(option.value)}
                  className="flex items-center justify-between gap-3 rounded px-1.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <label className="flex min-w-0 cursor-pointer items-center gap-2">
                    <input
                      type={group.selection_mode === "single" ? "radio" : "checkbox"}
                      name={groupName}
                      checked={option.selected}
                      aria-describedby={noteId}
                      onChange={(e) => setValue(option.value, e.target.checked)}
                      className="h-3.5 w-3.5 shrink-0 accent-blue-600"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {option.retained && (
                      <span id={noteId} className="text-[10px] text-amber-600 dark:text-amber-400">
                        현재 결과에 없음
                      </span>
                    )}
                    {option.count !== null && (
                      <span aria-hidden="true" className="tabular-nums text-gray-400">
                        {option.count}
                      </span>
                    )}
                    {option.retained && (
                      <button
                        type="button"
                        onClick={() => clearValue(option.value)}
                        aria-label={`${option.label} 선택 해제`}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function RangeSection({
  group,
  onChange,
}: {
  group: RangeFacetGroupViewModel;
  onChange: (next: FacetSelection | null) => void;
}) {
  const hasSelection = group.selectedMin !== null || group.selectedMax !== null;
  const headingId = `facet-${group.key}-label`;

  const setBound = (side: "min" | "max", raw: string) => {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : trimmed;
    const min = side === "min" ? value : group.selectedMin;
    const max = side === "max" ? value : group.selectedMax;
    onChange(min !== null || max !== null ? { kind: "range", min, max } : null);
  };

  return (
    <section
      role="group"
      aria-labelledby={headingId}
      className={!group.relevant ? "opacity-60" : undefined}
    >
      <div className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">
        <span id={headingId} className="flex items-center gap-1.5">
          {group.label}
          <CountBadge count={(group.selectedMin !== null ? 1 : 0) + (group.selectedMax !== null ? 1 : 0)} />
        </span>
        {hasSelection && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${group.label} 선택 해제`}
            className="text-[11px] font-normal text-gray-400 underline hover:text-gray-600"
          >
            지우기
          </button>
        )}
      </div>
      {!group.relevant && (
        <p className="pb-1 text-[11px] text-gray-400">현재 선택과 맞지 않는 항목입니다</p>
      )}
      {group.retained && (
        <p className="pb-1 text-[11px] text-amber-600 dark:text-amber-400">현재 결과에 없음</p>
      )}
      <div className="grid grid-cols-2 gap-2 pb-3">
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${group.label} 최소${group.unit ? ` (${group.unit})` : ""}`}
          placeholder={group.bounds.min ?? ""}
          value={group.selectedMin ?? ""}
          onChange={(e) => setBound("min", e.target.value)}
          className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
        />
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${group.label} 최대${group.unit ? ` (${group.unit})` : ""}`}
          placeholder={group.bounds.max ?? ""}
          value={group.selectedMax ?? ""}
          onChange={(e) => setBound("max", e.target.value)}
          className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
        />
      </div>
    </section>
  );
}

export interface ProductFacetPanelProps {
  /** Structured v2 response for either scope. `null` while loading/not yet fetched. */
  response: FacetResponseV2 | null;
  /** Normalized selection, keyed by the server's stable group key. Source of truth for requests. */
  selection: ProductQueryState["facets"];
  /** A facet's control changed. `next === null` clears that facet entirely. */
  onSelectionChange: (key: string, next: FacetSelection | null) => void;
  /** Explicit reset clears every selection, including currently irrelevant ones. */
  onReset: () => void;
  /** Caller-owned scope copy, e.g. "142개 상품" vs "37개 오퍼". Never computed here. */
  resultSummary: string;
  triggerLabel?: string;
}

export function ProductFacetPanel({
  response,
  selection,
  onSelectionChange,
  onReset,
  resultSummary,
  triggerLabel = "필터",
}: ProductFacetPanelProps) {
  const [open, setOpen] = useState(false);
  const [viewState, setViewState] = useState<FacetViewState>(EMPTY_FACET_VIEW_STATE);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();

  // Reconciliation and the render-ready view models share one try/catch: contract
  // drift (an unhandled discriminator) must surface as the same safe error state
  // whether it's hit while folding a response into the cache or while rendering it,
  // never as an uncaught throw from an effect.
  const { groups, contractError, reconciledViewState } = useMemo(() => {
    if (!response) {
      return {
        groups: [] as FacetGroupViewModel[],
        contractError: null as string | null,
        reconciledViewState: viewState,
      };
    }
    try {
      const reconciled = reconcileFacetViewState(viewState, response.groups);
      return {
        groups: buildFacetGroupViewModels(response.groups, reconciled, selection),
        contractError: null,
        reconciledViewState: reconciled,
      };
    } catch (error) {
      return {
        groups: [] as FacetGroupViewModel[],
        contractError: error instanceof Error ? error.message : "알 수 없는 오류",
        reconciledViewState: viewState,
      };
    }
  }, [response, viewState, selection]);

  useEffect(() => {
    if (reconciledViewState !== viewState) setViewState(reconciledViewState);
  }, [reconciledViewState, viewState]);

  const activeCount = selectionActiveCount(selection);

  const handleChange = (key: string, next: FacetSelection | null) => {
    if (next === null) setViewState((prev) => forgetRetainedFacet(prev, key));
    onSelectionChange(key, next);
  };

  const handleReset = () => {
    setViewState(EMPTY_FACET_VIEW_STATE);
    onReset();
  };

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const initial = focusableElements(dialog)[0];
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableElements(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        <svg
          className="h-4 w-4 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path d="M4 5h16l-6.5 7.5V19l-3-1.5v-5L4 5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {triggerLabel}
        <CountBadge count={activeCount} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={open}
        aria-labelledby={headingId}
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] transform flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 dark:border-gray-800 dark:bg-gray-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <h2
              id={headingId}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {triggerLabel}
              <CountBadge count={activeCount} />
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">{resultSummary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="whitespace-nowrap rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="필터 닫기"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-300"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-1">
          {!response && (
            <div className="py-8 text-center text-xs text-gray-400">필터를 불러오는 중</div>
          )}

          {contractError && (
            <div
              role="alert"
              className="my-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              필터 데이터를 표시할 수 없습니다. 페이지를 새로고침해 주세요.
            </div>
          )}

          {response && !contractError && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {groups.map((group) =>
                group.kind === "terms" ? (
                  <TermsSection
                    key={group.key}
                    group={group}
                    onChange={(next) => handleChange(group.key, next)}
                  />
                ) : (
                  <RangeSection
                    key={group.key}
                    group={group}
                    onChange={(next) => handleChange(group.key, next)}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            결과 보기
          </button>
        </div>
      </div>
    </>
  );
}
