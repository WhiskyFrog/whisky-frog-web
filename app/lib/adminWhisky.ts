// 위스키 도메인 관리(admin) API 클라이언트 — /api/admin/whisky/*.
// 계약: 볼트 docs/handoff-frontend-whisky-admin.md (구현 backend/app/api/admin_whisky.py).
// 정본은 openapi(types.gen.ts) — 스키마 변경 시 npm run gen:api 후 여기 수동 타입 동기화.
// 인증(JWT Bearer)·기반 URL·에러 처리는 auth.ts 공통 헬퍼 사용.

import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

const base = `${API_BASE_URL}/api/admin/whisky`;

// ── 공통 ──

/** 통제어휘 1항목 (cask-families / cask-materials — VocabOut). */
export interface Vocab {
  value: string;
  korean: string | null;
}

/** @deprecated Vocab으로 통합. */
export type CaskFamily = Vocab;

function qs(query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function json<T>(res: Response): Promise<T> {
  await ensureOk(res);
  return (await res.json()) as T;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return json(
    await fetch(url, { signal, cache: "no-store", headers: authHeaders() }),
  );
}

async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<T> {
  return json(
    await fetch(url, {
      method,
      headers: authHeaders(true),
      body: JSON.stringify(body),
    }),
  );
}

async function del(url: string): Promise<void> {
  await ensureOk(
    await fetch(url, { method: "DELETE", headers: authHeaders() }),
  );
}

// ── 증류소 ──

export interface DistilleryInput {
  canonical_name: string;
  korean_name: string | null;
  country: string | null;
  region: string | null;
  closed: boolean;
  is_secret: boolean;
  renamed_to_id: number | null;
  suspected_distillery_id: number | null;
}

export interface Distillery extends DistilleryInput {
  id: number;
  product_count: number;
  alias_count: number;
}

export async function listDistilleries(
  query: {
    search?: string;
    country?: string;
    region?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<Distillery[]> {
  return getJson(`${base}/distilleries${qs(query)}`, signal);
}

export async function saveDistillery(
  payload: DistilleryInput,
  id?: number,
): Promise<Distillery> {
  return sendJson(
    `${base}/distilleries${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteDistillery(id: number): Promise<void> {
  await del(`${base}/distilleries/${id}`);
}

// ── 병입자 ──

export interface BottlerInput {
  canonical_name: string;
  korean_name: string | null;
}

export interface Bottler extends BottlerInput {
  id: number;
  product_count: number;
  alias_count: number;
}

export async function listBottlers(
  query: { search?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<Bottler[]> {
  return getJson(`${base}/bottlers${qs(query)}`, signal);
}

export async function saveBottler(
  payload: BottlerInput,
  id?: number,
): Promise<Bottler> {
  return sendJson(
    `${base}/bottlers${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteBottler(id: number): Promise<void> {
  await del(`${base}/bottlers/${id}`);
}

// ── 캐스크 (통제어휘 + CRUD) ──

/** family/material을 생략(undefined)하면 서버가 canonical_name에서 결정적 도출("자동"). */
export interface CaskTypeInput {
  canonical_name: string;
  family?: string;
  material?: string;
  korean_name: string | null;
}

export interface CaskType {
  id: number;
  canonical_name: string;
  family: string;
  material: string;
  korean_name: string | null;
  product_count: number;
  product_cask_count: number;
  alias_count: number;
}

export async function listCaskFamilies(signal?: AbortSignal): Promise<Vocab[]> {
  return getJson(`${base}/cask-families`, signal);
}

export async function listCaskMaterials(
  signal?: AbortSignal,
): Promise<Vocab[]> {
  return getJson(`${base}/cask-materials`, signal);
}

export async function listCaskTypes(
  query: {
    search?: string;
    family?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<CaskType[]> {
  return getJson(`${base}/cask-types${qs(query)}`, signal);
}

export async function saveCaskType(
  payload: CaskTypeInput,
  id?: number,
): Promise<CaskType> {
  return sendJson(
    `${base}/cask-types${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteCaskType(id: number): Promise<void> {
  await del(`${base}/cask-types/${id}`);
}

// ── 브랜드 (엔티티) ──

/** kind 페어링(서버 422 강제): distillery_line→distillery_id 필수·bottler_id 금지,
 *  bottler_range→반대. peated는 distillery_line 전용. */
export const BRAND_KINDS: Array<{ value: string; label: string }> = [
  { value: "distillery_line", label: "증류소 라인" },
  { value: "bottler_range", label: "병입자 레인지" },
];

export interface BrandInput {
  canonical_name: string;
  korean_name: string | null;
  kind: string;
  distillery_id: number | null;
  bottler_id: number | null;
  peated: boolean | null;
}

export interface Brand extends BrandInput {
  id: number;
  distillery_name: string | null;
  bottler_name: string | null;
  product_count: number;
  alias_count: number;
}

export async function listBrands(
  query: {
    search?: string;
    kind?: string;
    distillery_id?: number;
    bottler_id?: number;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<Brand[]> {
  return getJson(`${base}/brands${qs(query)}`, signal);
}

export async function saveBrand(
  payload: BrandInput,
  id?: number,
): Promise<Brand> {
  return sendJson(
    `${base}/brands${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

/** 브랜드 삭제 — 참조 products는 FK SET NULL로 링크만 끊김. */
export async function deleteBrand(id: number): Promise<void> {
  await del(`${base}/brands/${id}`);
}

// ── 레거시 브랜드 라벨 (products.brand 자유 문자열 정리) ──

export interface BrandLabel {
  name: string;
  product_count: number;
}

export interface BrandLabelMutation {
  name: string | null;
  products_updated: number;
}

export async function listBrandLabels(
  query: { search?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<BrandLabel[]> {
  return getJson(`${base}/brand-labels${qs(query)}`, signal);
}

/** 라벨 일괄 개명 — 대상 라벨이 이미 존재하면 409. */
export async function renameBrandLabel(
  name: string,
  nextName: string,
): Promise<BrandLabelMutation> {
  return sendJson(
    `${base}/brand-labels/${encodeURIComponent(name)}`,
    "PUT",
    { name: nextName },
  );
}

/** 라벨 일괄 비우기 — 해당 문자열 products.brand를 전부 NULL. */
export async function clearBrandLabel(
  name: string,
): Promise<BrandLabelMutation> {
  return json(
    await fetch(`${base}/brand-labels/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }),
  );
}

// ── 엔티티 별칭 (다형: distillery/bottler/cask/brand) ──

export const ALIAS_ENTITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "distillery", label: "증류소" },
  { value: "bottler", label: "병입자" },
  { value: "cask", label: "캐스크" },
  { value: "brand", label: "브랜드" },
];

export interface EntityAliasInput {
  entity_type: string;
  entity_id: number;
  alias: string;
}

export interface EntityAlias extends EntityAliasInput {
  id: number;
  entity_name: string | null;
}

export async function listEntityAliases(
  query: {
    entity_type?: string;
    entity_id?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<EntityAlias[]> {
  return getJson(`${base}/aliases${qs(query)}`, signal);
}

export async function saveEntityAlias(
  payload: EntityAliasInput,
  id?: number,
): Promise<EntityAlias> {
  return sendJson(
    `${base}/aliases${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteEntityAlias(id: number): Promise<void> {
  await del(`${base}/aliases/${id}`);
}

// ── 제품 별칭 (마켓 원문 제목 → 제품 확정 매핑) ──

export interface ProductAliasInput {
  market_id: number;
  raw_title: string;
  product_id: number;
  source: string;
}

export interface ProductAlias extends ProductAliasInput {
  id: number;
  product_name: string | null;
  created_at: string;
}

export async function listProductAliases(
  query: {
    market_id?: number;
    product_id?: number;
    source?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<ProductAlias[]> {
  return getJson(`${base}/product-aliases${qs(query)}`, signal);
}

export async function saveProductAlias(
  payload: ProductAliasInput,
  id?: number,
): Promise<ProductAlias> {
  return sendJson(
    `${base}/product-aliases${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteProductAlias(id: number): Promise<void> {
  await del(`${base}/product-aliases/${id}`);
}

// ── 분류 노트 (LLM 프롬프트 주입 노하우 텍스트 위키) ──

export interface ClassifierNoteInput {
  topic: string;
  body: string;
}

export interface ClassifierNote extends ClassifierNoteInput {
  id: number;
  updated_at: string;
}

export async function listClassifierNotes(
  query: { search?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<ClassifierNote[]> {
  return getJson(`${base}/notes${qs(query)}`, signal);
}

export async function saveClassifierNote(
  payload: ClassifierNoteInput,
  id?: number,
): Promise<ClassifierNote> {
  return sendJson(
    `${base}/notes${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    payload,
  );
}

export async function deleteClassifierNote(id: number): Promise<void> {
  await del(`${base}/notes/${id}`);
}

// ── 제품 ──

/** 주종 9종 — 백엔드 ck_products_spirit_type과 동일한 목록. hs_code는 서버가 파생. */
export const SPIRIT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "whisky", label: "위스키" },
  { value: "rum", label: "럼" },
  { value: "gin", label: "진" },
  { value: "vodka", label: "보드카" },
  { value: "brandy", label: "브랜디" },
  { value: "liqueur", label: "리큐르" },
  { value: "wine", label: "와인" },
  { value: "sake", label: "사케" },
  { value: "other", label: "기타/미상" },
];

/** 제품 목록/facets 응답 1행 (ProductFacetsOut). */
export interface ProductFacets {
  id: number;
  canonical_name: string;
  distillery_id: number | null;
  distillery_name: string | null;
  distillery_korean: string | null;
  bottler_id: number | null;
  bottler_name: string | null;
  bottler_korean: string | null;
  brand_id: number | null;
  brand_line_name: string | null;
  bottler_range_id: number | null;
  bottler_range_name: string | null;
  cask_type_id: number | null;
  cask_type_name: string | null;
  cask_type_family: string | null;
  cask_type_material: string | null;
  cask_type_korean: string | null;
  brand: string | null;
  spirit_type: string;
  abv: number | null;
  volume_ml: number | null;
  age_years: number | null;
  vintage_year: number | null;
  edition: string | null;
  peated: boolean | null;
}

/** 제품 생성 본문 — brand_id는 distillery_line kind만, bottler_range_id는
 *  bottler_range kind만(422). hs_code는 spirit_type에서 서버 파생(입력 금지). */
export interface ProductInput {
  canonical_name: string;
  distillery_id?: number | null;
  bottler_id?: number | null;
  brand_id?: number | null;
  bottler_range_id?: number | null;
  cask_type_id?: number | null;
  brand?: string | null;
  spirit_type: string;
  abv?: number | null;
  volume_ml?: number | null;
  age_years?: number | null;
  vintage_year?: number | null;
  edition?: string | null;
  peated?: boolean | null;
}

/** ⚠️ PATCH 시맨틱: 보낸 필드만 갱신, null 명시 = 해당 팩싯 비우기.
 *  undefined 필드는 JSON.stringify가 직렬화에서 제외한다(생략=미변경).
 *  canonical_name/spirit_type은 null 불가(422). */
export interface ProductFacetsPatchBody {
  canonical_name?: string;
  distillery_id?: number | null;
  bottler_id?: number | null;
  brand_id?: number | null;
  bottler_range_id?: number | null;
  cask_type_id?: number | null;
  brand?: string | null;
  spirit_type?: string;
  abv?: number | null;
  volume_ml?: number | null;
  age_years?: number | null;
  vintage_year?: number | null;
  edition?: string | null;
  peated?: boolean | null;
}

export async function listProducts(
  query: {
    search?: string;
    distillery_id?: number;
    bottler_id?: number;
    brand_id?: number;
    cask_type_id?: number;
    spirit_type?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<ProductFacets[]> {
  return getJson(`${base}/products${qs(query)}`, signal);
}

export async function createProduct(
  payload: ProductInput,
): Promise<ProductFacets> {
  return sendJson(`${base}/products`, "POST", payload);
}

/** 제품 삭제 — 마켓 URL 매칭은 SET NULL 보존, 캐스크 구성·별칭은 함께 삭제. */
export async function deleteProduct(id: number): Promise<void> {
  await del(`${base}/products/${id}`);
}

export async function getProductFacets(
  productId: number,
  signal?: AbortSignal,
): Promise<ProductFacets> {
  return getJson(`${base}/products/${productId}/facets`, signal);
}

export async function patchProductFacets(
  productId: number,
  payload: ProductFacetsPatchBody,
): Promise<ProductFacets> {
  return sendJson(`${base}/products/${productId}/facets`, "PATCH", payload);
}

// ── 제품 캐스크 구성 ──

export const CASK_ROLES: Array<{ value: string; label: string }> = [
  { value: "maturation", label: "숙성" },
  { value: "finish", label: "피니시" },
];

/** finish_months는 role=finish 전용(422). */
export interface ProductCaskInput {
  cask_type_id: number | null;
  role: string;
  finish_months: number | null;
}

export interface ProductCask extends ProductCaskInput {
  id: number;
  seq: number;
  cask_type_name: string | null;
  cask_type_family: string | null;
}

export async function getProductCasks(
  productId: number,
  signal?: AbortSignal,
): Promise<ProductCask[]> {
  return getJson(`${base}/products/${productId}/casks`, signal);
}

/** 전체교체 — 배열 순서가 곧 seq. 대표 cask_type_id가 구성과 불일치하면 서버가 첫 행으로 동기화. */
export async function putProductCasks(
  productId: number,
  rows: ProductCaskInput[],
): Promise<ProductCask[]> {
  return sendJson(`${base}/products/${productId}/casks`, "PUT", rows);
}

// ── (기존) 제품 taxonomy 수동 교정 — admin_processing 계약 ──

export interface ProductTaxonomyPatch {
  distillery_id?: number | null;
  distillery_name?: string | null;
  bottler_id?: number | null;
  bottler_name?: string | null;
  cask_type_id?: number | null;
  cask_type_name?: string | null;
  cask_family?: string | null;
}

export interface ProductTaxonomyPatchResult {
  product_id: number;
  distillery_id: number | null;
  bottler_id: number | null;
  cask_type_id: number | null;
  updated: boolean;
}

export async function patchProductTaxonomy(
  productId: number,
  payload: ProductTaxonomyPatch,
): Promise<ProductTaxonomyPatchResult> {
  return sendJson(
    `${API_BASE_URL}/api/admin/processing/products/${productId}/taxonomy`,
    "PATCH",
    payload,
  );
}
