// Optional asset authoring tool. Pass the path to an external Playwright installation.
import { pathToFileURL, fileURLToPath } from "node:url";
const modulePath = process.argv[2];
if (!modulePath)
  throw new Error(
    "Usage: node web/scripts/render-share.mjs /absolute/path/to/playwright/index.mjs",
  );
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(new URL("../share-card.html", import.meta.url).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL("../public/share.png", import.meta.url)),
  });
} finally {
  await browser.close();
}
