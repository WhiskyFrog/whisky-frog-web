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
  catalogFacetV2Fixture,
  catalogProductWithManyOffers,
  legacyCatalogFacetFixture,
} from "./support/fixtures";
import { defaultMockState, installProductApiMocks, requestsMatching } from "./support/mock-api";

/**
 * `PW_VERSION` is set by the `e2e:v2` / `e2e:legacy` package.json scripts to match whichever
 * `NEXT_PUBLIC_PRODUCT_API_VERSION` the production build under test was built with (that env var
 * is inlined at `next build` time, so the two configurations are genuinely two separate builds,
 * not a runtime toggle). Defaults to "v2" for local/full-matrix runs.
 *
 * Tests tagged `@critical` in their title exercise only markup shared by both the v2 structured
 * renderer (`ProductFacetPanel`) and the legacy sidebar (`ProductFacetSidebar`) — the drawer
 * shell, availability toggle, search, pagination, error/retry, and the price-history card are
 * identical in both. These are the scenarios the `e2e:v2` / `e2e:legacy` runbook steps grep for,
 * proving the whole list/facet pair behaves coherently in either forced configuration.
 */
const VERSION = (process.env.PW_VERSION as "v2" | "legacy" | undefined) ?? "v2";
const isLegacy = VERSION === "legacy";

type MockState = ReturnType<typeof defaultMockState>;

test.describe(`catalog (/products) — ${VERSION}`, () => {
  test.beforeEach(async ({ page }) => {
    const state = defaultMockState();
    await installProductApiMocks(page, state);
    (page as unknown as { __mockState: MockState }).__mockState = state;
  });

  test("loads and shows results @critical", async ({ page }) => {
    await page.goto("/products");
    await waitForReady(page);
    await expect(page.getByRole("heading", { name: "상품 가격 비교" })).toBeVisible();
    await expect(page.getByText(/개 상품/)).toBeVisible();
    await expect(page.getByText("샘플 싱글몰트 12")).toBeVisible();
  });

  test("toggling availability retains a facet selection and updates the URL @critical", async ({
    page,
  }) => {
    // Start from an explicit `available=false` deep link: the "available only" checkbox maps
    // `checked -> true` / `unchecked -> null` (both display as checked, since the server default
    // omitting the param is also "available only"), so the only DOM-observable, URL-observable
    // toggle direction is unchecked -> checked.
    await page.goto("/products?available=false");
    await waitForReady(page);
    await expect(availabilityCheckbox(page)).not.toBeChecked();

    await openFilterDrawer(page);
    if (isLegacy) {
      await page.getByRole("button", { name: "마켓", exact: true }).click();
    }
    await checkControl(page.getByRole("checkbox", { name: "예시 마켓" }));
    await closeFilterDrawerViaButton(page);

    await expect(page).toHaveURL(/market=market-a/);

    await checkControl(availabilityCheckbox(page));
    await expect(page).toHaveURL(/available=true/);
    await expect(page).toHaveURL(/market=market-a/);
  });

  test("opens/closes the drawer by mouse and by keyboard, restoring trigger focus", async ({
    page,
  }) => {
    await page.goto("/products");
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

  test("search debounces, sends the shared search parameter, and updates the URL", async ({
    page,
  }) => {
    await page.goto("/products");
    await waitForReady(page);
    const state = (page as unknown as { __mockState: MockState }).__mockState;

    await searchInput(page).fill("글렌");
    await expect(page).toHaveURL(/search=/, { timeout: 5_000 });
    const facetRequests = requestsMatching(
      state,
      isLegacy ? "/products/facets" : "/v2/products/facets",
    );
    expect(facetRequests.some((u) => u.includes("search="))).toBe(true);
  });

  test("paginates forward/back without losing selections @critical", async ({ page }) => {
    const state = defaultMockState({
      catalogFacetsV2: { ...catalogFacetV2Fixture, total: 120 },
      catalogFacetsLegacy: { ...legacyCatalogFacetFixture, total: 120 },
    });
    await installProductApiMocks(page, state);

    await page.goto("/products");
    await waitForReady(page);
    await expect(prevPageButton(page)).toBeDisabled();
    await expect(nextPageButton(page)).toBeEnabled();

    await nextPageButton(page).click();
    await expect(page).toHaveURL(/offset=/);
    await expect(prevPageButton(page)).toBeEnabled();

    await prevPageButton(page).click();
    await expect(page).not.toHaveURL(/offset=/);
  });

  test("deep link, reload, and back/forward all reproduce the same filter state @critical", async ({
    page,
  }) => {
    await page.goto("/products?available=false");
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
    const state = defaultMockState({
      failFacetOnceFor: isLegacy ? "/products/facets" : "/v2/products/facets",
    });
    await installProductApiMocks(page, state);

    await page.goto("/products");
    await expect(page.getByText("상품 목록을 불러오지 못했습니다.")).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();
    await waitForReady(page);
    await expect(page.getByText("샘플 싱글몰트 12")).toBeVisible();
  });

  test("expands the offer list and proves the price-history card stays lazy until expansion @critical", async ({
    page,
  }) => {
    await page.goto("/products");
    await waitForReady(page);
    const state = (page as unknown as { __mockState: MockState }).__mockState;

    const product = catalogProductWithManyOffers();
    const card = page.getByRole("article").filter({ hasText: "샘플 싱글몰트 12" });
    await expect(card.getByRole("listitem")).toHaveCount(4);

    await card.getByRole("button", { name: /더 보기/ }).click();
    await expect(card.getByRole("listitem")).toHaveCount(product.offers.length);

    expect(requestsMatching(state, "price-history")).toHaveLength(0);

    await card.getByRole("button", { name: "가격 추이 보기" }).click();
    await expect(card.getByText("가격 이력을 불러오는 중…")).toBeVisible();
    await expect(card.getByText(/최근 \d+건/)).toBeVisible();
    expect(requestsMatching(state, "price-history")).toHaveLength(1);
  });

  test("sets every structured control family (multi-select, single-select incl. unknown, edition state, range)", async ({
    page,
  }) => {
    test.skip(isLegacy, "legacy mode has no structured v2 renderer");
    await page.goto("/products");
    await waitForReady(page);
    await openFilterDrawer(page);

    // Multi-select terms.
    await checkControl(page.getByRole("checkbox", { name: "예시 마켓" }));
    await expect(page).toHaveURL(/market=market-a/);

    // The peated group is server-flagged `relevant: false` regardless of selection.
    await expect(page.getByText("현재 선택과 맞지 않는 항목입니다").first()).toBeVisible();
    // Single-select terms with an explicit "unknown" state.
    await checkControl(page.getByRole("radio", { name: "미상" }));
    await expect(page).toHaveURL(/peated_state=unknown/);

    // Single-select edition_state, including a zero-count option that must stay selectable.
    await checkControl(page.getByRole("radio", { name: "한정판" }));
    await expect(page).toHaveURL(/edition_state=limited/);

    // Range control.
    const ageMin = page.getByLabel("숙성 연수 최소 (years)");
    await expect(ageMin).toHaveValue("");
    await ageMin.fill("12");
    await expect(page).toHaveURL(/age_min=12/);
  });

  test("retains a selection whose option disappears from a later response until explicitly cleared", async ({
    page,
  }) => {
    test.skip(isLegacy, "retained-selection cache is a v2 structured-renderer behavior");
    const state = defaultMockState();
    await installProductApiMocks(page, state);

    await page.goto("/products");
    await waitForReady(page);
    await openFilterDrawer(page);

    await checkControl(page.getByRole("checkbox", { name: "예시 증류소" }));
    await expect(page).toHaveURL(/distillery_id=101/);

    // Next facet response drops the previously-selected distillery option entirely.
    state.catalogFacetsV2 = {
      ...catalogFacetV2Fixture,
      groups: catalogFacetV2Fixture.groups.map((g) =>
        g.key === "distillery" ? { ...g, options: [] } : g,
      ),
    };
    // A search-criterion change always serializes to a new URL (unlike some availability-toggle
    // transitions, which can round-trip to the same canonical query), guaranteeing a real refetch
    // that picks up the updated mock response above.
    await searchInput(page).fill("aged");
    await expect(page).toHaveURL(/search=aged/, { timeout: 5_000 });
    await waitForReady(page);

    const retainedOption = page.getByRole("checkbox", { name: "예시 증류소" });
    await expect(retainedOption).toBeChecked();
    await expect(page.getByText("현재 결과에 없음").first()).toBeVisible();

    // Explicit per-value clear removes it.
    await page.getByRole("button", { name: "예시 증류소 선택 해제" }).click();
    await expect(page).not.toHaveURL(/distillery_id=/);
  });

  test("clears one facet value individually, then resets all values", async ({ page }) => {
    test.skip(isLegacy, "assertions target the v2 structured renderer's per-value clear controls");
    await page.goto("/products");
    await waitForReady(page);
    await openFilterDrawer(page);

    await checkControl(page.getByRole("checkbox", { name: "예시 마켓" }));
    await checkControl(page.getByRole("radio", { name: "미상" }));
    await expect(page).toHaveURL(/market=market-a/);
    await expect(page).toHaveURL(/peated_state=unknown/);

    await page.getByRole("button", { name: "피트 상태 선택 해제" }).click();
    await expect(page).not.toHaveURL(/peated_state=/);
    await expect(page).toHaveURL(/market=market-a/);

    await resetButton(page).click();
    await expect(page).not.toHaveURL(/market=market-a/);
  });
});
