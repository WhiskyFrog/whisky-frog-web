"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createProduct,
  deleteProduct,
  listDistilleries,
  listProducts,
  SPIRIT_TYPE_OPTIONS,
  type Distillery,
  type ProductFacets,
  type ProductInput,
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
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

interface FormState {
  canonical_name: string;
  spirit_type: string;
  distillery_id: string;
  brand: string;
}

const emptyForm: FormState = {
  canonical_name: "",
  spirit_type: "whisky",
  distillery_id: "",
  brand: "",
};

function spiritLabel(value: string): string {
  return SPIRIT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function ProductsTab() {
  const [rows, setRows] = useState<ProductFacets[]>([]);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [spiritFilter, setSpiritFilter] = useState("");
  const [distilleryFilter, setDistilleryFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listDistilleries({ limit: 500 }, controller.signal)
      .then(setDistilleries)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "증류소 목록 로드 실패");
      });
    return () => controller.abort();
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listProducts(
        {
          search: search.trim() || undefined,
          spirit_type: spiritFilter || undefined,
          distillery_id: distilleryFilter ? Number(distilleryFilter) : undefined,
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
    [search, spiritFilter, distilleryFilter, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function submit() {
    setSaving(true);
    setErrorMsg("");
    try {
      const payload: ProductInput = {
        canonical_name: form.canonical_name,
        spirit_type: form.spirit_type,
        distillery_id: form.distillery_id ? Number(form.distillery_id) : null,
        brand: clean(form.brand),
      };
      await createProduct(payload);
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: ProductFacets) {
    if (
      !window.confirm(
        `제품 "${row.canonical_name}" 삭제?\n마켓 URL 매칭은 끊고 보존(SET NULL), 캐스크 구성·별칭은 함께 삭제됩니다.`,
      )
    )
      return;
    deleteProduct(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        팩싯(주종·숙성·빈티지·에디션·피트·브랜드 연결)과 캐스크 구성은 행의
        &quot;보정&quot;에서 수정합니다. hs_code는 주종에서 서버가 파생합니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제품명 검색"
          className="w-64 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <select
          value={spiritFilter}
          onChange={(e) => {
            setSpiritFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">주종 전체</option>
          {SPIRIT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={distilleryFilter}
          onChange={(e) => {
            setDistilleryFilter(e.target.value);
            setOffset(0);
          }}
          className="max-w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">증류소 전체</option>
          {distilleries.map((row) => (
            <option key={row.id} value={row.id}>
              {entityOptionLabel(row)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => { setOffset(0); load(); }} className={actionBtn.neutral}>
          조회
        </button>
      </div>

      <ErrorBanner message={errorMsg} />

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="self-start rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h3 className="mb-3 font-semibold">제품 추가</h3>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            생성 후 &quot;보정&quot;에서 나머지 팩싯·캐스크 구성을 채웁니다.
          </p>
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
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">주종</span>
              <select
                value={form.spirit_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, spirit_type: e.target.value }))
                }
                className={inputClass}
              >
                {SPIRIT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.value})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">증류소 (선택)</span>
              <select
                value={form.distillery_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, distillery_id: e.target.value }))
                }
                className={inputClass}
              >
                <option value="">선택 안 함</option>
                {distilleries.map((row) => (
                  <option key={row.id} value={row.id}>
                    {entityOptionLabel(row)}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              placeholder="브랜드 문자열 (선택)"
              className={inputClass}
            />
            <FormButtons saving={saving} />
          </div>
        </form>

        <div>
          <DataTable
            loading={loading}
            empty={rows.length === 0}
            head={
              <tr>
                <th className="px-3 py-2">제품</th>
                <th className="px-3 py-2">연결</th>
                <th className="px-3 py-2">팩싯</th>
                <th className="px-3 py-2" />
              </tr>
            }
          >
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    <span className="mr-1.5 text-xs text-gray-400">#{row.id}</span>
                    {row.canonical_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {spiritLabel(row.spirit_type)}
                    {row.abv !== null && ` · ${row.abv}%`}
                    {row.volume_ml !== null && ` · ${row.volume_ml}ml`}
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>{row.distillery_name ?? row.bottler_name ?? "-"}</div>
                  <div className="text-xs text-gray-400">
                    {row.brand_line_name ??
                      row.bottler_range_name ??
                      row.brand ??
                      "-"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.age_years !== null && (
                      <Metric label="숙성" value={`${row.age_years}년`} />
                    )}
                    {row.vintage_year !== null && (
                      <Metric label="빈티지" value={row.vintage_year} />
                    )}
                    {row.edition && <Metric label="에디션" value={row.edition} />}
                    {row.peated === true && <Metric label="피트" value="" />}
                    {row.cask_type_name && (
                      <Metric label="캐스크" value={row.cask_type_name} />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/admin/products/${row.id}/taxonomy`}
                      className={actionBtn.edit}
                    >
                      보정
                    </Link>
                    <button
                      type="button"
                      className={actionBtn.danger}
                      onClick={() => remove(row)}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager offset={offset} limit={LIMIT} count={rows.length} onMove={setOffset} />
        </div>
      </section>
    </div>
  );
}
