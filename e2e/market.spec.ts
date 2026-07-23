import { test, expect } from "@playwright/test";
import {
  availabilityCheckbox,
  checkControl,
  closeFilterDrawerViaButton,
  closeFilterDrawerViaEscape,
  filterDialog,
  filterTriggerButton,
  nextPageButton,
  openFilterDrawer,
  prevPageButton,
  resetButton,
  searchInput,
  waitForReady,
} from "./support/dom";
import {
  imageRichMarketList,
  marketFacetV2Fixture,
  publicMarket,
  tableMarketList,
} from "./support/fixtures";
import { defaultMockState, installProductApiMocks, requestsMatching } from "./support/mock-api";

const VERSION = (process.env.PW_VERSION as "v2" | "legacy" | undefined) ?? "v2";
const isLegacy = VERSION === "legacy";

/** Image-rich market (>=50% of products carry an image candidate) — always the card grid. */
const IMAGE_RICH_CODE = "wp";
/** Market below the image threshold — mobile cards below `sm`, desktop table at/above `sm`. */
const TABLE_CODE = "sms";

type MockState = ReturnType<typeof defaultMockState>;

function baseState(): MockState {
  return defaultMockState({
    marketList: {
      [IMAGE_RICH_CODE]: imageRichMarketList(4),
      [TABLE_CODE]: tableMarketList(4),
    },
    marketFacetsV2: {
      [IMAGE_RICH_CODE]: marketFacetV2Fixture,
      [TABLE_CODE]: marketFacetV2Fixture,
    },
    marketFacetsLegacy: {
      [IMAGE_RICH_CODE]: marketLegacyFixtureFor(),
      [TABLE_CODE]: marketLegacyFixtureFor(),
    },
    publicMarkets: [
      publicMarket({ id: 1, code: IMAGE_RICH_CODE, name: "위스키피플", provides_direct_purchase: true }),
      publicMarket({ id: 2, code: TABLE_CODE, name: "싱글몰트샵", provides_direct_purchase: false }),
    ],
  });
}

test.describe(`per-market (/markets/[code]) — ${VERSION}`, () => {
  test.beforeEach(async ({ page }) => {
    const state = baseState();
    await installProductApiMocks(page, state);
    (page as unknown as { __mockState: MockState }).__mockState = state;
  });

  test("loads and shows the offer-total wording (not a product count) @critical", async ({
    page,
  }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);
    // Scoped to "총 N개 오퍼" (the page-level results summary) rather than the bare "N개 오퍼"
    // substring: the closed filter drawer carries the same wording in its own (off-screen but
    // still painted, so still Playwright-"visible") header, and would otherwise double-match.
    await expect(page.getByText(`총 ${marketFacetV2Fixture.total}개 오퍼`)).toBeVisible();
  });

  test("renders the image-rich responsive card grid (no table, either viewport)", async ({
    page,
  }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);
    await expect(page.getByText("Market Product 1")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("renders mobile cards below `sm` and the desktop table at/above `sm`", async ({ page }) => {
    await page.goto(`/markets/${TABLE_CODE}`);
    await waitForReady(page);
    const width = page.viewportSize()?.width ?? 1280;
    const narrow = width < 640;

    const table = page.locator("table");
    if (narrow) {
      await expect(table).toBeHidden();
      await expect(page.getByText("Market Product 1").first()).toBeVisible();
    } else {
      await expect(table).toBeVisible();
      await expect(table.getByText("Market Product 1")).toBeVisible();
    }
  });

  test("toggling availability retains a facet selection and updates the URL @critical", async ({
    page,
  }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}?available=false`);
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).not.toBeChecked();

    await openFilterDrawer(page);
    if (isLegacy) {
      await page.getByRole("button", { name: "주종", exact: true }).click();
    }
    await checkControl(page.getByRole("checkbox", { name: "싱글 몰트" }));
    await closeFilterDrawerViaButton(page);
    await expect(page).toHaveURL(/spirit_type=single_malt/);

    await checkControl(availabilityCheckbox(page));
    await expect(page).toHaveURL(/available=true/);
    await expect(page).toHaveURL(/spirit_type=single_malt/);
  });

  test("opens/closes the drawer by mouse and by keyboard, restoring trigger focus", async ({
    page,
  }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);

    await openFilterDrawer(page);
    await closeFilterDrawerViaButton(page);
    await expect(filterTriggerButton(page)).toBeFocused();

    await openFilterDrawer(page);
    await closeFilterDrawerViaEscape(page);
    await expect(filterTriggerButton(page)).toBeFocused();

    await openFilterDrawer(page);
    await page.mouse.click(page.viewportSize()!.width - 10, 10);
    await expect(filterDialog(page)).toBeHidden();
  });

  test("search debounces and sends the shared search parameter", async ({ page }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);
    const state = (page as unknown as { __mockState: MockState }).__mockState;

    await searchInput(page).fill("글렌");
    await expect(page).toHaveURL(/search=/, { timeout: 5_000 });
    const facetRequests = requestsMatching(
      state,
      isLegacy ? "/facets" : "/v2/markets",
    ).filter((u) => u.includes("facets"));
    expect(facetRequests.some((u) => u.includes("search="))).toBe(true);
  });

  test("paginates forward/back using the offer total @critical", async ({ page }) => {
    const state = baseState();
    state.marketFacetsV2[IMAGE_RICH_CODE] = { ...marketFacetV2Fixture, total: 250 };
    state.marketFacetsLegacy[IMAGE_RICH_CODE] = { ...marketLegacyFixtureFor(), total: 250 };
    await installProductApiMocks(page, state);

    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);
    await expect(prevPageButton(page)).toBeDisabled();
    await expect(nextPageButton(page)).toBeEnabled();

    await nextPageButton(page).click();
    await expect(page).toHaveURL(/offset=/);
    await prevPageButton(page).click();
    await expect(page).not.toHaveURL(/offset=/);
  });

  test("deep link, reload, and back/forward reproduce the same filter state @critical", async ({
    page,
  }) => {
    await page.goto(`/markets/${IMAGE_RICH_CODE}?available=false`);
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).not.toBeChecked();

    await checkControl(availabilityCheckbox(page));
    await expect(page).toHaveURL(/available=true/);

    await page.reload();
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).toBeChecked();

    await page.goBack();
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).not.toBeChecked();

    await page.goForward();
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).toBeChecked();
  });

  test("recovers from a mocked facet error via retry @critical", async ({ page }) => {
    const state = baseState();
    state.failFacetOnceFor = isLegacy
      ? `/markets/${IMAGE_RICH_CODE}/facets`
      : `/v2/markets/${IMAGE_RICH_CODE}/facets`;
    await installProductApiMocks(page, state);

    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await expect(page.getByText("상품 목록을 불러오지 못했습니다.")).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();
    await waitForReady(page);
    await expect(page.getByText("Market Product 1")).toBeVisible();
  });

  test("sets multi-select and range structured controls, then resets all values", async ({
    page,
  }) => {
    test.skip(isLegacy, "legacy mode has no structured v2 renderer");
    await page.goto(`/markets/${IMAGE_RICH_CODE}`);
    await waitForReady(page);
    await openFilterDrawer(page);

    await checkControl(page.getByRole("checkbox", { name: "싱글 몰트" }));
    await expect(page).toHaveURL(/spirit_type=single_malt/);

    const abvMin = page.getByLabel("도수 최소 (percent)");
    await abvMin.fill("46");
    await expect(page).toHaveURL(/abv_min=46/);

    await resetButton(page).click();
    await expect(page).not.toHaveURL(/spirit_type=/);
    await expect(page).not.toHaveURL(/abv_min=/);
  });
});

function marketLegacyFixtureFor() {
  return {
    axes: ["spirit_type"],
    total: 3,
    cask_family: [],
    cask_type: [],
    cask_material: [],
    country: [],
    region: [],
    spirit_type: [{ value: "single_malt", count: 3, korean: "싱글 몰트" }],
    distillery: [],
    bottling: { official: 3, independent: 0 },
    peated: { peated: 2, unpeated: 1, unknown: 0 },
    volume_ml: [{ value: 700, count: 3, korean: null }],
    age_years: { min: "8", max: "21" },
    abv: { min: "40.0", max: "58.2" },
  };
}
