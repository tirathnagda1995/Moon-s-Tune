import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
async function onboard(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover mine" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start with today" }).click();
  await expect(
    page.getByRole("heading", { name: "How was your day?" }),
  ).toBeVisible();
}
test("guest journey: save, reload, edit, history, export and erase", async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.getByRole("button", { name: "Energized", exact: true }).click();
  await page.getByRole("button", { name: "Remember today" }).click();
  await expect(
    page.getByText("A day remembered.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your day is here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open today’s day card" }).click();
  await page.getByRole("button", { name: "Not accurate", exact: true }).click();
  await page.getByRole("button", { name: "Low", exact: true }).first().click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your correction · 100%").first()).toBeVisible();
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  await expect(page.locator(".memory")).toHaveCount(1);
  await page.getByRole("button", { name: "Patterns", exact: true }).click();
  await expect(
    page.getByText("Still getting to know your rhythms."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your space", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/moon-pattern.*json/);
  const data = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(data.observations).toHaveLength(1);
  expect(data.ledger.observation_revisions).toHaveLength(2);
  expect(data.consents[0].purpose).toBe("CORE_APP");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete all history", exact: true })
    .click();
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little space for your days." }),
  ).toBeVisible();
});
test("private note stays encrypted, supports wrong-key error and note-only deletion", async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page
    .getByLabel("Your words, if you want")
    .fill("PRIVATE_TEST_NOTE_秘密");
  await page.getByLabel("Keep a private copy").check();
  await page
    .getByLabel("Vault passphrase")
    .fill("a very private test passphrase");
  await page.getByRole("button", { name: "Remember today" }).click();
  await expect(
    page.getByText("A day remembered.", { exact: true }),
  ).toBeVisible();
  const records = await page.evaluate(
    async () =>
      await new Promise<string>((resolve, reject) => {
        const r = indexedDB.open("moon-pattern-v1");
        r.onsuccess = () => {
          const g = r.result
            .transaction("observations")
            .objectStore("observations")
            .getAll();
          g.onsuccess = () => resolve(JSON.stringify(g.result));
          g.onerror = reject;
        };
      }),
  );
  expect(records).not.toContain("PRIVATE_TEST_NOTE");
  await page
    .getByLabel("Vault passphrase")
    .fill("a different wrong passphrase");
  await page.getByRole("button", { name: "Unlock note", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Could not unlock",
  );
  await page
    .getByLabel("Vault passphrase")
    .fill("a very private test passphrase");
  await page.getByRole("button", { name: "Unlock note", exact: true }).click();
  await expect(
    page.getByText("PRIVATE_TEST_NOTE_秘密", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete only the private note" })
    .click();
  await expect(
    page.getByText("Your private words", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Good", { exact: true })).toBeVisible();
});
test("AI unavailable, mobile 320px and RTL fallback remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await onboard(page);
  await page.getByLabel("Your words, if you want").fill("Happy today");
  await page.getByLabel("Allow AI to process").check();
  await page
    .getByRole("button", { name: "Suggest feelings from my words" })
    .click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "AI is not connected",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/mobile-320.png", fullPage: true });
  await page.getByRole("button", { name: "Your space", exact: true }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "اليوم", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "كيف كان يومك؟" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/rtl-320.png", fullPage: true });
});
test("desktop visual, no browser errors and offline guest use", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await onboard(page);
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How was your day?" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How was your day?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Okay", exact: true }).click();
  await page.getByRole("button", { name: "Remember today" }).click();
  await expect(
    page.getByText("A day remembered.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
