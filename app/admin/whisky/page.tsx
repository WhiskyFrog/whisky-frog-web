"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearBrand,
  deleteBottler,
  deleteCaskType,
  deleteDistillery,
  listBottlers,
  listBrands,
  listCaskFamilies,
  listCaskTypes,
  listDistilleries,
  renameBrand,
  saveBottler,
  saveCaskType,
  saveDistillery,
  type Bottler,
  type BottlerInput,
  type Brand,
  type CaskFamily,
  type CaskType,
  type CaskTypeInput,
  type Distillery,
  type DistilleryInput,
} from "../../lib/adminWhisky";
import { actionBtn } from "../../components/actionButton";

type Tab = "distilleries" | "bottlers" | "casks" | "brands";
type Status = "loading" | "error" | "ready";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "distilleries", label: "증류소" },
  { key: "bottlers", label: "병입자" },
  { key: "casks", label: "캐스크" },
  { key: "brands", label: "브랜드" },
];

const emptyDistillery: DistilleryInput = {
  canonical_name: "",
  korean_name: null,
  country: null,
  region: null,
  closed: false,
  is_secret: false,
  renamed_to_id: null,
  suspected_distillery_id: null,
};

const emptyBottler: BottlerInput = {
  canonical_name: "",
  korean_name: null,
};

const emptyCask: CaskTypeInput = {
  canonical_name: "",
  family: "other",
  korean_name: null,
};

function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

function inputClass(): string {
  return "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950";
}

function metric(label: string, value: number) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {label} {value}
    </span>
  );
}

export default function AdminWhiskyPage() {
  const router = useRouter();
  const [facetProductId, setFacetProductId] = useState("");
  const [tab, setTab] = useState<Tab>("distilleries");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottlers, setBottlers] = useState<Bottler[]>([]);
  const [casks, setCasks] = useState<CaskType[]>([]);
  const [families, setFamilies] = useState<CaskFamily[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editingDistillery, setEditingDistillery] = useState<Distillery | null>(null);
  const [editingBottler, setEditingBottler] = useState<Bottler | null>(null);
  const [editingCask, setEditingCask] = useState<CaskType | null>(null);
  const [distilleryForm, setDistilleryForm] =
    useState<DistilleryInput>(emptyDistillery);
  const [bottlerForm, setBottlerForm] = useState<BottlerInput>(emptyBottler);
  const [caskForm, setCaskForm] = useState<CaskTypeInput>(emptyCask);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      setErrorMsg("");
      const q = { search: search.trim() || undefined, limit: 200 };
      const request =
        tab === "distilleries"
          ? listDistilleries(q, signal).then((rows) => setDistilleries(rows))
          : tab === "bottlers"
            ? listBottlers(q, signal).then((rows) => setBottlers(rows))
            : tab === "casks"
              ? Promise.all([
                  listCaskFamilies(signal),
                  listCaskTypes(q, signal),
                ]).then(([familyRows, caskRows]) => {
                  setFamilies(familyRows);
                  setCasks(caskRows);
                  setCaskForm((prev) => ({
                    ...prev,
                    family: prev.family || familyRows[0]?.value || "other",
                  }));
                })
              : listBrands(q, signal).then((rows) => setBrands(rows));

      request
        .then(() => setStatus("ready"))
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setStatus("error");
        });
    },
    [search, tab],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const title = useMemo(
    () => TABS.find((item) => item.key === tab)?.label ?? "",
    [tab],
  );

  async function saveDistilleryForm() {
    setSaving(true);
    try {
      await saveDistillery(distilleryForm, editingDistillery?.id);
      setEditingDistillery(null);
      setDistilleryForm(emptyDistillery);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveBottlerForm() {
    setSaving(true);
    try {
      await saveBottler(bottlerForm, editingBottler?.id);
      setEditingBottler(null);
      setBottlerForm(emptyBottler);
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCaskForm() {
    setSaving(true);
    try {
      await saveCaskType(caskForm, editingCask?.id);
      setEditingCask(null);
      setCaskForm({ ...emptyCask, family: families[0]?.value ?? "other" });
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold">위스키 도메인 관리</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            증류소, 병입자, 캐스크, 브랜드 기준 데이터를 관리합니다. 상품별
            분류 팩싯(주종·숙성·빈티지·피트)은 상품 보정 화면에서 수정합니다.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = Number(facetProductId.trim());
              if (Number.isInteger(id) && id > 0) {
                router.push(`/admin/products/${id}/taxonomy`);
              }
            }}
            className="flex gap-2"
          >
            <input
              value={facetProductId}
              onChange={(e) => setFacetProductId(e.target.value)}
              inputMode="numeric"
              placeholder="상품 ID"
              className="w-28 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <button className={actionBtn.edit}>팩싯 보정</button>
          </form>
          <div className="flex flex-1 gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${title} 검색`}
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 lg:w-72"
            />
            <button onClick={() => load()} className={actionBtn.neutral}>
              조회
            </button>
          </div>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setSearch("");
              setStatus("loading");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === item.key
                ? "border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {status === "error" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {tab === "distilleries" && (
        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveDistilleryForm();
            }}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
          >
            <h3 className="mb-3 font-semibold">
              {editingDistillery ? "증류소 수정" : "증류소 추가"}
            </h3>
            <div className="space-y-3">
              <input
                required
                value={distilleryForm.canonical_name}
                onChange={(e) =>
                  setDistilleryForm((f) => ({
                    ...f,
                    canonical_name: e.target.value,
                  }))
                }
                placeholder="Canonical name"
                className={inputClass()}
              />
              <input
                value={distilleryForm.korean_name ?? ""}
                onChange={(e) =>
                  setDistilleryForm((f) => ({
                    ...f,
                    korean_name: clean(e.target.value),
                  }))
                }
                placeholder="한글명"
                className={inputClass()}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={distilleryForm.country ?? ""}
                  onChange={(e) =>
                    setDistilleryForm((f) => ({
                      ...f,
                      country: clean(e.target.value),
                    }))
                  }
                  placeholder="국가"
                  className={inputClass()}
                />
                <input
                  value={distilleryForm.region ?? ""}
                  onChange={(e) =>
                    setDistilleryForm((f) => ({
                      ...f,
                      region: clean(e.target.value),
                    }))
                  }
                  placeholder="지역"
                  className={inputClass()}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={distilleryForm.closed}
                  onChange={(e) =>
                    setDistilleryForm((f) => ({ ...f, closed: e.target.checked }))
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                폐쇄
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={distilleryForm.is_secret}
                  onChange={(e) =>
                    setDistilleryForm((f) => ({
                      ...f,
                      is_secret: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                비공개/스푼티드
              </label>
              <div className="flex gap-2">
                <button disabled={saving} className={actionBtn.run}>
                  {saving ? "저장 중" : "저장"}
                </button>
                {editingDistillery && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDistillery(null);
                      setDistilleryForm(emptyDistillery);
                    }}
                    className={actionBtn.neutral}
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
          </form>

          <DataTable loading={status === "loading"} empty={distilleries.length === 0}>
            {distilleries.map((row) => (
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
                    {row.closed && metric("폐쇄", 1)}
                    {row.is_secret && metric("비공개", 1)}
                    {metric("상품", row.product_count)}
                    {metric("alias", row.alias_count)}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditingDistillery(row);
                      setDistilleryForm({
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
                    onDelete={() => {
                      if (window.confirm(`${row.canonical_name} 삭제?`)) {
                        void deleteDistillery(row.id).then(() => load());
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}

      {tab === "bottlers" && (
        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <SimpleNameForm
            title={editingBottler ? "병입자 수정" : "병입자 추가"}
            value={bottlerForm}
            saving={saving}
            onChange={setBottlerForm}
            onSubmit={saveBottlerForm}
            onCancel={
              editingBottler
                ? () => {
                    setEditingBottler(null);
                    setBottlerForm(emptyBottler);
                  }
                : undefined
            }
          />
          <DataTable loading={status === "loading"} empty={bottlers.length === 0}>
            {bottlers.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.canonical_name}</div>
                  <div className="text-xs text-gray-500">{row.korean_name ?? "-"}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {metric("상품", row.product_count)}
                    {metric("alias", row.alias_count)}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditingBottler(row);
                      setBottlerForm({
                        canonical_name: row.canonical_name,
                        korean_name: row.korean_name,
                      });
                    }}
                    onDelete={() => {
                      if (window.confirm(`${row.canonical_name} 삭제?`)) {
                        void deleteBottler(row.id).then(() => load());
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}

      {tab === "casks" && (
        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveCaskForm();
            }}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
          >
            <h3 className="mb-3 font-semibold">
              {editingCask ? "캐스크 수정" : "캐스크 추가"}
            </h3>
            <div className="space-y-3">
              <input
                required
                value={caskForm.canonical_name}
                onChange={(e) =>
                  setCaskForm((f) => ({ ...f, canonical_name: e.target.value }))
                }
                placeholder="Canonical name"
                className={inputClass()}
              />
              <input
                value={caskForm.korean_name ?? ""}
                onChange={(e) =>
                  setCaskForm((f) => ({ ...f, korean_name: clean(e.target.value) }))
                }
                placeholder="한글명"
                className={inputClass()}
              />
              <select
                value={caskForm.family}
                onChange={(e) =>
                  setCaskForm((f) => ({ ...f, family: e.target.value }))
                }
                className={inputClass()}
              >
                {families.map((family) => (
                  <option key={family.value} value={family.value}>
                    {family.korean ? `${family.korean} (${family.value})` : family.value}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button disabled={saving} className={actionBtn.run}>
                  {saving ? "저장 중" : "저장"}
                </button>
                {editingCask && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCask(null);
                      setCaskForm({ ...emptyCask, family: families[0]?.value ?? "other" });
                    }}
                    className={actionBtn.neutral}
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
          </form>
          <DataTable loading={status === "loading"} empty={casks.length === 0}>
            {casks.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.canonical_name}</div>
                  <div className="text-xs text-gray-500">{row.korean_name ?? "-"}</div>
                </td>
                <td className="px-3 py-2 text-sm">{row.family}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {metric("상품", row.product_count)}
                    {metric("구성", row.product_cask_count)}
                    {metric("alias", row.alias_count)}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditingCask(row);
                      setCaskForm({
                        canonical_name: row.canonical_name,
                        family: row.family,
                        korean_name: row.korean_name,
                      });
                    }}
                    onDelete={() => {
                      if (window.confirm(`${row.canonical_name} 삭제?`)) {
                        void deleteCaskType(row.id).then(() => load());
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}

      {tab === "brands" && (
        <DataTable loading={status === "loading"} empty={brands.length === 0}>
          {brands.map((row) => (
            <tr key={row.name} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{metric("상품", row.product_count)}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <button
                    className={actionBtn.edit}
                    onClick={() => {
                      const next = window.prompt("새 브랜드명", row.name);
                      if (next?.trim()) {
                        void renameBrand(row.name, next.trim()).then(() => load());
                      }
                    }}
                  >
                    이름 변경
                  </button>
                  <button
                    className={actionBtn.danger}
                    onClick={() => {
                      if (window.confirm(`${row.name} 브랜드 값을 비울까요?`)) {
                        void clearBrand(row.name).then(() => load());
                      }
                    }}
                  >
                    비우기
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function DataTable({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
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
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-1.5">
      <button className={actionBtn.edit} onClick={onEdit}>
        수정
      </button>
      <button className={actionBtn.danger} onClick={onDelete}>
        삭제
      </button>
    </div>
  );
}

function SimpleNameForm({
  title,
  value,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  value: BottlerInput;
  saving: boolean;
  onChange: (value: BottlerInput) => void;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
    >
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">
        <input
          required
          value={value.canonical_name}
          onChange={(e) => onChange({ ...value, canonical_name: e.target.value })}
          placeholder="Canonical name"
          className={inputClass()}
        />
        <input
          value={value.korean_name ?? ""}
          onChange={(e) => onChange({ ...value, korean_name: clean(e.target.value) })}
          placeholder="한글명"
          className={inputClass()}
        />
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
      </div>
    </form>
  );
}
