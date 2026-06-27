"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { actionBtn } from "../../components/actionButton";
import {
  listReviews,
  resolveReview,
  type ConsensusEntry,
  type ProductCaskAttribute,
  type ReviewListItem,
  type ReviewResolveIn,
} from "../../lib/review";

type Status = "loading" | "error" | "ready";
const LIMIT = 50;

const inputCls =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

/** 일치도 0~1 → "82%" (null이면 "–"). */
function agreementPct(a: number | null): string {
  if (a == null || Number.isNaN(a)) return "–";
  return `${Math.round(a * 100)}%`;
}

/** 임의 값을 input value용 문자열로(스칼라만; 객체/배열은 빈 문자열). */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** consensus[field].value 채택값(없으면 undefined). */
function adopted(
  consensus: Record<string, ConsensusEntry> | null,
  field: string,
): unknown {
  const e = consensus?.[field];
  return e && typeof e === "object" ? e.value : undefined;
}

/** consensus 메타에 동봉된 korean 속성 객체 추출(위치 불확실 → 방어적). */
function adoptedKorean(
  consensus: Record<string, ConsensusEntry> | null,
): Record<string, unknown> {
  const k = consensus?.korean as unknown;
  if (k && typeof k === "object" && "value" in (k as object)) {
    const v = (k as ConsensusEntry).value;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  }
  if (k && typeof k === "object") return k as Record<string, unknown>;
  return {};
}

// ── 폼 드래프트(문자열 기반; 제출 시 변환) ───────────────────
interface Draft {
  distillery: string;
  brand: string;
  bottler: string;
  cask_type: string;
  age_years: string;
  vintage_year: string;
  edition: string;
  spirit_type: string;
  peated: "" | "true" | "false";
  k_distillery: string;
  k_brand: string;
  k_bottler: string;
  k_cask_type: string;
  k_edition: string;
  k_spirit_type: string;
}

interface CaskRow {
  cask_type: string;
  role: string; // maturation | finish
  finish_months: string;
}

/** consensus 채택값으로 폼 초기 드래프트 구성. */
function buildDraft(item: ReviewListItem): Draft {
  const c = item.consensus;
  const k = adoptedKorean(c);
  return {
    distillery: asText(adopted(c, "distillery")),
    brand: asText(adopted(c, "brand")),
    bottler: asText(adopted(c, "bottler")),
    cask_type: asText(adopted(c, "cask_type")),
    age_years: asText(adopted(c, "age_years")),
    vintage_year: asText(adopted(c, "vintage_year")),
    edition: asText(adopted(c, "edition")),
    spirit_type: asText(adopted(c, "spirit_type")) || "whisky",
    peated:
      adopted(c, "peated") === true
        ? "true"
        : adopted(c, "peated") === false
          ? "false"
          : "",
    k_distillery: asText(k.distillery),
    k_brand: asText(k.brand),
    k_bottler: asText(k.bottler),
    k_cask_type: asText(k.cask_type),
    k_edition: asText(k.edition),
    k_spirit_type: asText(k.spirit_type),
  };
}

/** consensus의 product_casks 채택값을 폼 행으로(없으면 빈 배열). */
function buildCasks(item: ReviewListItem): CaskRow[] {
  const v = adopted(item.consensus, "product_casks");
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      cask_type: asText(r.cask_type),
      role: asText(r.role) || "maturation",
      finish_months: asText(r.finish_months),
    }));
}

/** 드래프트 → 요청 본문. 빈 문자열은 null, 숫자는 파싱. */
function toResolveIn(d: Draft, casks: CaskRow[]): ReviewResolveIn {
  const s = (v: string): string | null => (v.trim() ? v.trim() : null);
  const n = (v: string): number | null => {
    const x = parseInt(v, 10);
    return Number.isFinite(x) ? x : null;
  };
  const korean = {
    distillery: s(d.k_distillery),
    bottler: s(d.k_bottler),
    brand: s(d.k_brand),
    cask_type: s(d.k_cask_type),
    edition: s(d.k_edition),
    spirit_type: s(d.k_spirit_type),
  };
  const hasKorean = Object.values(korean).some((v) => v != null);

  const product_casks: ProductCaskAttribute[] = casks
    .filter((c) => c.role.trim())
    .map((c, i) => ({
      cask_type: s(c.cask_type),
      role: c.role.trim(),
      seq: i,
      finish_months: n(c.finish_months),
    }));

  return {
    distillery: s(d.distillery),
    brand: s(d.brand),
    bottler: s(d.bottler),
    cask_type: s(d.cask_type),
    age_years: n(d.age_years),
    vintage_year: n(d.vintage_year),
    edition: s(d.edition),
    spirit_type: d.spirit_type.trim() || "whisky",
    peated: d.peated === "" ? null : d.peated === "true",
    ...(product_casks.length ? { product_casks } : {}),
    ...(hasKorean ? { korean } : {}),
  };
}

export default function ReviewsAdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ReviewListItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // 토스트(markets 페이지 패턴과 동일).
  const [toast, setToast] = useState<{ kind: "info" | "error"; msg: string } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, kind: "info" | "error" = "info") => {
    setToast({ kind, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback((signal?: AbortSignal) => {
    setStatus("loading");
    listReviews(LIMIT, signal)
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // 확정 완료된 항목을 목록에서 제거.
  const handleResolved = useCallback(
    (productUrlId: number, summary: string) => {
      setRows((rs) => rs.filter((r) => r.product_url_id !== productUrlId));
      showToast(summary, "info");
    },
    [showToast],
  );

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">검토</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AI 앙상블이 자동으로 결론내지 못한 항목입니다. 근거를 확인하고 속성을
            확정해 저장하세요. 확정 표기는 위키(alias)에 축적돼 재크롤 시 재현됩니다.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          ↻ 새로고침
        </button>
      </div>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          불러오는 중…
        </div>
      )}
      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">
            검토 목록을 불러오지 못했습니다.
          </p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errorMsg}</p>
          <button
            onClick={() => load()}
            className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            다시 시도
          </button>
        </div>
      )}
      {status === "ready" && rows.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            검토 대기 항목이 없습니다.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AI가 자동 매칭하지 못한 항목이 생기면 여기에 표시됩니다.
          </p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <>
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
            {rows.length}건 대기 · 우선순위 순
          </p>
          <ul className="space-y-3">
            {rows.map((item) => (
              <ReviewCard
                key={item.product_url_id}
                item={item}
                onResolved={handleResolved}
                onError={(m) => showToast(m, "error")}
              />
            ))}
          </ul>
        </>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-md px-4 py-3 text-sm shadow-lg ${
            toast.kind === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── 검토 카드 ────────────────────────────────────────────
function ReviewCard({
  item,
  onResolved,
  onError,
}: {
  item: ReviewListItem;
  onResolved: (productUrlId: number, summary: string) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(item));
  const [casks, setCasks] = useState<CaskRow[]>(() => buildCasks(item));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      const out = await resolveReview(item.product_url_id, toResolveIn(draft, casks));
      const label = draft.distillery || item.name || `#${item.product_url_id}`;
      onResolved(
        item.product_url_id,
        `확정 저장됨 · ${label} (상품 ${out.products_inserted}, 매칭 ${out.urls_matched}, 가격 ${out.prices_inserted}, alias ${out.aliases_inserted})`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const market = item.market_code || item.market_domain || `market#${item.market_id}`;

  return (
    <li className="rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* 요약 헤더 */}
      <div className="flex items-start gap-3 p-3">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {item.name || (
              <span className="text-gray-400">(이름 없음 #{item.product_url_id})</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
              {market}
            </span>
            <span>일치도 {agreementPct(item.agreement)}</span>
            {item.method && <span>방식 {item.method}</span>}
            {item.norm_abv && <span>{item.norm_abv}% abv</span>}
            {item.norm_volume_ml != null && <span>{item.norm_volume_ml}ml</span>}
            {item.needs_review && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                충돌
              </span>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                원본 ↗
              </a>
            )}
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={open ? actionBtn.neutral : actionBtn.edit}
        >
          {open ? "접기" : "검토하기"}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          <Evidence item={item} />

          {/* 확정 폼 */}
          <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            확정 속성
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
            <Field label="증류소(distillery)">
              <input
                className={inputCls}
                value={draft.distillery}
                onChange={(e) => set("distillery", e.target.value)}
              />
            </Field>
            <Field label="브랜드(brand)">
              <input
                className={inputCls}
                value={draft.brand}
                onChange={(e) => set("brand", e.target.value)}
              />
            </Field>
            <Field label="병입자(bottler)">
              <input
                className={inputCls}
                value={draft.bottler}
                onChange={(e) => set("bottler", e.target.value)}
              />
            </Field>
            <Field label="캐스크(cask_type)">
              <input
                className={inputCls}
                value={draft.cask_type}
                onChange={(e) => set("cask_type", e.target.value)}
              />
            </Field>
            <Field label="숙성연수(age_years)">
              <input
                type="number"
                className={inputCls}
                value={draft.age_years}
                onChange={(e) => set("age_years", e.target.value)}
              />
            </Field>
            <Field label="빈티지(vintage_year)">
              <input
                type="number"
                className={inputCls}
                value={draft.vintage_year}
                onChange={(e) => set("vintage_year", e.target.value)}
              />
            </Field>
            <Field label="에디션(edition)">
              <input
                className={inputCls}
                value={draft.edition}
                onChange={(e) => set("edition", e.target.value)}
              />
            </Field>
            <Field label="주종(spirit_type)">
              <input
                className={inputCls}
                value={draft.spirit_type}
                onChange={(e) => set("spirit_type", e.target.value)}
              />
            </Field>
            <Field label="피트(peated)">
              <select
                className={inputCls}
                value={draft.peated}
                onChange={(e) => set("peated", e.target.value as Draft["peated"])}
              >
                <option value="">모름</option>
                <option value="true">예</option>
                <option value="false">아니오</option>
              </select>
            </Field>
          </div>

          {/* 캐스크 구성 */}
          <CaskEditor casks={casks} setCasks={setCasks} />

          {/* 한국어 표기 */}
          <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            한국어 표기{" "}
            <span className="font-normal text-gray-400">(선택)</span>
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
            <Field label="증류소(KR)">
              <input
                className={inputCls}
                value={draft.k_distillery}
                onChange={(e) => set("k_distillery", e.target.value)}
              />
            </Field>
            <Field label="브랜드(KR)">
              <input
                className={inputCls}
                value={draft.k_brand}
                onChange={(e) => set("k_brand", e.target.value)}
              />
            </Field>
            <Field label="병입자(KR)">
              <input
                className={inputCls}
                value={draft.k_bottler}
                onChange={(e) => set("k_bottler", e.target.value)}
              />
            </Field>
            <Field label="캐스크(KR)">
              <input
                className={inputCls}
                value={draft.k_cask_type}
                onChange={(e) => set("k_cask_type", e.target.value)}
              />
            </Field>
            <Field label="에디션(KR)">
              <input
                className={inputCls}
                value={draft.k_edition}
                onChange={(e) => set("k_edition", e.target.value)}
              />
            </Field>
            <Field label="주종(KR)">
              <input
                className={inputCls}
                value={draft.k_spirit_type}
                onChange={(e) => set("k_spirit_type", e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setDraft(buildDraft(item));
                setCasks(buildCasks(item));
              }}
              disabled={saving}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              AI 제안값으로 초기화
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              {saving ? "저장 중…" : "확정 저장"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── 근거 패널("왜 애매한가") ─────────────────────────────
const EVIDENCE_FIELDS = [
  "distillery",
  "brand",
  "bottler",
  "cask_type",
  "age_years",
  "edition",
  "spirit_type",
  "vintage_year",
  "peated",
];

function Evidence({ item }: { item: ReviewListItem }) {
  const models = item.model_outputs ?? [];
  const consensus = item.consensus ?? {};

  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-950/40">
      <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        왜 애매한가
      </h4>

      {/* 모델별 답 */}
      {models.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-2 py-1 font-medium">모델</th>
                {EVIDENCE_FIELDS.map((f) => (
                  <th key={f} className="px-2 py-1 font-medium">
                    {f}
                  </th>
                ))}
                <th className="px-2 py-1 font-medium">신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="px-2 py-1 font-medium text-gray-700 dark:text-gray-300">
                    {m.model ?? `#${i}`}
                  </td>
                  {EVIDENCE_FIELDS.map((f) => (
                    <td
                      key={f}
                      className="px-2 py-1 text-gray-600 dark:text-gray-400"
                    >
                      {asText(m.output?.[f]) || "–"}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                    {m.confidence != null ? agreementPct(m.confidence) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-400">모델별 원답 데이터가 없습니다.</p>
      )}

      {/* 속성별 합의 */}
      {Object.keys(consensus).length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            속성별 합의(채택값 · 방식)
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {Object.entries(consensus)
              .filter(([f]) => f !== "korean")
              .map(([f, e]) => (
                <li key={f} className="text-gray-600 dark:text-gray-400">
                  <span className="text-gray-400">{f}:</span>{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {asText(e?.value) || "–"}
                  </span>
                  {e?.method && (
                    <span className="ml-1 text-gray-400">({e.method})</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          원본 JSON 보기
        </summary>
        <pre className="mt-1 max-h-60 overflow-auto rounded bg-gray-100 p-2 text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {JSON.stringify(
            { consensus: item.consensus, model_outputs: item.model_outputs },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}

// ── 캐스크 편집기 ────────────────────────────────────────
function CaskEditor({
  casks,
  setCasks,
}: {
  casks: CaskRow[];
  setCasks: React.Dispatch<React.SetStateAction<CaskRow[]>>;
}) {
  const update = (i: number, patch: Partial<CaskRow>) =>
    setCasks((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) =>
    setCasks((cs) => cs.filter((_, idx) => idx !== i));
  const add = () =>
    setCasks((cs) => [
      ...cs,
      { cask_type: "", role: "maturation", finish_months: "" },
    ]);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          캐스크 구성{" "}
          <span className="font-normal text-gray-400">(선택, 순서대로)</span>
        </h4>
        <button
          onClick={add}
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          + 캐스크 추가
        </button>
      </div>
      {casks.length === 0 ? (
        <p className="text-xs text-gray-400">없음</p>
      ) : (
        <ul className="space-y-2">
          {casks.map((c, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <span className="pb-1.5 text-xs text-gray-400">#{i}</span>
              <Field label="cask_type">
                <input
                  className={inputCls}
                  value={c.cask_type}
                  onChange={(e) => update(i, { cask_type: e.target.value })}
                />
              </Field>
              <Field label="role">
                <select
                  className={inputCls}
                  value={c.role}
                  onChange={(e) => update(i, { role: e.target.value })}
                >
                  <option value="maturation">maturation</option>
                  <option value="finish">finish</option>
                </select>
              </Field>
              <Field label="finish_months">
                <input
                  type="number"
                  className={inputCls}
                  value={c.finish_months}
                  onChange={(e) => update(i, { finish_months: e.target.value })}
                />
              </Field>
              <button
                onClick={() => remove(i)}
                className="pb-1 text-xs text-red-500 hover:underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
