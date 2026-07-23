import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The filter trigger/drawer shell is identical markup in v2 (`ProductFacetPanel`) and legacy (`ProductFacetSidebar`) mode. */
export function filterTriggerButton(page: Page) {
  return page.getByRole("button", { name: "필터", exact: true });
}

export function filterDialog(page: Page) {
  return page.getByRole("dialog");
}

export async function openFilterDrawer(page: Page): Promise<void> {
  await filterTriggerButton(page).click();
  await expect(filterDialog(page)).toBeVisible();
}

export async function closeFilterDrawerViaButton(page: Page): Promise<void> {
  await page.getByRole("button", { name: "필터 닫기" }).click();
  await expect(filterDialog(page)).toBeHidden();
}

export async function closeFilterDrawerViaEscape(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(filterDialog(page)).toBeHidden();
}

export function availabilityCheckbox(page: Page) {
  return page.getByRole("checkbox", { name: "판매 가능 상품만" });
}

export function searchInput(page: Page) {
  return page.getByPlaceholder("상품명 검색 (한국어·영문·원문)");
}

export function prevPageButton(page: Page) {
  return page.getByRole("button", { name: "이전" });
}

export function nextPageButton(page: Page) {
  return page.getByRole("button", { name: "다음" });
}

export function resetButton(page: Page) {
  return page.getByRole("button", { name: "초기화" });
}

export async function waitForReady(page: Page): Promise<void> {
  await expect(page.getByText("상품을 불러오는 중…")).toHaveCount(0);
}

/**
 * Facet checkbox/radio `checked` state is fully controlled by the URL round trip
 * (useCatalogQuery/useMarketQuery commit the new URL, then only flip `checked` once
 * the resulting refetch resolves). `.check()`'s built-in post-click state check is a
 * single-shot verification, faster than that round trip, so it fails even though the
 * control does end up checked moments later. Click, then use an auto-retrying
 * assertion so the wait matches the app's actual (async) update path.
 */
export async function checkControl(locator: Locator): Promise<void> {
  await locator.click();
  await expect(locator).toBeChecked();
}
