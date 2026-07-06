"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BRAND_KINDS,
  clearBrandLabel,
  deleteBrand,
  listBottlers,
  listBrandLabels,
  listBrands,
  listDistilleries,
  renameBrandLabel,
  saveBrand,
  type Bottler,
  type Brand,
  type BrandInput,
  type BrandLabel,
  type Distillery,
} from "../../lib/adminWhisky";
import {
  clean,
  DataTable,
  entityOptionLabel,
  ErrorBanner,
  FormButtons,
  inputClass,
  Metric,
  Pager,
  RowActions,
  SuccessBanner,
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

interface FormState {
  canonical_name: string;
  korean_name: string | null;
  kind: string;
  distillery_id: string;
  bottler_id: string;
  peated: "" | "true" | "false";
}

const emptyForm: FormState = {
  canonical_name: "",
  korean_name: null,
  kind: "distillery_line",
  distillery_id: "",
  bottler_id: "",
  peated: "",
};

function kindLabel(kind: string): string {
  return BRAND_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export default function BrandsTab() {
  const [rows, setRows] = useState<Brand[]>([]);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottlers, setBottlers] = useState<Bottler[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // 레거시 라벨 섹션 상태.
  const [labels, setLabels] = useState<BrandLabel[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(true);
  const [labelSearch, setLabelSearch] = useState("");
  const [labelOffset, setLabelOffset] = useState(0);

  // 연결 셀렉트용 증류소/병입자 — 탭 진입 시 1회 로드.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listDistilleries({ limit: 500 }, controller.signal),
      listBottlers({ limit: 500 }, controller.signal),
    ])
      .then(([d, b]) => {
        setDistilleries(d);
        setBottlers(b);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "연결 목록 로드 실패");
      });
    return () => controller.abort();
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listBrands(
        {
          search: search.trim() || undefined,
          kind: kindFilter || undefined,
          limit: LIMIT,
          offset,
        },
        signal,
      )
        .then((data) => {
          setRows(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setLoading(false);
        });
    },
    [search, kindFilter, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadLabels = useCallback(
    (signal?: AbortSignal) => {
      setLabelsLoading(true);
      listBrandLabels(
        {
          search: labelSearch.trim() || undefined,
          limit: LIMIT,
          offset: labelOffset,
        },
        signal,
      )
        .then((data) => {
          setLabels(data);
          setLabelsLoading(false);
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "라벨 목록 로드 실패");
          setLabelsLoading(false);
        });
    },
    [labelSearch, labelOffset],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadLabels(controller.signal);
    return () => controller.abort();
  }, [loadLabels]);

  // kind 페어링(서버 422 강제)을 폼에서 선반영: 반대쪽 연결·distillery_line 전용 peated 초기화.
  function switchKind(kind: string) {
    setForm((f) => ({
      ...f,
      kind,
      distillery_id: kind === "distillery_line" ? f.distillery_id : "",
      bottler_id: kind === "bottler_range" ? f.bottler_id : "",
      peated: kind === "distillery_line" ? f.peated : "",
    }));
  }

  async function submit() {
    setSaving(true);
    setErrorMsg("");
    setOkMsg("");
    try {
      const payload: BrandInput = {
        canonical_name: form.canonical_name,
        korean_name: form.korean_name,
        kind: form.kind,
        distillery_id: form.distillery_id ? Number(form.distillery_id) : null,
        bottler_id: form.bottler_id ? Number(form.bottler_id) : null,
        peated: form.peated === "" ? null : form.peated === "true",
      };
      await saveBrand(payload, editing?.id);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: Brand) {
    if (
      !window.confirm(
        `브랜드 "${row.canonical_name}" 삭제?\n연결된 상품 ${row.product_count}건은 삭제되지 않고 링크만 끊깁니다(SET NULL).`,
      )
    )
      return;
    deleteBrand(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  function renameLabel(label: BrandLabel) {
    const next = window.prompt(
      `"${label.name}" 라벨을 일괄 개명합니다 (상품 ${label.product_count}건). 새 이름:`,
      label.name,
    );
    if (!next?.trim() || next.trim() === label.name) return;
    renameBrandLabel(label.name, next.trim())
      .then((out) => {
        setOkMsg(`라벨 개명 완료 — 상품 ${out.products_updated}건 갱신`);
        loadLabels();
      })
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "개명 실패"),
      );
  }

  function clearLabel(label: BrandLabel) {
    if (
      !window.confirm(
        `"${label.name}" 라벨을 비울까요?\n상품 ${label.product_count}건의 brand 문자열이 일괄 NULL 처리됩니다.`,
      )
    )
      return;
    clearBrandLabel(label.name)
      .then((out) => {
        setOkMsg(`라벨 비우기 완료 — 상품 ${out.products_updated}건 갱신`);
        loadLabels();
      })
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "비우기 실패"),
      );
  }

  /** 레거시 라벨 → 브랜드 엔티티 승격 시작: 폼에 라벨명 프리필. */
  function promoteLabel(label: BrandLabel) {
    setEditing(null);
    setForm({ ...emptyForm, canonical_name: label.name });
    setOkMsg(
      `"${label.name}" 승격 절차: ① 아래 폼에서 브랜드 생성 → ② 제품 탭에서 해당 상품들의 브랜드 연결 → ③ 여기서 라벨 비우기.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isLine = form.kind === "distillery_line";

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="브랜드 검색"
          className="w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <select
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">종류 전체</option>
          {BRAND_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => { setOffset(0); load(); }} className={actionBtn.neutral}>
          조회
        </button>
      </div>

      <ErrorBanner message={errorMsg} />
      <SuccessBanner message={okMsg} />

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="self-start rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h3 className="mb-3 font-semibold">
            {editing ? `브랜드 수정 #${editing.id}` : "브랜드 추가"}
          </h3>
          <div className="space-y-3">
            <input
              required
              value={form.canonical_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, canonical_name: e.target.value }))
              }
              placeholder="Canonical name"
              className={inputClass}
            />
            <input
              value={form.korean_name ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, korean_name: clean(e.target.value) }))
              }
              placeholder="한글명"
              className={inputClass}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">종류 (kind)</span>
              <select
                value={form.kind}
                onChange={(e) => switchKind(e.target.value)}
                className={inputClass}
              >
                {BRAND_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label} ({k.value})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">
                증류소 {isLine ? "(필수)" : "(증류소 라인 전용)"}
              </span>
              <select
                required={isLine}
                disabled={!isLine}
                value={form.distillery_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, distillery_id: e.target.value }))
                }
                className={`${inputClass} disabled:opacity-40`}
              >
                <option value="">선택</option>
                {distilleries.map((row) => (
                  <option key={row.id} value={row.id}>
                    {entityOptionLabel(row)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">
                병입자 {!isLine ? "(필수)" : "(병입자 레인지 전용)"}
              </span>
              <select
                required={!isLine}
                disabled={isLine}
                value={form.bottler_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bottler_id: e.target.value }))
                }
                className={`${inputClass} disabled:opacity-40`}
              >
                <option value="">선택</option>
                {bottlers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {entityOptionLabel(row)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">
                피트 (증류소 라인 전용)
              </span>
              <select
                disabled={!isLine}
                value={form.peated}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    peated: e.target.value as FormState["peated"],
                  }))
                }
                className={`${inputClass} disabled:opacity-40`}
              >
                <option value="">미상</option>
                <option value="true">피트</option>
                <option value="false">논피트</option>
              </select>
            </label>
            <FormButtons
              saving={saving}
              onCancel={
                editing
                  ? () => {
                      setEditing(null);
                      setForm(emptyForm);
                    }
                  : undefined
              }
            />
          </div>
        </form>

        <div>
          <DataTable loading={loading} empty={rows.length === 0}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.canonical_name}</div>
                  <div className="text-xs text-gray-500">{row.korean_name ?? "-"}</div>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>{kindLabel(row.kind)}</div>
                  <div className="text-xs text-gray-400">
                    {row.distillery_name ?? row.bottler_name ?? "-"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.peated === true && <Metric label="피트" value="" />}
                    {row.peated === false && <Metric label="논피트" value="" />}
                    <Metric label="상품" value={row.product_count} />
                    <Metric label="별칭" value={row.alias_count} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditing(row);
                      setForm({
                        canonical_name: row.canonical_name,
                        korean_name: row.korean_name,
                        kind: row.kind,
                        distillery_id: row.distillery_id
                          ? String(row.distillery_id)
                          : "",
                        bottler_id: row.bottler_id ? String(row.bottler_id) : "",
                        peated:
                          row.peated === null ? "" : row.peated ? "true" : "false",
                      });
                    }}
                    onDelete={() => remove(row)}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager offset={offset} limit={LIMIT} count={rows.length} onMove={setOffset} />
        </div>
      </section>

      <section className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h3 className="font-semibold">레거시 브랜드 라벨 정리</h3>
        <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
          products.brand 자유 문자열(상품 수 내림차순)입니다. 개명은 일괄
          치환(대상이 이미 있으면 409), 비우기는 해당 라벨 전체 NULL 처리.
          &quot;승격&quot;은 라벨명을 위 브랜드 폼에 프리필합니다.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            placeholder="라벨 검색"
            className="w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            onClick={() => {
              setLabelOffset(0);
              loadLabels();
            }}
            className={actionBtn.neutral}
          >
            조회
          </button>
        </div>
        <DataTable loading={labelsLoading} empty={labels.length === 0}>
          {labels.map((label) => (
            <tr key={label.name} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2 font-medium">{label.name}</td>
              <td className="px-3 py-2">
                <Metric label="상품" value={label.product_count} />
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    className={actionBtn.accent}
                    onClick={() => promoteLabel(label)}
                  >
                    브랜드로 승격
                  </button>
                  <button
                    type="button"
                    className={actionBtn.edit}
                    onClick={() => renameLabel(label)}
                  >
                    일괄 개명
                  </button>
                  <button
                    type="button"
                    className={actionBtn.danger}
                    onClick={() => clearLabel(label)}
                  >
                    비우기
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pager
          offset={labelOffset}
          limit={LIMIT}
          count={labels.length}
          onMove={setLabelOffset}
        />
      </section>
    </div>
  );
}
