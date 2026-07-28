import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  defaultMockState,
  installProductApiMocks,
  requestsMatching,
} from "./support/mock-api";

const characterNames = ["Bramble", "Cooper", "Pip"] as const;
const staticBuildOrigin = "http://homepage.e2e.local";

async function installStaticBuild(page: Page): Promise<void> {
  if (process.env.E2E_STATIC_BUILD !== "1") return;

  await page.route(`${staticBuildOrigin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    let filePath: string | undefined;

    if (pathname === "/") {
      filePath = path.join(process.cwd(), ".next/server/app/index.html");
    } else if (pathname.startsWith("/_next/static/")) {
      filePath = path.join(process.cwd(), ".next", pathname.slice("/_next/".length));
    } else if (pathname.startsWith("/brand/")) {
      filePath = path.join(process.cwd(), "public", pathname.slice(1));
    }

    if (!filePath || !existsSync(filePath)) {
      await route.fulfill({ status: 404, body: `Missing static build asset: ${pathname}` });
      return;
    }

    await route.fulfill({ path: filePath });
  });
}

function marketLink(page: Page): Locator {
  return page.getByRole("link", { name: "마켓 둘러보기" });
}

function directPriceLink(page: Page): Locator {
  return page.getByRole("link", { name: "직구가 계산하기" });
}

function topNav(page: Page): Locator {
  return page.getByRole("navigation").first();
}

function topNavPriceComparisonLink(page: Page): Locator {
  return topNav(page).getByRole("link", { name: "가격 비교", exact: true });
}

function topNavDirectPriceLink(page: Page): Locator {
  return topNav(page).getByRole("link", { name: "직구가 계산", exact: true });
}

test.describe("public homepage regression boundary", () => {
  test.beforeEach(async ({ page }) => {
    const state = defaultMockState();
    await installStaticBuild(page);
    await installProductApiMocks(page, state);
    (page as unknown as { __homepageMockState: typeof state }).__homepageMockState = state;
  });

  test("contains every TopNav control at narrow, intermediate, and wide viewports", async ({
    page,
  }, testInfo) => {
    const widths = testInfo.project.name === "narrow" ? [320, 768] : [1280];

    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 320 ? 720 : 800 });
      await page.goto("/");

      expect(page.viewportSize()?.width).toBe(width);
      const main = page.getByRole("main", { name: "Whisky Frog" });
      const stickyNav = topNav(page);
      const requiredLinks = [
        [topNavPriceComparisonLink(page), "/products"],
        [topNavDirectPriceLink(page), "/direct-price"],
      ] as const;
      const requiredControls = [
        stickyNav.getByRole("link", { name: "Whisky Frog", exact: true }),
        stickyNav.getByText("마켓", { exact: true }),
        ...requiredLinks.map(([link]) => link),
        stickyNav.getByRole("button", { name: "관리자", exact: true }),
      ];

      await expect(main).toBeVisible();
      await expect(stickyNav).toBeVisible();
      for (const [link, destination] of requiredLinks) {
        await expect(link).toHaveAttribute("href", destination);
      }

      await expect
        .poll(() =>
          page.evaluate(() => {
            const nav = document.querySelector("nav");
            return {
              documentContained:
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
              navigationContained:
                nav !== null && nav.scrollWidth <= nav.clientWidth,
            };
          }),
        )
        .toEqual({ documentContained: true, navigationContained: true });

      const navHandle = await stickyNav.elementHandle();
      expect(navHandle).not.toBeNull();
      for (const control of requiredControls) {
        await expect(control).toBeVisible();
        expect(
          await control.evaluate((element, nav) => {
            const rect = element.getBoundingClientRect();
            const navRect = (nav as Element).getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.left >= 0 &&
              rect.right <= window.innerWidth &&
              rect.top >= navRect.top &&
              rect.bottom <= navRect.bottom &&
              (hit === element || element.contains(hit))
            );
          }, navHandle),
        ).toBe(true);
      }

      expect(
        await main.evaluate((element, nav) => {
          const mainRect = element.getBoundingClientRect();
          const navRect = (nav as Element).getBoundingClientRect();
          return mainRect.top >= navRect.bottom;
        }, navHandle),
      ).toBe(true);

      await requiredControls[1]!.hover();
      const loadedMarketLink = stickyNav.getByRole("link", {
        name: /예시 마켓.*JPY/,
      });
      await expect(loadedMarketLink).toBeVisible();
      await expect(loadedMarketLink).toHaveAttribute("href", "/markets/market-a");

      await page.evaluate(() => {
        document.addEventListener(
          "click",
          (event) => {
            const anchor = (event.target as Element).closest(
              'nav a[href="/products"], nav a[href="/direct-price"]',
            );
            if (!anchor) return;
            event.preventDefault();
            document.body.dataset.lastTopNavActivation =
              anchor.getAttribute("href") ?? "";
          },
          { capture: true },
        );
      });

      for (const [link, destination] of requiredLinks) {
        await link.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(link).toBeFocused();
        expect(
          await link.evaluate((element) => {
            const styles = getComputedStyle(element);
            return (
              styles.outlineStyle !== "none" &&
              Number.parseFloat(styles.outlineWidth) > 0
            );
          }),
        ).toBe(true);
        await page.keyboard.press("Enter");
        await expect
          .poll(() => page.locator("body").getAttribute("data-last-top-nav-activation"))
          .toBe(destination);
      }

      for (const name of characterNames) {
        const image = page.getByRole("img", { name });
        await expect(image).toHaveCount(1);
        await expect(image).toBeVisible();
      }
    }

    const state = (
      page as unknown as {
        __homepageMockState: ReturnType<typeof defaultMockState>;
      }
    ).__homepageMockState;
    await expect
      .poll(() => requestsMatching(state, "/api/markets").length)
      .toBe(widths.length);
  });

  test("primary links have visible non-color-only focus and activate in logical keyboard order", async ({
    page,
  }) => {
    await page.goto("/");
    const first = marketLink(page);
    const second = directPriceLink(page);

    await expect(first).toHaveAttribute("href", "/markets/muk");
    await expect(second).toHaveAttribute("href", "/direct-price");

    await page.evaluate(() => {
      document.addEventListener("click", (event) => {
        const anchor = (event.target as Element).closest(
          'a[href="/markets/muk"], a[href="/direct-price"]',
        );
        if (!anchor) return;
        event.preventDefault();
        document.body.dataset.lastHomepageActivation = anchor.getAttribute("href") ?? "";
      }, { capture: true });
    });

    await first.focus();
    await page.keyboard.press("Tab");
    await expect(second).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(first).toBeFocused();

    for (const [link, destination] of [
      [first, "/markets/muk"],
      [second, "/direct-price"],
    ] as const) {
      await link.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(link).toBeFocused();
      expect(
        await link.evaluate((element) => {
          const styles = getComputedStyle(element);
          return {
            style: styles.outlineStyle,
            width: Number.parseFloat(styles.outlineWidth),
            offset: Number.parseFloat(styles.outlineOffset),
          };
        }),
      ).toMatchObject({ style: "solid", width: 3, offset: 4 });

      await page.keyboard.press("Enter");
      await expect
        .poll(() => page.locator("body").getAttribute("data-last-homepage-activation"))
        .toBe(destination);
    }
  });

  test("retained homepage effects stop under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const retainedEffects = [
      [".wf-hero-glow", 1],
      [".wf-frame-enter", 1],
      [".wf-bramble-motion", 1],
      [".wf-cooper-motion", 1],
      [".wf-pip-motion", 1],
      [".wf-dust", 3],
    ] as const;

    for (const [selector, count] of retainedEffects) {
      const effects = page.locator(selector);
      await expect(effects).toHaveCount(count);
      const animationNames = await effects.evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).animationName),
      );
      expect(animationNames).toEqual(Array.from({ length: count }, () => "none"));
    }
  });
});
