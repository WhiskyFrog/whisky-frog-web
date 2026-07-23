#!/usr/bin/env node
/**
 * Read-only production smoke check (task-0007 acceptance criterion 5).
 *
 * Proves the deployed backend still exposes the v2 facet contract this
 * client is built against, and that the catalog/per-market list+facet request
 * pairs this repository constructs still return coherent, parity-respecting
 * responses. Performs GET requests only: no authentication, no admin routes,
 * no writes, no billable providers.
 *
 * Every input is an explicit operator argument. There is no hardcoded
 * production URL or market code anywhere in this file; missing input fails
 * closed rather than guessing or falling back to a default.
 *
 * Usage:
 *   node --import ./tests/register-typescript.mjs scripts/prod-smoke.mts \
 *     --frontend-base-url=https://<deployed-frontend> \
 *     --backend-base-url=https://<deployed-frontend>/backend-api \
 *     --market-code=<representative-market-code> \
 *     [--report-path=./smoke-report.json]
 *
 * Equivalently via environment variables SMOKE_FRONTEND_BASE_URL,
 * SMOKE_BACKEND_BASE_URL, SMOKE_MARKET_CODE, SMOKE_REPORT_PATH.
 *
 * Exit code 0 only if every check below passes; non-zero otherwise.
 */
import { writeFile } from "node:fs/promises";

import {
  FACET_OPERATION_IDS,
  FACET_ROUTES,
} from "../app/lib/api/facet-contract.ts";
import {
  createProductQueryClient,
  EMPTY_PRODUCT_QUERY_STATE,
  type FacetQueryMetadata,
} from "../app/lib/api/product-query.ts";

/** Discriminated response schemas the deployed OpenAPI document must still expose. */
const REQUIRED_V2_SCHEMAS = [
  "CatalogTermsFacetGroupV2",
  "MarketTermsFacetGroupV2",
  "RangeFacetGroupV2",
] as const;

interface CheckResult {
  check: string;
  status: "pass" | "fail";
  detail: string;
}

const results: CheckResult[] = [];

function record(check: string, status: "pass" | "fail", detail: string): boolean {
  results.push({ check, status, detail });
  return status === "pass";
}

/** Strips query strings so the report never echoes operator-supplied search values verbatim. */
function redact(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]!] = match[2]!;
  }
  return out;
}

function requiredInput(
  flags: Record<string, string>,
  flagName: string,
  envName: string,
): string | null {
  const value = flags[flagName] ?? process.env[envName];
  return value && value.trim() !== "" ? value.trim() : null;
}

async function getJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { method: "GET" });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

function readPath(obj: unknown, path: readonly (string | number)[]): unknown {
  let current = obj;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

async function main(): Promise<number> {
  const flags = parseArgs(process.argv.slice(2));

  const frontendBaseUrl = requiredInput(flags, "frontend-base-url", "SMOKE_FRONTEND_BASE_URL");
  const backendBaseUrl = requiredInput(flags, "backend-base-url", "SMOKE_BACKEND_BASE_URL");
  const marketCode = requiredInput(flags, "market-code", "SMOKE_MARKET_CODE");
  const reportPath = requiredInput(flags, "report-path", "SMOKE_REPORT_PATH");

  if (!frontendBaseUrl || !backendBaseUrl || !marketCode) {
    record(
      "required arguments present",
      "fail",
      "Missing one or more of --frontend-base-url, --backend-base-url, --market-code " +
        "(or SMOKE_FRONTEND_BASE_URL / SMOKE_BACKEND_BASE_URL / SMOKE_MARKET_CODE). " +
        "Failing closed: this script never guesses a production URL or market code.",
    );
    return finish(reportPath);
  }
  for (const [label, value] of [
    ["--frontend-base-url", frontendBaseUrl],
    ["--backend-base-url", backendBaseUrl],
  ] as const) {
    try {
      // eslint-disable-next-line no-new
      new URL(value);
    } catch {
      record(`${label} is a valid URL`, "fail", `"${value}" does not parse as a URL.`);
      return finish(reportPath);
    }
  }
  record("required arguments present", "pass", "frontend/backend base URLs and market code provided.");

  // --- 1. Deployed OpenAPI signature -------------------------------------------------
  const openapiUrl = `${backendBaseUrl.replace(/\/$/, "")}/openapi.json`;
  let openapi: unknown = null;
  try {
    const { ok, status, body } = await getJson(openapiUrl);
    if (!ok) {
      record("deployed OpenAPI document reachable", "fail", `GET ${redact(openapiUrl)} → HTTP ${status}`);
    } else {
      record("deployed OpenAPI document reachable", "pass", `GET ${redact(openapiUrl)} → HTTP ${status}`);
      openapi = body;
    }
  } catch (err) {
    record(
      "deployed OpenAPI document reachable",
      "fail",
      `GET ${redact(openapiUrl)} threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (openapi) {
    for (const [name, path] of Object.entries(FACET_ROUTES)) {
      const operationId = readPath(openapi, ["paths", path, "get", "operationId"]);
      const expected = FACET_OPERATION_IDS.find((id) => id === operationId);
      record(
        `OpenAPI exposes ${name} (${path})`,
        expected ? "pass" : "fail",
        expected
          ? `operationId "${operationId}" matches the generated contract.`
          : `paths["${path}"].get.operationId was "${String(operationId)}", expected one of ${FACET_OPERATION_IDS.join(", ")}.`,
      );
    }
    for (const schemaName of REQUIRED_V2_SCHEMAS) {
      const present = readPath(openapi, ["components", "schemas", schemaName]) !== undefined;
      record(
        `OpenAPI declares discriminator schema ${schemaName}`,
        present ? "pass" : "fail",
        present ? "present in components.schemas." : "missing from components.schemas.",
      );
    }
  } else {
    record(
      "OpenAPI contract checks",
      "fail",
      "Skipped: the OpenAPI document could not be retrieved.",
    );
  }

  // --- 2. Catalog and per-market list/facet pairs ------------------------------------
  const bothOk = await checkScopePair(
    { kind: "catalog" },
    "catalog",
    backendBaseUrl,
    "product",
  );
  const marketOk = await checkScopePair(
    { kind: "market", marketCode },
    "market",
    backendBaseUrl,
    "offer",
  );
  void bothOk;
  void marketOk;

  // --- 3. Read-only frontend page navigation -----------------------------------------
  const pageChecks: Array<{ label: string; url: string }> = [
    { label: "catalog page", url: `${frontendBaseUrl.replace(/\/$/, "")}/products` },
    {
      label: "per-market page",
      url: `${frontendBaseUrl.replace(/\/$/, "")}/markets/${encodeURIComponent(marketCode)}`,
    },
  ];
  for (const { label, url } of pageChecks) {
    try {
      const res = await fetch(url, { method: "GET" });
      const contentType = res.headers.get("content-type") ?? "";
      const isHtml = contentType.includes("text/html");
      record(
        `${label} is reachable (GET, no auth)`,
        res.ok && isHtml ? "pass" : "fail",
        `GET ${redact(url)} → HTTP ${res.status}, content-type "${contentType}". ` +
          "Deep control interaction is proven separately by the browser-level smoke suite; " +
          "this check only proves the deployed route responds with an HTML document.",
      );
    } catch (err) {
      record(
        `${label} is reachable (GET, no auth)`,
        "fail",
        `GET ${redact(url)} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return finish(reportPath);

  async function checkScopePair(
    scope: Parameters<typeof createProductQueryClient>[0],
    label: "catalog" | "market",
    baseUrl: string,
    expectedCountUnit: "product" | "offer",
  ): Promise<boolean> {
    const client = createProductQueryClient(scope, { version: "v2", baseUrl });
    const metadata: readonly FacetQueryMetadata[] = [];
    try {
      const pair = await client.refresh(EMPTY_PRODUCT_QUERY_STATE, metadata);
      if (pair.version !== "v2" || pair.scope !== label) {
        return record(
          `${label} v2 list/facet pair responds`,
          "fail",
          `Unexpected pair shape: scope=${pair.scope}, version=${pair.version}.`,
        );
      }
      const facets = pair.facets as { version?: string; count_unit?: string; total?: number };
      const list = pair.list as unknown[];
      const okShape =
        facets.version === "2" &&
        facets.count_unit === expectedCountUnit &&
        typeof facets.total === "number" &&
        facets.total >= 0 &&
        Array.isArray(list);
      return record(
        `${label} v2 list/facet pair responds`,
        okShape ? "pass" : "fail",
        okShape
          ? `facets.count_unit="${facets.count_unit}", facets.total=${facets.total}, list is an array of ${list.length}.`
          : `facets=${JSON.stringify({ version: facets.version, count_unit: facets.count_unit, total: facets.total })}, ` +
            `list is ${Array.isArray(list) ? "an array" : typeof list}.`,
      );
    } catch (err) {
      return record(
        `${label} v2 list/facet pair responds`,
        "fail",
        `client.refresh threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

async function finish(reportPath: string | null): Promise<number> {
  const failed = results.filter((r) => r.status === "fail");
  const report = {
    generatedAt: new Date().toISOString(),
    pass: failed.length === 0,
    total: results.length,
    failed: failed.length,
    results,
  };
  const rendered = JSON.stringify(report, null, 2);
  console.log(rendered);
  console.log("");
  console.log(
    report.pass
      ? `PASS — ${report.total}/${report.total} checks passed.`
      : `FAIL — ${report.failed}/${report.total} checks failed.`,
  );
  if (reportPath) {
    await writeFile(reportPath, rendered, "utf8");
    console.log(`Report written to ${reportPath}`);
  }
  return report.pass ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Smoke script crashed:", err);
    process.exitCode = 1;
  });
