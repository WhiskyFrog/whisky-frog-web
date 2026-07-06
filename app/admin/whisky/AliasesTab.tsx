"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALIAS_ENTITY_TYPES,
  deleteEntityAlias,
  deleteProductAlias,
  listBottlers,
  listBrands,
  listCaskTypes,
  listDistilleries,
  listEntityAliases,
  listProductAliases,
  listProducts,
  saveEntityAlias,
  saveProductAlias,
  type EntityAlias,
  type ProductAlias,
} from "../../lib/adminWhisky";
import { listMarkets, type Market } from "../../lib/markets";
import {
  DataTable,
  ErrorBanner,
  FormButtons,
  inputClass,
  Pager,
  RowActions,
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

interface EntityOption {
  id: number;
  label: string;
}

function typeLabel(value: string): string {
  return ALIAS_ENTITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

// ── 엔티티 별칭 섹션 ──

function EntityAliasSection() {
  const [rows, setRows] = useState<EntityAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<EntityAlias | null>(null);
  const [formType, setFormType] = useState("distillery");
  const [formEntityId, setFormEntityId] = useState("");
  const [formAlias, setFormAlias] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [saving, setSaving] = useState(false);

  // 폼 entity_type이 바뀌면 해당 타입의 엔티티 목록으로 셀렉트 채움.
  useEffect(() => {
    const controller = new AbortController();
    const toOption = (row: {
      id: number;
      canonical_name: string;
      korean_name?: string | null;
    }): EntityOption => ({
      id: row.id,
      label: row.korean_name
        ? `${row.canonical_name} / ${row.korean_name}`
        : row.canonical_name,
    });
    const request =
      formType === "distillery"
        ? listDistilleries({ limit: 500 }, controller.signal)
        : formType === "bottler"
          ? listBottlers({ limit: 500 }, controller.signal)
          : formType === "cask"
            ? listCaskTypes({ limit: 500 }, controller.signal)
            : listBrands({ limit: 500 }, controller.signal);
    request
      .then((data) => setOptions(data.map(toOption)))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "엔티티 목록 로드 실패");
      });
    return () => controller.abort();
  }, [formType]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listEntityAliases(
        {
          entity_type: typeFilter || undefined,
          search: search.trim() || undefined,
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
    [typeFilter, search, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setFormEntityId("");
    setFormAlias("");
  }

  async function submit() {
    setSaving(true);
    setErrorMsg("");
    try {
      await saveEntityAlias(
        {
          entity_type: formType,
          entity_id: Number(formEntityId),
          alias: formAlias.trim(),
        },
        editing?.id,
      );
      resetForm();
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: EntityAlias) {
    if (!window.confirm(`별칭 "${row.alias}" 삭제?`)) return;
    deleteEntityAlias(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  return (
    <section>
      <h3 className="font-semibold">엔티티 별칭</h3>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        증류소·병입자·캐스크·브랜드의 표기 변형. (타입, 별칭) 쌍이 중복이면
        서버가 409로 거절합니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">타입 전체</option>
          {ALIAS_ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="별칭 검색"
          className="w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <button type="button" onClick={() => { setOffset(0); load(); }} className={actionBtn.neutral}>
          조회
        </button>
      </div>

      <ErrorBanner message={errorMsg} />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="self-start rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h4 className="mb-3 font-semibold">
            {editing ? `별칭 수정 #${editing.id}` : "별칭 추가"}
          </h4>
          <div className="space-y-3">
            <select
              value={formType}
              onChange={(e) => {
                setFormType(e.target.value);
                setFormEntityId("");
              }}
              className={inputClass}
            >
              {ALIAS_ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} ({t.value})
                </option>
              ))}
            </select>
            <select
              required
              value={formEntityId}
              onChange={(e) => setFormEntityId(e.target.value)}
              className={inputClass}
            >
              <option value="">엔티티 선택</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              required
              value={formAlias}
              onChange={(e) => setFormAlias(e.target.value)}
              placeholder="별칭"
              className={inputClass}
            />
            <FormButtons saving={saving} onCancel={editing ? resetForm : undefined} />
          </div>
        </form>

        <div>
          <DataTable loading={loading} empty={rows.length === 0}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 font-medium">{row.alias}</td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {typeLabel(row.entity_type)}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {row.entity_name ?? `#${row.entity_id}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditing(row);
                      setFormType(row.entity_type);
                      setFormEntityId(String(row.entity_id));
                      setFormAlias(row.alias);
                    }}
                    onDelete={() => remove(row)}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager offset={offset} limit={LIMIT} count={rows.length} onMove={setOffset} />
        </div>
      </div>
    </section>
  );
}

// ── 제품 별칭 섹션 (마켓 원문 제목 → 제품 확정 매핑) ──

function ProductAliasSection() {
  const [rows, setRows] = useState<ProductAlias[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<ProductAlias | null>(null);
  const [formMarketId, setFormMarketId] = useState("");
  const [formRawTitle, setFormRawTitle] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formSource, setFormSource] = useState("human");
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<EntityOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listMarkets(controller.signal)
      .then(setMarkets)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "마켓 목록 로드 실패");
      });
    return () => controller.abort();
  }, []);

  const marketName = useMemo(() => {
    const map = new Map(markets.map((m) => [m.id, m.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [markets]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listProductAliases(
        {
          market_id: marketFilter ? Number(marketFilter) : undefined,
          search: search.trim() || undefined,
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
    [marketFilter, search, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function searchProducts() {
    listProducts({ search: productQuery.trim() || undefined, limit: 50 })
      .then((data) =>
        setProductOptions(
          data.map((p) => ({ id: p.id, label: `#${p.id} ${p.canonical_name}` })),
        ),
      )
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "제품 검색 실패"),
      );
  }

  function resetForm() {
    setEditing(null);
    setFormRawTitle("");
    setFormProductId("");
    setFormSource("human");
  }

  async function submit() {
    setSaving(true);
    setErrorMsg("");
    try {
      await saveProductAlias(
        {
          market_id: Number(formMarketId),
          raw_title: formRawTitle.trim(),
          product_id: Number(formProductId),
          source: formSource.trim() || "human",
        },
        editing?.id,
      );
      resetForm();
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: ProductAlias) {
    if (!window.confirm(`매핑 "${row.raw_title}" 삭제?`)) return;
    deleteProductAlias(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  return (
    <section className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
      <h3 className="font-semibold">제품 별칭 (마켓 원문 제목 매핑)</h3>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        마켓의 원문 상품 제목을 제품 마스터에 확정 매핑합니다. (마켓, 원문
        제목) 쌍이 중복이면 서버가 409로 거절합니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={marketFilter}
          onChange={(e) => {
            setMarketFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">마켓 전체</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="원문 제목 검색"
          className="w-64 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <button type="button" onClick={() => { setOffset(0); load(); }} className={actionBtn.neutral}>
          조회
        </button>
      </div>

      <ErrorBanner message={errorMsg} />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="self-start rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h4 className="mb-3 font-semibold">
            {editing ? `매핑 수정 #${editing.id}` : "매핑 추가"}
          </h4>
          <div className="space-y-3">
            <select
              required
              value={formMarketId}
              onChange={(e) => setFormMarketId(e.target.value)}
              className={inputClass}
            >
              <option value="">마켓 선택</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              required
              value={formRawTitle}
              onChange={(e) => setFormRawTitle(e.target.value)}
              placeholder="원문 제목 (raw_title)"
              className={inputClass}
            />
            <div className="flex gap-2">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchProducts();
                  }
                }}
                placeholder="제품 검색"
                className={inputClass}
              />
              <button type="button" onClick={searchProducts} className={actionBtn.neutral}>
                검색
              </button>
            </div>
            <select
              required
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              className={inputClass}
            >
              <option value="">제품 선택 (검색 후)</option>
              {editing &&
                !productOptions.some((o) => o.id === editing.product_id) && (
                  <option value={editing.product_id}>
                    #{editing.product_id} {editing.product_name ?? ""}
                  </option>
                )}
              {productOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              value={formSource}
              onChange={(e) => setFormSource(e.target.value)}
              placeholder="source (기본 human)"
              className={inputClass}
            />
            <FormButtons saving={saving} onCancel={editing ? resetForm : undefined} />
          </div>
        </form>

        <div>
          <DataTable loading={loading} empty={rows.length === 0}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.raw_title}</div>
                  <div className="text-xs text-gray-500">
                    {marketName(row.market_id)} · {row.source} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {row.product_name ?? `#${row.product_id}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions
                    onEdit={() => {
                      setEditing(row);
                      setFormMarketId(String(row.market_id));
                      setFormRawTitle(row.raw_title);
                      setFormProductId(String(row.product_id));
                      setFormSource(row.source);
                    }}
                    onDelete={() => remove(row)}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager offset={offset} limit={LIMIT} count={rows.length} onMove={setOffset} />
        </div>
      </div>
    </section>
  );
}

export default function AliasesTab() {
  return (
    <div>
      <EntityAliasSection />
      <ProductAliasSection />
    </div>
  );
}
