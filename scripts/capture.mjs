import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
await mkdir("qa-screenshots", { recursive: true });

for (const viewport of [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "tablet", width: 1024, height: 1200 },
  { name: "mobile", width: 390, height: 1100 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.screenshot({ path: `qa-screenshots/${viewport.name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${viewport.name} has horizontal overflow of ${overflow}px`);
  await page.close();
}

await browser.close();
