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

test.describe("public homepage regression boundary", () => {
  test.beforeEach(async ({ page }) => {
    const state = defaultMockState();
    await installStaticBuild(page);
    await installProductApiMocks(page, state);
    (page as unknown as { __homepageMockState: typeof state }).__homepageMockState = state;
  });

  test("contains the page at narrow and wide viewports without obscuring its content", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "narrow") {
      await page.setViewportSize({ width: 320, height: 720 });
    }
    await page.goto("/");

    const expectedWidth = testInfo.project.name === "narrow" ? 320 : 1280;
    expect(page.viewportSize()?.width).toBe(expectedWidth);
    await expect(page.getByRole("main", { name: "Whisky Frog" })).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    for (const name of characterNames) {
      const image = page.getByRole("img", { name });
      await expect(image).toHaveCount(1);
      await expect(image).toBeVisible();
      expect(
        await image.evaluate((element) => {
          const imageElement = element as HTMLImageElement;
          const imageRect = imageElement.getBoundingClientRect();
          const frameRect = imageElement.parentElement?.parentElement?.getBoundingClientRect();
          return (
            imageElement.complete &&
            imageElement.naturalWidth > 0 &&
            imageRect.width > 0 &&
            imageRect.height > 0 &&
            frameRect !== undefined &&
            imageRect.right > frameRect.left &&
            imageRect.left < frameRect.right &&
            imageRect.bottom > frameRect.top &&
            imageRect.top < frameRect.bottom
          );
        }),
      ).toBe(true);
    }

    const stickyNav = page.getByRole("navigation").first();
    for (const link of [marketLink(page), directPriceLink(page)]) {
      await expect(link).toBeVisible();
      await link.scrollIntoViewIfNeeded();
      expect(
        await link.evaluate((element, nav) => {
          const rect = element.getBoundingClientRect();
          const navRect = (nav as Element).getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= navRect.bottom &&
            (hit === element || element.contains(hit))
          );
        }, await stickyNav.elementHandle()),
      ).toBe(true);
    }

    const state = (
      page as unknown as {
        __homepageMockState: ReturnType<typeof defaultMockState>;
      }
    ).__homepageMockState;
    await expect.poll(() => requestsMatching(state, "/api/markets").length).toBe(1);
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
