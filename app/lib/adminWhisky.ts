import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

const base = `${API_BASE_URL}/api/admin/whisky`;

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

export interface BottlerInput {
  canonical_name: string;
  korean_name: string | null;
}

export interface Bottler extends BottlerInput {
  id: number;
  product_count: number;
  alias_count: number;
}

export interface CaskTypeInput {
  canonical_name: string;
  family: string;
  korean_name: string | null;
}

export interface CaskType extends CaskTypeInput {
  id: number;
  product_count: number;
  product_cask_count: number;
  alias_count: number;
}

export interface CaskFamily {
  value: string;
  korean: string | null;
}

export interface Brand {
  name: string;
  product_count: number;
}

export interface BrandMutation {
  name: string | null;
  products_updated: number;
}

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

export async function listDistilleries(
  query: { search?: string; country?: string; region?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Distillery[]> {
  return json(
    await fetch(`${base}/distilleries${qs(query)}`, {
      signal,
      cache: "no-store",
      headers: authHeaders(),
    }),
  );
}

export async function saveDistillery(
  payload: DistilleryInput,
  id?: number,
): Promise<Distillery> {
  return json(
    await fetch(`${base}/distilleries${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteDistillery(id: number): Promise<void> {
  await ensureOk(
    await fetch(`${base}/distilleries/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }),
  );
}

export async function listBottlers(
  query: { search?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Bottler[]> {
  return json(
    await fetch(`${base}/bottlers${qs(query)}`, {
      signal,
      cache: "no-store",
      headers: authHeaders(),
    }),
  );
}

export async function saveBottler(
  payload: BottlerInput,
  id?: number,
): Promise<Bottler> {
  return json(
    await fetch(`${base}/bottlers${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteBottler(id: number): Promise<void> {
  await ensureOk(
    await fetch(`${base}/bottlers/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }),
  );
}

export async function listCaskFamilies(
  signal?: AbortSignal,
): Promise<CaskFamily[]> {
  return json(
    await fetch(`${base}/cask-families`, {
      signal,
      cache: "no-store",
      headers: authHeaders(),
    }),
  );
}

export async function listCaskTypes(
  query: { search?: string; family?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<CaskType[]> {
  return json(
    await fetch(`${base}/cask-types${qs(query)}`, {
      signal,
      cache: "no-store",
      headers: authHeaders(),
    }),
  );
}

export async function saveCaskType(
  payload: CaskTypeInput,
  id?: number,
): Promise<CaskType> {
  return json(
    await fetch(`${base}/cask-types${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteCaskType(id: number): Promise<void> {
  await ensureOk(
    await fetch(`${base}/cask-types/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }),
  );
}

export async function listBrands(
  query: { search?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Brand[]> {
  return json(
    await fetch(`${base}/brands${qs(query)}`, {
      signal,
      cache: "no-store",
      headers: authHeaders(),
    }),
  );
}

export async function renameBrand(
  name: string,
  nextName: string,
): Promise<BrandMutation> {
  return json(
    await fetch(`${base}/brands/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify({ name: nextName }),
    }),
  );
}

export async function clearBrand(name: string): Promise<BrandMutation> {
  return json(
    await fetch(`${base}/brands/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }),
  );
}

export async function patchProductTaxonomy(
  productId: number,
  payload: ProductTaxonomyPatch,
): Promise<ProductTaxonomyPatchResult> {
  return json(
    await fetch(
      `${API_BASE_URL}/api/admin/processing/products/${productId}/taxonomy`,
      {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      },
    ),
  );
}
