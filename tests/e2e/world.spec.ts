import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("first session explores live World without onboarding, searches global cities and previews honestly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The world, right now." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How was your day?" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Live world", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("The first window is yours to open.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/v2-world-live.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Product preview", exact: true })
    .first()
    .click();
  await expect(page.locator(".preview-banner")).toContainText(
    "fictional product preview",
  );
  await expect(page.locator(".moment-card")).toHaveCount(4);
  await page.screenshot({
    path: "artifacts/v2-world-preview.png",
    fullPage: true,
  });
  await page.getByLabel("Search cities").fill("Edmonton");
  await expect(page.locator(".city-card")).toHaveCount(1);
  await page.locator(".city-card").click();
  await expect(page.getByRole("heading", { name: "Edmonton." })).toBeVisible();
  await expect(
    page.getByText("Not enough local Moments yet.", { exact: true }),
  ).toBeVisible();
  await page.goto("/city/tokyo-jp?mode=preview");
  await expect(page.locator(".moment-card")).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/v2-city-tokyo.png",
    fullPage: true,
  });
});
test("private feeling Moment defaults private, stays out of World, and can be exported and deleted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add moment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Who is this moment for?")).toHaveValue(
    "private",
  );
  await dialog.getByLabel("City", { exact: true }).selectOption("mumbai-in");
  await dialog.getByRole("button", { name: "Peaceful", exact: true }).click();
  await page.screenshot({ path: "artifacts/v2-add-moment.png" });
  await dialog
    .getByRole("button", { name: "Save only for me", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Saved just for you. Nothing was published.",
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await expect(page.locator(".moment-card")).toHaveCount(0);
  await page.goto("/me");
  await page.getByRole("button", { name: "Discover mine" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start with today" }).click();
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  await expect(page.locator(".private-moment-grid article")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my Moments" }).click();
  const data = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(data.privateMoments[0].feeling).toBe("peaceful");
  expect(data.publicSubmissions).toEqual([]);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete moment", exact: true })
    .click();
  await expect(page.locator(".private-moment-grid article")).toHaveCount(0);
});
test("private photo/caption encryption, invalid image and authenticated public posting boundaries", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add moment", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("City", { exact: true }).selectOption("tokyo-jp");
  await d.locator("input[type=file]").setInputFiles({
    name: "fake.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(d.getByRole("alert")).toContainText("valid");
  await d.locator("input[type=file]").setInputFiles("public/icon-192.png");
  await expect(d.locator(".selected-photo img")).toBeVisible();
  await d
    .getByLabel("A few words, only if you want", { exact: true })
    .fill("PRIVATE V2 ENCRYPTED CAPTION");
  await d
    .getByLabel("Vault passphrase", { exact: false })
    .fill("a long private moment passphrase");
  await d
    .getByRole("button", { name: "Save only for me", exact: true })
    .click();
  await expect(
    d.getByRole("heading", {
      name: "Saved just for you. Nothing was published.",
    }),
  ).toBeVisible();
  const storage = await page.evaluate(
    async () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open("moon-private-moments-v2");
        request.onsuccess = () => {
          const r = request.result
            .transaction("moments")
            .objectStore("moments")
            .getAll();
          r.onsuccess = () => {
            resolve(JSON.stringify(r.result));
            request.result.close();
          };
        };
      }),
  );
  expect(JSON.parse(storage)).toHaveLength(1);
  expect(JSON.parse(storage)[0].cipher).toBeTruthy();
  expect(storage).not.toContain("PRIVATE V2 ENCRYPTED CAPTION");
  expect(storage).not.toContain("data:image");
  await d.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "Add moment", exact: true }).click();
  await d.getByLabel("Who is this moment for?").selectOption("global");
  await d.getByLabel("City", { exact: true }).selectOption("tokyo-jp");
  await d.getByRole("button", { name: "Calm", exact: true }).click();
  await expect(
    d.getByRole("button", { name: "Submit for moderation" }),
  ).toBeDisabled();
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Submit for moderation" }).click();
  await expect(d.getByRole("alert")).toContainText("connected account service");
});
test("share cards exclude private information and include preview disclosure", async ({
  page,
}) => {
  await page.goto("/?mode=preview");
  await page
    .getByRole("button", { name: "Share today’s question", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(d).toContainText(
    "Your private feelings, photos and notes are never included",
  );
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "Download share card" }).click();
  const result = await download;
  expect(result.suggestedFilename()).toMatch(/\.png$/);
  const file = await readFile((await result.path())!);
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  await result.saveAs("artifacts/v2-share-card.png");
});
test("320px World and Arabic RTL support browsing and accessible dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/?mode=preview");
  await expect(page.locator(".moment-card")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/v2-world-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Language", { exact: true }).selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "العالم، الآن." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/v2-world-rtl.png", fullPage: true });
  await page.getByRole("button", { name: "أضف لحظة", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
