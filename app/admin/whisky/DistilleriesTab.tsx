"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDistillery,
  listDistilleries,
  saveDistillery,
  type Distillery,
  type DistilleryInput,
} from "../../lib/adminWhisky";
import {
  clean,
  DataTable,
  ErrorBanner,
  FormButtons,
  inputClass,
  Metric,
  Pager,
  RowActions,
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

const emptyForm: DistilleryInput = {
  canonical_name: "",
  korean_name: null,
  country: null,
  region: null,
  closed: false,
  is_secret: false,
  renamed_to_id: null,
  suspected_distillery_id: null,
};

export default function DistilleriesTab() {
  const [rows, setRows] = useState<Distillery[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Distillery | null>(null);
  const [form, setForm] = useState<DistilleryInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listDistilleries(
        {
          search: search.trim() || undefined,
          country: country.trim() || undefined,
          region: region.trim() || undefined,
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
    [search, country, region, offset],
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
      await saveDistillery(form, editing?.id);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: Distillery) {
    if (
      !window.confirm(
        `${row.canonical_name} 삭제?\n참조 브랜드가 있으면 서버가 409로 거절합니다. (상품 ${row.product_count} · 별칭 ${row.alias_count})`,
      )
    )
      return;
    deleteDistillery(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 검색"
          className="w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="국가 필터"
          className="w-36 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="지역 필터"
          className="w-36 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
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
          <h3 className="mb-3 font-semibold">
            {editing ? `증류소 수정 #${editing.id}` : "증류소 추가"}
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
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.country ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: clean(e.target.value) }))
                }
                placeholder="국가"
                className={inputClass}
              />
              <input
                value={form.region ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: clean(e.target.value) }))
                }
                placeholder="지역"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={form.closed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, closed: e.target.checked }))
                }
                className="h-4 w-4 accent-blue-600"
              />
              폐쇄
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={form.is_secret}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_secret: e.target.checked }))
                }
                className="h-4 w-4 accent-blue-600"
              />
              비공개/시크릿
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
                  {[row.country, row.region].filter(Boolean).join(" / ") || "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.closed && <Metric label="폐쇄" value="" />}
                    {row.is_secret && <Metric label="비공개" value="" />}
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
                        country: row.country,
                        region: row.region,
                        closed: row.closed,
                        is_secret: row.is_secret,
                        renamed_to_id: row.renamed_to_id,
                        suspected_distillery_id: row.suspected_distillery_id,
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
    </div>
  );
}
