"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteBottler,
  listBottlers,
  saveBottler,
  type Bottler,
  type BottlerInput,
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

const emptyForm: BottlerInput = { canonical_name: "", korean_name: null };

export default function BottlersTab() {
  const [rows, setRows] = useState<Bottler[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Bottler | null>(null);
  const [form, setForm] = useState<BottlerInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listBottlers(
        { search: search.trim() || undefined, limit: LIMIT, offset },
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
    [search, offset],
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
      await saveBottler(form, editing?.id);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: Bottler) {
    if (
      !window.confirm(
        `${row.canonical_name} 삭제?\n참조 브랜드가 있으면 서버가 409로 거절합니다. (상품 ${row.product_count} · 별칭 ${row.alias_count})`,
      )
    )
      return;
    deleteBottler(row.id)
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
            {editing ? `병입자 수정 #${editing.id}` : "병입자 추가"}
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
                <td className="px-3 py-2">
                  <div className="flex gap-1">
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
