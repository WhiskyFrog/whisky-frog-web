"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { actionBtn } from "../../../../components/actionButton";
import {
  listBottlers,
  listCaskFamilies,
  listCaskTypes,
  listDistilleries,
  patchProductTaxonomy,
  type Bottler,
  type CaskFamily,
  type CaskType,
  type Distillery,
  type ProductTaxonomyPatch,
} from "../../../../lib/adminWhisky";

type Status = "loading" | "error" | "ready";

function clean(value: string): string | null {
  const next = value.trim();
  return next ? next : null;
}

function numberValue(value: string): number | null {
  if (!value) return null;
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

export default function ProductTaxonomyPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [distilleries, setDistilleries] = useState<Distillery[]>([]);
  const [bottlers, setBottlers] = useState<Bottler[]>([]);
  const [casks, setCasks] = useState<CaskType[]>([]);
  const [families, setFamilies] = useState<CaskFamily[]>([]);
  const [distilleryId, setDistilleryId] = useState("");
  const [bottlerId, setBottlerId] = useState("");
  const [caskTypeId, setCaskTypeId] = useState("");
  const [distilleryName, setDistilleryName] = useState("");
  const [bottlerName, setBottlerName] = useState("");
  const [caskTypeName, setCaskTypeName] = useState("");
  const [caskFamily, setCaskFamily] = useState("other");

  const productName = searchParams.get("name") || `Product #${productId}`;
  const rawName = searchParams.get("raw") || "";
  const marketCode = searchParams.get("market") || "";
  const currentDistillery = searchParams.get("distillery") || "-";
  const currentBottler = searchParams.get("bottler") || "-";
  const currentCask = searchParams.get("cask") || "-";
  const currentCaskFamily = searchParams.get("cask_family") || "-";

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      setErrorMsg("");
      Promise.all([
        listDistilleries({ limit: 500 }, signal),
        listBottlers({ limit: 500 }, signal),
        listCaskTypes({ limit: 500 }, signal),
        listCaskFamilies(signal),
      ])
        .then(([distilleryRows, bottlerRows, caskRows, familyRows]) => {
          setDistilleries(distilleryRows);
          setBottlers(bottlerRows);
          setCasks(caskRows);
          setFamilies(familyRows);
          setCaskFamily(
            searchParams.get("cask_family") || familyRows[0]?.value || "other",
          );
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setStatus("error");
        });
    },
    [searchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selectedCask = useMemo(
    () => casks.find((row) => String(row.id) === caskTypeId),
    [caskTypeId, casks],
  );

  useEffect(() => {
    if (selectedCask) setCaskFamily(selectedCask.family);
  }, [selectedCask]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSavedMsg("");
    try {
      const payload: ProductTaxonomyPatch = {};
      const did = numberValue(distilleryId);
      const bid = numberValue(bottlerId);
      const cid = numberValue(caskTypeId);
      const newDistillery = clean(distilleryName);
      const newBottler = clean(bottlerName);
      const newCask = clean(caskTypeName);

      if (did) payload.distillery_id = did;
      else if (newDistillery) payload.distillery_name = newDistillery;
      if (bid) payload.bottler_id = bid;
      else if (newBottler) payload.bottler_name = newBottler;
      if (cid) payload.cask_type_id = cid;
      else if (newCask) {
        payload.cask_type_name = newCask;
        payload.cask_family = caskFamily;
      }

      if (Object.keys(payload).length === 0) {
        setErrorMsg("변경할 증류소, 병입자, 캐스크 중 하나를 선택하거나 입력하세요.");
        return;
      }

      await patchProductTaxonomy(productId, payload);
      setSavedMsg("저장했습니다. 상품 목록을 새로 불러오면 변경된 패싯이 반영됩니다.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-5">
        <Link
          href={marketCode ? `/markets/${marketCode}` : "/admin/whisky"}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          상품 목록으로 돌아가기
        </Link>
        <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          상품 연결 속성 수정
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

      <section className="mb-5 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950 sm:grid-cols-4">
        <div>
          <div className="text-xs text-gray-400">현재 증류소</div>
          <div className="mt-1 font-medium">{currentDistillery}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">현재 병입자</div>
          <div className="mt-1 font-medium">{currentBottler}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">현재 캐스크</div>
          <div className="mt-1 font-medium">{currentCask}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">현재 패싯</div>
          <div className="mt-1 font-medium">{currentCaskFamily}</div>
        </div>
      </section>

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

      {status === "ready" && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="font-semibold">증류소</legend>
              <select
                value={distilleryId}
                onChange={(e) => {
                  setDistilleryId(e.target.value);
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
                  if (e.target.value) setDistilleryId("");
                }}
                placeholder="새 canonical name"
                className={inputClass()}
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-semibold">병입자</legend>
              <select
                value={bottlerId}
                onChange={(e) => {
                  setBottlerId(e.target.value);
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
                  if (e.target.value) setBottlerId("");
                }}
                placeholder="새 canonical name"
                className={inputClass()}
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-semibold">캐스크</legend>
              <select
                value={caskTypeId}
                onChange={(e) => {
                  setCaskTypeId(e.target.value);
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
              <input
                value={caskTypeName}
                onChange={(e) => {
                  setCaskTypeName(e.target.value);
                  if (e.target.value) setCaskTypeId("");
                }}
                placeholder="새 canonical name"
                className={inputClass()}
              />
              <select
                value={caskFamily}
                disabled={Boolean(caskTypeId)}
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

          {errorMsg && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          )}
          {savedMsg && (
            <div className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              {savedMsg}
            </div>
          )}

          <div className="mt-5 flex gap-2">
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
