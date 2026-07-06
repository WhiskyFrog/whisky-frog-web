"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteCaskType,
  listCaskFamilies,
  listCaskMaterials,
  listCaskTypes,
  saveCaskType,
  type CaskType,
  type CaskTypeInput,
  type Vocab,
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
  vocabLabel,
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

// "자동" = family/material을 body에서 생략 → 서버가 canonical_name에서 결정적 도출.
const AUTO = "__auto__";

interface FormState {
  canonical_name: string;
  family: string; // AUTO 또는 통제어휘 값
  material: string; // AUTO 또는 통제어휘 값
  korean_name: string | null;
}

const emptyForm: FormState = {
  canonical_name: "",
  family: AUTO,
  material: AUTO,
  korean_name: null,
};

export default function CasksTab() {
  const [rows, setRows] = useState<CaskType[]>([]);
  const [families, setFamilies] = useState<Vocab[]>([]);
  const [materials, setMaterials] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CaskType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // 통제어휘는 탭 진입 시 1회 로드 (하드코딩 금지 — 계약 준수).
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listCaskFamilies(controller.signal),
      listCaskMaterials(controller.signal),
    ])
      .then(([familyRows, materialRows]) => {
        setFamilies(familyRows);
        setMaterials(materialRows);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "통제어휘 로드 실패");
      });
    return () => controller.abort();
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listCaskTypes(
        {
          search: search.trim() || undefined,
          family: familyFilter || undefined,
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
    [search, familyFilter, offset],
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
      const payload: CaskTypeInput = {
        canonical_name: form.canonical_name,
        korean_name: form.korean_name,
      };
      if (form.family !== AUTO) payload.family = form.family;
      if (form.material !== AUTO) payload.material = form.material;
      await saveCaskType(payload, editing?.id);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: CaskType) {
    if (
      !window.confirm(
        `${row.canonical_name} 삭제?\n(상품 ${row.product_count} · 구성 ${row.product_cask_count} · 별칭 ${row.alias_count})`,
      )
    )
      return;
    deleteCaskType(row.id)
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
        <select
          value={familyFilter}
          onChange={(e) => {
            setFamilyFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">패밀리 전체</option>
          {families.map((f) => (
            <option key={f.value} value={f.value}>
              {vocabLabel(f)}
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
          <h3 className="mb-3 font-semibold">
            {editing ? `캐스크 수정 #${editing.id}` : "캐스크 추가"}
          </h3>
          <div className="space-y-3">
            <input
              required
              value={form.canonical_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, canonical_name: e.target.value }))
              }
              placeholder="Canonical name (예: Oloroso Sherry Butt)"
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
              <span className="mb-1 block text-xs text-gray-500">패밀리</span>
              <select
                value={form.family}
                onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                className={inputClass}
              >
                <option value={AUTO}>자동 (이름에서 도출)</option>
                {families.map((f) => (
                  <option key={f.value} value={f.value}>
                    {vocabLabel(f)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500">재질</span>
              <select
                value={form.material}
                onChange={(e) =>
                  setForm((f) => ({ ...f, material: e.target.value }))
                }
                className={inputClass}
              >
                <option value={AUTO}>자동 (이름에서 도출)</option>
                {materials.map((m) => (
                  <option key={m.value} value={m.value}>
                    {vocabLabel(m)}
                  </option>
                ))}
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
                  {row.family} / {row.material}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Metric label="상품" value={row.product_count} />
                    <Metric label="구성" value={row.product_cask_count} />
                    <Metric label="별칭" value={row.alias_count} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditing(row);
                      setForm({
                        canonical_name: row.canonical_name,
                        family: row.family,
                        material: row.material,
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
