"use client";

import { useState } from "react";
import {
  CURRENCY_OPTIONS,
  createMarket,
  emptyMarketInput,
  updateMarket,
  type Market,
  type MarketInput,
  type ShippingOption,
} from "../../lib/markets";

/** Market(응답) → MarketInput(폼 상태)로 변환. */
function toInput(m: Market): MarketInput {
  return {
    code: m.code,
    domain: m.domain,
    name: m.name,
    currency: m.currency,
    country: m.country,
    language: m.language,
    base_url: m.base_url,
    active: m.active,
    vat_rate: String(m.vat_rate),
    price_includes_vat: m.price_includes_vat,
    local_alcohol_tax_per_liter: String(m.local_alcohol_tax_per_liter),
    price_includes_local_alcohol_tax: m.price_includes_local_alcohol_tax,
    incoterm: m.incoterm,
    fta: m.fta,
    domestic_shipping_cost: String(m.domestic_shipping_cost),
    crawl_ship_to: m.crawl_ship_to,
    notes: m.notes,
    shipping_options: m.shipping_options.map((o) => ({
      name: o.name,
      cost: String(o.cost),
      active: o.active,
    })),
  };
}

/** 빈 문자열 → null (nullable 텍스트 필드 전송용). */
function nullify(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800";

const checkboxLabelCls =
  "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300";

export function MarketForm({
  market,
  onDone,
  onCancel,
}: {
  market: Market | null; // null = 새 마켓
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MarketInput>(
    market ? toInput(market) : emptyMarketInput(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof MarketInput>(key: K, value: MarketInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setOption(i: number, patch: Partial<ShippingOption>) {
    setForm((f) => ({
      ...f,
      shipping_options: f.shipping_options.map((o, idx) =>
        idx === i ? { ...o, ...patch } : o,
      ),
    }));
  }

  function addOption() {
    setForm((f) => ({
      ...f,
      shipping_options: [
        ...f.shipping_options,
        { name: "", cost: "0", active: true },
      ],
    }));
  }

  function removeOption(i: number) {
    setForm((f) => ({
      ...f,
      shipping_options: f.shipping_options.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (market) await updateMarket(market.id, form);
      else await createMarket(form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {market ? `마켓 수정 — ${market.name}` : "새 마켓"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 목록으로
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 기본 식별 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="코드 *"
          hint="메뉴/URL 키. 소문자·숫자·하이픈, 영숫자로 시작, 2~16자 (예: wp, sms)"
        >
          <input
            required
            value={form.code}
            onChange={(e) => set("code", e.target.value.toLowerCase())}
            pattern="[a-z0-9][a-z0-9-]*"
            minLength={2}
            maxLength={16}
            className={inputCls}
          />
        </Field>
        <Field label="도메인 *" hint="마켓 식별 키(어댑터와 일치, 변경 주의)">
          <input
            required
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="표시 이름 *" hint="화면에 보일 마켓 이름">
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="통화 *" hint="현지통화(ISO 3자)">
          <select
            required
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={inputCls}
          >
            <option value="">선택…</option>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="원산지 국가" hint="FTA·면세 판정 기준">
          <input
            value={form.country ?? ""}
            onChange={(e) => set("country", nullify(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="언어" hint="크롤러 파싱 로케일 힌트(예: EN)">
          <input
            value={form.language ?? ""}
            onChange={(e) => set("language", nullify(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="기준 URL" hint="크롤 시작점 (절대 URL 또는 /view-all 같은 상대경로)">
          <input
            type="text"
            value={form.base_url ?? ""}
            onChange={(e) => set("base_url", nullify(e.target.value))}
            className={inputCls}
          />
        </Field>
      </section>

      {/* 세금/면세표기 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="부가세율 (%)" hint="현지 부가세율, ≥ 0">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.vat_rate}
            onChange={(e) => set("vat_rate", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field
          label="현지 주류세 (리터당)"
          hint="현지통화/순알코올 1L 기준, ≥ 0"
        >
          <input
            type="number"
            step="0.0001"
            min="0"
            value={form.local_alcohol_tax_per_liter}
            onChange={(e) =>
              set("local_alcohol_tax_per_liter", e.target.value)
            }
            className={inputCls}
          />
        </Field>
        <label className={checkboxLabelCls}>
          <input
            type="checkbox"
            checked={form.price_includes_vat}
            onChange={(e) => set("price_includes_vat", e.target.checked)}
          />
          표시가 부가세 포함 (한국 배송 기준)
        </label>
        <label className={checkboxLabelCls}>
          <input
            type="checkbox"
            checked={form.price_includes_local_alcohol_tax}
            onChange={(e) =>
              set("price_includes_local_alcohol_tax", e.target.checked)
            }
          />
          표시가에 현지 주류세 포함
        </label>
      </section>

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        ⚠️ 면세표기 주의: 같은 상품도 접속국가/배송지에 따라 부가세 포함/제외로 다르게
        표시됩니다. 크롤러는 한국 배송(수출) 기준(crawl_ship_to=KR)으로 접속하므로,
        <b> price_includes_vat</b>는 “한국 배송 기준으로 봤을 때 표시가가 부가세
        포함인가”를 의미합니다. 실제 페이지를 그 조건에서 확인 후 설정하세요.
      </p>

      {/* 배송/관세 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="인코텀 (배송 조건)" hint="FOB 또는 DAP">
          <select
            value={form.incoterm}
            onChange={(e) =>
              set("incoterm", e.target.value as MarketInput["incoterm"])
            }
            className={inputCls}
          >
            <option value="DAP">DAP</option>
            <option value="FOB">FOB</option>
          </select>
        </Field>
        <Field label="배송 국가" hint="크롤러가 가장하는 배송국(2자, 기본 KR)">
          <input
            maxLength={2}
            value={form.crawl_ship_to}
            onChange={(e) =>
              set("crawl_ship_to", e.target.value.toUpperCase())
            }
            className={inputCls}
          />
        </Field>
        <Field
          label="현지 국내 배송비"
          hint="현지 국내배송 구간(현재 비용엔진 미사용)"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.domestic_shipping_cost}
            onChange={(e) => set("domestic_shipping_cost", e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="flex items-end gap-6">
          <label className={checkboxLabelCls}>
            <input
              type="checkbox"
              checked={form.fta}
              onChange={(e) => set("fta", e.target.checked)}
            />
            FTA 원산지 (관세 0)
          </label>
          <label className={checkboxLabelCls}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            활성화 (크롤링 on/off)
          </label>
        </div>
      </section>

      {/* 배송옵션 반복행 */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            배송옵션
          </h3>
          <button
            type="button"
            onClick={addOption}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            + 행 추가
          </button>
        </div>
        {form.shipping_options.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            배송옵션 없음
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {form.shipping_options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder="옵션명 (예: Standard)"
                  value={o.name}
                  onChange={(e) => setOption(i, { name: e.target.value })}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="배송비"
                  value={o.cost}
                  onChange={(e) => setOption(i, { cost: e.target.value })}
                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={(e) =>
                      setOption(i, { active: e.target.checked })
                    }
                  />
                  active
                </label>
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          저장 시 name 기준으로 전체 동기화됩니다(같은 name 중복 금지). 현지통화 기준
          금액.
        </p>
      </section>

      <Field label="메모" hint="분석 메모">
        <textarea
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => set("notes", nullify(e.target.value))}
          className={inputCls}
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          {saving ? "저장 중…" : market ? "저장" : "생성"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          취소
        </button>
      </div>
    </form>
  );
}
