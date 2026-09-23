import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
await mkdir("qa-screenshots", { recursive: true });

for (const viewport of [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "tablet", width: 1024, height: 1200 },
  { name: "mobile", width: 390, height: 1100 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.screenshot({ path: `qa-screenshots/${viewport.name}.png`, fullPage: true });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `${viewport.name} has horizontal overflow of ${overflow}px`);

  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

for (const id of ["how-it-works", "visma-net", "security", "pricing"]) {
  assert((await page.locator(`#${id}`).count()) === 1, `Missing navigation target #${id}`);
}

const orders = page.getByRole("spinbutton", { name: "Orders per day", exact: true });
const minutes = page.locator("label.calc-field").filter({ hasText: "Average entry time" }).locator("input");
const days = page.getByRole("spinbutton", { name: "Working days / month", exact: true });
await orders.fill("30");
await minutes.fill("6");
await days.fill("20");
await page.waitForTimeout(50);
assert(
  await page.getByText("60 hours / month", { exact: true }).isVisible(),
  "ROI manual-hours calculation did not update correctly",
);
assert(
  await page.getByText("48 hours saved / month", { exact: true }).isVisible(),
  "ROI saved-hours calculation did not update correctly",
);

const demoButton = page.getByRole("button", { name: "Book a demo" }).first();
await demoButton.focus();
await page.keyboard.press("Enter");
const dialog = page.getByRole("dialog");
assert(await dialog.isVisible(), "Pilot dialog did not open from keyboard");
await page.waitForTimeout(30);
assert(
  await page.getByLabel("Work email").evaluate((element) => element === document.activeElement),
  "Pilot dialog did not move focus to the first field",
);
await page.keyboard.press("Escape");
assert(!(await dialog.isVisible()), "Escape did not close the pilot dialog");

await demoButton.click();
await page.getByLabel("Work email").fill("buyer@example.com");
await page.getByLabel("Company").fill("Nordic Wholesale Oy");
await page.getByLabel("ERP").fill("Visma Net");
await page.getByLabel("Approximate orders per day").fill("60");
await page.getByRole("button", { name: "Request pilot" }).click();
assert(
  await page.getByText("Pilot request form is ready for backend connection. No data was sent from this marketing site.").isVisible(),
  "Pilot form did not reach the explicit frontend-only success state",
);
await page.getByRole("button", { name: "Close", exact: true }).click();
assert(!(await dialog.isVisible()), "Pilot dialog did not close after the success state");

await page.close();
await browser.close();
