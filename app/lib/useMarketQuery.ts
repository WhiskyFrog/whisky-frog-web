"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProductQueryClient,
  EMPTY_PRODUCT_QUERY_STATE,
  LEGACY_FACET_QUERY_METADATA,
  parseProductQueryState,
  serializeProductQueryState,
  setFacetSelection,
  setPageOffset,
  setQueryCriteria,
  type FacetQueryMetadata,
  type FacetSelection,
  type ProductQueryPair,
  type ProductQueryState,
} from "./api/product-query";

/** Per-market list page size; mirrors the pre-migration page's fixed page size. */
export const MARKET_PAGE_SIZE = 100;

export type MarketQueryStatus = "loading" | "error" | "ready";

export interface UseMarketQueryOptions {
  /** Encoded path segment identifying the market scope for every request. */
  marketCode: string;
  /** Current canonical browser search string, without a leading `?`. Drives every parse/fetch. */
  rawSearch: string;
  /**
   * Called whenever local state produces a search string that differs from `rawSearch`.
   * `"push"` is a user-driven change (should create a history entry); `"replace"` is a
   * canonicalization of the current entry (deep link / stale param normalization).
   */
  onSearchChange: (search: string, mode: "push" | "replace") => void;
  /** Test/operator seams; production callers omit all three and get the real client. */
  version?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface MarketQueryResult {
  status: MarketQueryStatus;
  errorMessage: string;
  version: "v2" | "legacy";
  queryState: ProductQueryState;
  pair: ProductQueryPair | null;
  /** Query metadata currently driving parse/serialize; authoritative once a v2 response lands. */
  metadata: readonly FacetQueryMetadata[];
  setFacet: (key: string, selection: FacetSelection | null) => void;
  setFilters: (updater: (state: ProductQueryState) => ProductQueryState) => void;
  setSearch: (value: string | null) => void;
  setAvailableOnly: (checked: boolean) => void;
  setPage: (offset: number) => void;
  /** Clears facet selections only; search/availability are untouched (matches the legacy UI). */
  resetFacets: () => void;
  retry: () => void;
}

function withMarketDefaults(state: ProductQueryState): ProductQueryState {
  return { ...state, limit: state.limit ?? MARKET_PAGE_SIZE };
}

function clearFacets(state: ProductQueryState): ProductQueryState {
  if (Object.keys(state.facets).length === 0 && state.offset === 0) return state;
  return { ...state, facets: {}, offset: 0 };
}

/**
 * Owns one market's query state/fetch orchestration, independent of Next.js routing so it can be
 * unit-tested by feeding `rawSearch` directly. Mirrors `useCatalogQuery`'s bootstrap/metadata-swap
 * behavior (see its comment for why the first v2 request must use the legacy parameter table),
 * but scopes every request to `marketCode` and has no catalog-only sort control.
 */
export function useMarketQuery(options: UseMarketQueryOptions): MarketQueryResult {
  const { marketCode, rawSearch, onSearchChange } = options;
  const client = useMemo(
    () =>
      createProductQueryClient(
        { kind: "market", marketCode },
        { version: options.version, baseUrl: options.baseUrl, fetch: options.fetch },
      ),
    [marketCode, options.version, options.baseUrl, options.fetch],
  );

  const metadataSource = useRef<"bootstrap" | "live">(
    client.version === "legacy" ? "live" : "bootstrap",
  );
  const [metadata, setMetadata] = useState<readonly FacetQueryMetadata[]>(
    LEGACY_FACET_QUERY_METADATA,
  );
  const [queryState, setQueryState] = useState<ProductQueryState>(EMPTY_PRODUCT_QUERY_STATE);
  const [pair, setPair] = useState<ProductQueryPair | null>(null);
  const [status, setStatus] = useState<MarketQueryStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const lastFetchedQuery = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage("");

    (async () => {
      const parsed = withMarketDefaults(parseProductQueryState(rawSearch, metadata));
      const canonical = serializeProductQueryState(parsed, metadata).toString();

      if (canonical === lastFetchedQuery.current) {
        setQueryState(parsed);
        setStatus("ready");
        return;
      }

      try {
        const nextPair = await client.refresh(parsed, metadata, controller.signal);
        if (cancelled) return;
        lastFetchedQuery.current = canonical;
        setQueryState(parsed);
        setPair(nextPair);
        if (
          nextPair.scope === "market" &&
          nextPair.version === "v2" &&
          metadataSource.current === "bootstrap"
        ) {
          metadataSource.current = "live";
          setMetadata(nextPair.facets.groups);
        }
        setStatus("ready");
        // Deferred until after a successful fetch: see useCatalogQuery's identical comment.
        if (canonical !== rawSearch) onSearchChange(canonical, "replace");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rawSearch, metadata, client, onSearchChange, retryToken]);

  const commit = useCallback(
    (next: ProductQueryState) => {
      onSearchChange(serializeProductQueryState(next, metadata).toString(), "push");
    },
    [metadata, onSearchChange],
  );

  const setFacet = useCallback(
    (key: string, selection: FacetSelection | null) => {
      commit(setFacetSelection(queryState, key, selection));
    },
    [commit, queryState],
  );

  const setFilters = useCallback(
    (updater: (state: ProductQueryState) => ProductQueryState) => {
      commit(updater(queryState));
    },
    [commit, queryState],
  );

  const setSearch = useCallback(
    (value: string | null) => {
      commit(setQueryCriteria(queryState, { search: value?.trim() || null }));
    },
    [commit, queryState],
  );

  const setAvailableOnly = useCallback(
    (checked: boolean) => {
      commit(setQueryCriteria(queryState, { available: checked ? true : null }));
    },
    [commit, queryState],
  );

  const setPage = useCallback(
    (offset: number) => {
      commit(setPageOffset(queryState, offset));
    },
    [commit, queryState],
  );

  const resetFacets = useCallback(() => {
    commit(clearFacets(queryState));
  }, [commit, queryState]);

  const retry = useCallback(() => {
    lastFetchedQuery.current = null;
    setRetryToken((t) => t + 1);
  }, []);

  return {
    status,
    errorMessage,
    version: client.version,
    queryState,
    pair,
    metadata,
    setFacet,
    setFilters,
    setSearch,
    setAvailableOnly,
    setPage,
    resetFacets,
    retry,
  };
}
