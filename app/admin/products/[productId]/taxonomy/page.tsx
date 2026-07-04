"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { actionBtn } from "../../../../components/actionButton";
import {
  getProductFacets,
  listBottlers,
  listCaskFamilies,
  listCaskTypes,
  listDistilleries,
  patchProductFacets,
  patchProductTaxonomy,
  SPIRIT_TYPE_OPTIONS,
  type Bottler,
  type CaskFamily,
  type CaskType,
  type Distillery,
  type ProductFacets,
  type ProductFacetsPatchBody,
  type ProductTaxonomyPatch,
} from "../../../../lib/adminWhisky";

type Status = "loading" | "error" | "ready";

function clean(value: string): string | null {
  const next = value.trim();
  return next ? next : null;
}

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inputClass(): string {
  return "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950";
}

function optionLabel(row: {
  canonical_name: string;
  korean_name?: string | null;
}): string {
  return row.korean_name
    ? `${row.canonical_name} / ${row.korean_name}`
    : row.canonical_name;
}

function spiritLabel(value: string): string {
  const found = SPIRIT_TYPE_OPTIONS.find((o) => o.value === value);
  return found ? `${found.label} (${found.value})` : value;
}

function entityLabel(
  name: string | null,
  korean: string | null,
): string {
  if (!name) return "-";
  return korean ? `${name} / ${korean}` : name;
}

interface FormState {
  distilleryId: string;
  bottlerId: string;
  caskTypeId: string;
  brand: string;
  spiritType: string;
  ageYears: string;
  vintageYear: string;
  peated: "" | "true" | "false";
}

function formFromFacets(facets: ProductFacets): FormState {
  return {
    distilleryId: facets.distillery_id ? String(facets.distillery_id) : "",
    bottlerId: facets.bottler_id ? String(facets.bottler_id) : "",
    caskTypeId: facets.cask_type_id ? String(facets.cask_type_id) : "",
    brand: facets.brand ?? "",
    spiritType: facets.spirit_type,
    ageYears: facets.age_years === null ? "" : String(facets.age_years),
    vintageYear: facets.vintage_year === null ? "" : String(facets.vintage_year),
    peated: facets.peated === null ? "" : facets.peated ? "true" : "false",
  };
}

export default function ProductTaxonomyPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [facets, setFacets] = useState<ProductFacets | null>(null);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottlers, setBottlers] = useState<Bottler[]>([]);
  const [casks, setCasks] = useState<CaskType[]>([]);
  const [families, setFamilies] = useState<CaskFamily[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [distilleryName, setDistilleryName] = useState("");
  const [bottlerName, setBottlerName] = useState("");
  const [caskTypeName, setCaskTypeName] = useState("");
  const [caskFamily, setCaskFamily] = useState("other");

  const rawName = searchParams.get("raw") || "";
  const marketCode = searchParams.get("market") || "";
  const fallbackName = searchParams.get("name") || `Product #${productId}`;
  const productName = facets?.canonical_name || fallbackName;

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      setErrorMsg("");
      Promise.all([
        getProductFacets(productId, signal),
        listDistilleries({ limit: 500 }, signal),
        listBottlers({ limit: 500 }, signal),
        listCaskTypes({ limit: 500 }, signal),
        listCaskFamilies(signal),
      ])
        .then(([facetRow, distilleryRows, bottlerRows, caskRows, familyRows]) => {
          setFacets(facetRow);
          setForm(formFromFacets(facetRow));
          setDistilleries(distilleryRows);
          setBottlers(bottlerRows);
          setCasks(caskRows);
          setFamilies(familyRows);
          setCaskFamily(familyRows[0]?.value || "other");
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setStatus("error");
        });
    },
    [productId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selectedCask = useMemo(
    () => casks.find((row) => String(row.id) === form?.caskTypeId),
    [casks, form?.caskTypeId],
  );

  function update(patch: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !facets) return;
    setSaving(true);
    setErrorMsg("");
    setSavedMsg("");
    try {
      // 1) 새 canonical name 입력분 → 기존 taxonomy PATCH(엔티티 생성 + 연결).
      const creation: ProductTaxonomyPatch = {};
      const newDistillery = clean(distilleryName);
      const newBottler = clean(bottlerName);
      const newCask = clean(caskTypeName);
      if (newDistillery) creation.distillery_name = newDistillery;
      if (newBottler) creation.bottler_name = newBottler;
      if (newCask) {
        creation.cask_type_name = newCask;
        creation.cask_family = caskFamily;
      }

      // 2) 나머지 변경분 → facets PATCH(보낸 필드만 갱신, null = 비우기).
      const patch: ProductFacetsPatchBody = {};
      const distilleryId = numberValue(form.distilleryId);
      const bottlerId = numberValue(form.bottlerId);
      const caskTypeId = numberValue(form.caskTypeId);
      if (!newDistillery && distilleryId !== facets.distillery_id) {
        patch.distillery_id = distilleryId;
      }
      if (!newBottler && bottlerId !== facets.bottler_id) {
        patch.bottler_id = bottlerId;
      }
      if (!newCask && caskTypeId !== facets.cask_type_id) {
        patch.cask_type_id = caskTypeId;
      }
      const brand = clean(form.brand);
      if (brand !== (facets.brand ?? null)) patch.brand = brand;
      if (form.spiritType !== facets.spirit_type) {
        patch.spirit_type = form.spiritType;
      }
      const ageYears = numberValue(form.ageYears);
      if (ageYears !== facets.age_years) patch.age_years = ageYears;
      const vintageYear = numberValue(form.vintageYear);
      if (vintageYear !== facets.vintage_year) patch.vintage_year = vintageYear;
      const peated = form.peated === "" ? null : form.peated === "true";
      if (peated !== facets.peated) patch.peated = peated;

      if (Object.keys(creation).length === 0 && Object.keys(patch).length === 0) {
        setErrorMsg("변경된 항목이 없습니다.");
        return;
      }

      if (Object.keys(creation).length > 0) {
        await patchProductTaxonomy(productId, creation);
        setDistilleryName("");
        setBottlerName("");
        setCaskTypeName("");
      }
      if (Object.keys(patch).length > 0) {
        await patchProductFacets(productId, patch);
      }

      const next = await getProductFacets(productId);
      setFacets(next);
      setForm(formFromFacets(next));
      setSavedMsg("저장했습니다. 상품 목록을 새로 불러오면 변경된 팩싯이 반영됩니다.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-5">
        <Link
          href={marketCode ? `/markets/${marketCode}` : "/admin/whisky"}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {marketCode ? "상품 목록으로 돌아가기" : "위스키 도메인 관리로 돌아가기"}
        </Link>
        <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          상품 분류 팩싯 보정
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {productName}
        </p>
        {rawName && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {rawName}
          </p>
        )}
      </header>

      {facets && (
        <section className="mb-5 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950 sm:grid-cols-4">
          <div>
            <div className="text-xs text-gray-400">현재 증류소</div>
            <div className="mt-1 font-medium">
              {entityLabel(facets.distillery_name, facets.distillery_korean)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">현재 병입자</div>
            <div className="mt-1 font-medium">
              {entityLabel(facets.bottler_name, facets.bottler_korean)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">현재 캐스크</div>
            <div className="mt-1 font-medium">
              {entityLabel(facets.cask_type_name, facets.cask_type_korean)}
              {facets.cask_type_family && (
                <span className="ml-1 text-xs text-gray-400">
                  ({facets.cask_type_family})
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">브랜드</div>
            <div className="mt-1 font-medium">{facets.brand ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">주종</div>
            <div className="mt-1 font-medium">{spiritLabel(facets.spirit_type)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">숙성연수</div>
            <div className="mt-1 font-medium">
              {facets.age_years === null ? "NAS/미상" : `${facets.age_years}년`}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">빈티지</div>
            <div className="mt-1 font-medium">{facets.vintage_year ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">피트</div>
            <div className="mt-1 font-medium">
              {facets.peated === null ? "미상" : facets.peated ? "피트" : "논피트"}
            </div>
          </div>
        </section>
      )}

      {status === "loading" && (
        <div className="rounded border border-gray-200 px-4 py-12 text-center text-gray-500 dark:border-gray-800">
          불러오는 중
        </div>
      )}

      {status === "error" && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {status === "ready" && form && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <section>
            <h3 className="mb-3 font-semibold">연결 속성</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              선택 해제(선택 안 함)로 저장하면 연결이 비워집니다. 새 canonical
              name을 입력하면 엔티티를 새로 만들어 연결합니다.
            </p>
            <div className="grid gap-5 lg:grid-cols-3">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">증류소</legend>
                <select
                  value={form.distilleryId}
                  onChange={(e) => {
                    update({ distilleryId: e.target.value });
                    if (e.target.value) setDistilleryName("");
                  }}
                  className={inputClass()}
                >
                  <option value="">선택 안 함</option>
                  {distilleries.map((row) => (
                    <option key={row.id} value={row.id}>
                      {optionLabel(row)}
                    </option>
                  ))}
                </select>
                <input
                  value={distilleryName}
                  onChange={(e) => {
                    setDistilleryName(e.target.value);
                    if (e.target.value) update({ distilleryId: "" });
                  }}
                  placeholder="새 canonical name"
                  className={inputClass()}
                />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">병입자</legend>
                <select
                  value={form.bottlerId}
                  onChange={(e) => {
                    update({ bottlerId: e.target.value });
                    if (e.target.value) setBottlerName("");
                  }}
                  className={inputClass()}
                >
                  <option value="">선택 안 함</option>
                  {bottlers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {optionLabel(row)}
                    </option>
                  ))}
                </select>
                <input
                  value={bottlerName}
                  onChange={(e) => {
                    setBottlerName(e.target.value);
                    if (e.target.value) update({ bottlerId: "" });
                  }}
                  placeholder="새 canonical name"
                  className={inputClass()}
                />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">캐스크 (주 캐스크)</legend>
                <select
                  value={form.caskTypeId}
                  onChange={(e) => {
                    update({ caskTypeId: e.target.value });
                    if (e.target.value) setCaskTypeName("");
                  }}
                  className={inputClass()}
                >
                  <option value="">선택 안 함</option>
                  {casks.map((row) => (
                    <option key={row.id} value={row.id}>
                      {optionLabel(row)}
                    </option>
                  ))}
                </select>
                {selectedCask && (
                  <p className="text-xs text-gray-400">
                    패밀리: {selectedCask.family}
                  </p>
                )}
                <input
                  value={caskTypeName}
                  onChange={(e) => {
                    setCaskTypeName(e.target.value);
                    if (e.target.value) update({ caskTypeId: "" });
                  }}
                  placeholder="새 canonical name"
                  className={inputClass()}
                />
                <select
                  value={caskFamily}
                  disabled={!clean(caskTypeName)}
                  onChange={(e) => setCaskFamily(e.target.value)}
                  className={inputClass()}
                >
                  {families.map((family) => (
                    <option key={family.value} value={family.value}>
                      {family.korean
                        ? `${family.korean} (${family.value})`
                        : family.value}
                    </option>
                  ))}
                </select>
              </fieldset>
            </div>
          </section>

          <section className="border-t border-gray-100 pt-5 dark:border-gray-800">
            <h3 className="mb-3 font-semibold">분류 팩싯</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              주종을 바꾸면 관세 분류(hs_code)와 세금 모델이 서버에서 함께
              갱신됩니다. 증류주(위스키·럼·진·보드카·브랜디) 외에는 자동
              비용계산에서 제외됩니다.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">주종</span>
                <select
                  value={form.spiritType}
                  onChange={(e) => update({ spiritType: e.target.value })}
                  className={inputClass()}
                >
                  {SPIRIT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">브랜드</span>
                <input
                  value={form.brand}
                  onChange={(e) => update({ brand: e.target.value })}
                  placeholder="비우면 브랜드 해제"
                  className={inputClass()}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">숙성연수</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.ageYears}
                  onChange={(e) => update({ ageYears: e.target.value })}
                  placeholder="비우면 NAS"
                  className={inputClass()}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">빈티지(증류연도)</span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.vintageYear}
                  onChange={(e) => update({ vintageYear: e.target.value })}
                  placeholder="예: 1998"
                  className={inputClass()}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">피트</span>
                <select
                  value={form.peated}
                  onChange={(e) =>
                    update({ peated: e.target.value as FormState["peated"] })
                  }
                  className={inputClass()}
                >
                  <option value="">미상</option>
                  <option value="true">피트</option>
                  <option value="false">논피트</option>
                </select>
              </label>
            </div>
          </section>

          {errorMsg && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          )}
          {savedMsg && (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              {savedMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button disabled={saving} className={actionBtn.run}>
              {saving ? "저장 중" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className={actionBtn.neutral}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
