// Production-export interaction checks. Wallets, API data and RPC responses are test doubles.
// No account is controlled and no transaction is broadcast by this script.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const modulePath = process.argv[2];
if (!modulePath)
  throw new Error("Pass an absolute path to an external Playwright index.mjs");
const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
const { default: AxeBuilder } = await import(
  pathToFileURL(
    resolve(modulePath, "..", "..", "@axe-core/playwright/dist/index.mjs"),
  ).href
);
const fixtures = JSON.parse(
  await readFile(new URL("./fixtures.json", import.meta.url), "utf8"),
);
const root = resolve("dist");
const scratch = resolve("test/scratch/interactions");
await mkdir(scratch, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const suffix = decodeURIComponent(url.pathname).replace(/^\/preview\//, "");
  const file = resolve(root, suffix || "index.html");
  if (!url.pathname.startsWith("/preview/") || !file.startsWith(root + "/")) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const data = await readFile(file);
    response.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Missing file");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const mockHash =
  "0x" +
  createHash("sha256")
    .update("squeekstage interaction test transaction")
    .digest("hex");
const blockHash =
  "0x" +
  createHash("sha256")
    .update("squeekstage interaction test block")
    .digest("hex");
const results = [];
let failures = 0;
async function test(name, callback) {
  try {
    const details = await callback();
    results.push({ name, passed: true, details });
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    results.push({ name, passed: false, error: error.stack });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}
async function eventually(callback, message, timeout = 10000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    try {
      const result = await callback();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(message || String(last) || "Condition did not become true");
}
async function mockSources(context, behavior = {}) {
  await context.route("https://api.squeekchain.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (behavior.offline) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
      return;
    }
    const key =
      path === "/v1/core"
        ? "core"
        : path === "/v1/economy/state"
          ? "economy"
          : path === "/v1/measurement/stats"
            ? "stats"
            : path === "/v1/events"
              ? "events"
              : "status";
    const data =
      key === "status"
        ? {
            measurement: {
              freshness: "online",
              observedAt: new Date().toISOString(),
              staleAfterSeconds: 120,
            },
          }
        : structuredClone(fixtures[key]);
    if (behavior.wrongTokenChain && key === "economy") data.chain.chainId = "1";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await context.route(
    /https:\/\/(ethereum-sepolia-rpc\.publicnode\.com|1rpc\.io)\/.*/,
    async (route) => {
      const body = route.request().postDataJSON();
      function rpc(request) {
        let result = null;
        if (request.method === "eth_chainId") result = "0xaa36a7";
        else if (request.method === "eth_blockNumber") result = "0xb791f0";
        else if (request.method === "eth_call")
          result = "0x" + (1000n * 10n ** 18n).toString(16).padStart(64, "0");
        else if (request.method === "eth_getLogs") result = [];
        else if (request.method === "eth_getTransactionReceipt")
          result = behavior.pending
            ? null
            : {
                transactionHash: mockHash,
                transactionIndex: "0x0",
                blockHash,
                blockNumber: "0xb791f0",
                from: fixtures.account,
                to: fixtures.economy.asset.address,
                cumulativeGasUsed: "0x10000",
                gasUsed: "0x10000",
                contractAddress: null,
                logs: [],
                logsBloom: "0x" + "00".repeat(256),
                status: behavior.reverted ? "0x0" : "0x1",
                effectiveGasPrice: "0x3b9aca00",
                type: "0x2",
              };
        return { jsonrpc: "2.0", id: request.id, result };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(Array.isArray(body) ? body.map(rpc) : rpc(body)),
      });
    },
  );
}
async function addWallet(context, { chain = "0x1" } = {}) {
  await context.addInitScript(
    ({ account, hash, chain }) => {
      const listeners = new Map();
      window.__mock = {
        chain,
        calls: [],
        reject: false,
        connected: localStorage.getItem("squeekstage:test-connected") === "1",
      };
      const provider = {
        on(event, callback) {
          const list = listeners.get(event) ?? [];
          list.push(callback);
          listeners.set(event, list);
        },
        removeListener(event, callback) {
          listeners.set(
            event,
            (listeners.get(event) ?? []).filter((item) => item !== callback),
          );
        },
        async request({ method, params }) {
          window.__mock.calls.push({ method, params });
          if (method === "eth_chainId") return window.__mock.chain;
          if (method === "eth_accounts")
            return window.__mock.connected ? [account] : [];
          if (method === "eth_requestAccounts") {
            if (window.__mock.reject) {
              const error = new Error("User rejected request");
              error.code = 4001;
              throw error;
            }
            window.__mock.connected = true;
            localStorage.setItem("squeekstage:test-connected", "1");
            return [account];
          }
          if (method === "wallet_switchEthereumChain") {
            window.__mock.chain = params[0].chainId;
            for (const callback of listeners.get("chainChanged") ?? [])
              callback(window.__mock.chain);
            return null;
          }
          if (method === "wallet_addEthereumChain") return null;
          if (
            method === "eth_sendTransaction" ||
            method === "wallet_sendTransaction"
          ) {
            if (window.__mock.reject) {
              const error = new Error("User rejected request");
              error.code = 4001;
              throw error;
            }
            return hash;
          }
          if (method === "eth_estimateGas") return "0x10000";
          if (method === "eth_gasPrice") return "0x3b9aca00";
          const error = new Error("Unsupported method");
          error.code = -32601;
          throw error;
        },
      };
      window.ethereum = provider;
      const icon =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="gold"/></svg>';
      const announce = () => {
        dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "mock-wallet-one",
                name: "Test wallet one",
                rdns: "test.squeekstage.one",
                icon,
              },
              provider,
            },
          }),
        );
        dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "mock-wallet-two",
                name: "Test wallet two",
                rdns: "test.squeekstage.two",
                icon,
              },
              provider,
            },
          }),
        );
      };
      addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { account: fixtures.account, hash: mockHash, chain },
  );
}
async function scan(page, label) {
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(
    resolve(scratch, `${label}-axe.json`),
    JSON.stringify(report.violations, null, 2),
  );
  assert.equal(
    report.violations.length,
    0,
    report.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
  );
}
async function runEngine(engine, name) {
  let browser;
  try {
    browser = await engine.launch({ headless: true });
  } catch (error) {
    results.push({
      name: `${name} launch`,
      passed: false,
      limitation: error.message,
    });
    failures++;
    return;
  }
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const behavior = {};
    await mockSources(context, behavior);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            if (window.__denyCopy) throw new Error("Denied by test");
            window.__copied = value;
          },
        },
      });
    });
    context.setDefaultTimeout(12000);
    const page = await context.newPage();
    const pageErrors = [],
      missing = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        missing.push(response.url());
    });
    await page.goto(base);
    await page.locator(".block-number").filter({ hasText: "4,858" }).waitFor();
    await test(`${name}: first screen, metadata and relative assets`, async () => {
      for (const width of [320, 390, 768, 1000, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `overflow at ${width}`,
        );
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page
          .getByRole("link", { name: "Send a tip", exact: true })
          .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight),
      );
      assert.ok(
        await page
          .locator(".wheel-body")
          .evaluate((el) => el.getBoundingClientRect().top < innerHeight),
      );
      for (const selector of [
        'meta[name="description"]',
        'meta[property="og:title"]',
        'meta[property="og:image"]',
        'link[rel="icon"]',
      ])
        assert.ok(
          await page
            .locator(selector)
            .getAttribute(selector.startsWith("link") ? "href" : "content"),
        );
      const image = await page.request.get(
        new URL(
          await page
            .locator('meta[property="og:image"]')
            .getAttribute("content"),
          base,
        ).href,
      );
      assert.equal(image.status(), 200);
      assert.ok((await image.body()).byteLength > 1000);
      assert.equal(await page.locator("main h1").count(), 1);
      await scan(page, `${name}-overview`);
      await page.screenshot({
        path: resolve(scratch, `${name}-overview-390.png`),
        fullPage: true,
      });
      assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
      assert.equal(missing.length, 0, missing.join("\n"));
    });
    await test(`${name}: expand and collapse on-chain events`, async () => {
      assert.equal(await page.locator(".activity-list li").count(), 5);
      await page.getByRole("button", { name: "Show all 10 events" }).click();
      assert.equal(await page.locator(".activity-list li").count(), 10);
      await page.getByRole("button", { name: "Show fewer events" }).click();
      assert.equal(await page.locator(".activity-list li").count(), 5);
    });
    await test(`${name}: wallet dialog keyboard, backdrop and focus return`, async () => {
      const connect = page.getByRole("button", {
        name: "Connect",
        exact: true,
      });
      await connect.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Coinbase Wallet", exact: true })
          .count(),
        1,
      );
      await scan(page, `${name}-wallet`);
      await page
        .getByRole("button", { name: "Coinbase Wallet", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(
          () => document.activeElement.closest("dialog") !== null,
        ),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(), false);
      assert.equal(
        await connect.evaluate((el) => el === document.activeElement),
        true,
      );
      await connect.click();
      await page.mouse.click(2, 2);
      assert.equal(await page.getByRole("dialog").isVisible(), false);
    });
    let overlayUrl;
    await test(`${name}: setup validation, save, reload and share links`, async () => {
      await page.getByRole("link", { name: "Setup", exact: true }).click();
      await eventually(
        () =>
          page.locator("main").evaluate((el) => el === document.activeElement),
        "Route should focus main after the next animation frame",
      );
      await page
        .getByLabel("Streamer wallet", { exact: true })
        .fill("invalid recipient");
      await page.getByRole("button", { name: "Save settings" }).click();
      assert.equal(
        await page
          .getByLabel("Streamer wallet", { exact: true })
          .getAttribute("aria-invalid"),
        "true",
      );
      assert.equal(
        await page
          .getByLabel("Streamer wallet", { exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page
        .getByLabel("Streamer wallet", { exact: true })
        .fill(fixtures.recipient);
      await page
        .getByLabel("Alert threshold (SQK)", { exact: true })
        .fill("-1");
      await page.getByRole("button", { name: "Save settings" }).click();
      assert.equal(
        await page
          .getByLabel("Alert threshold (SQK)", { exact: true })
          .getAttribute("aria-invalid"),
        "true",
      );
      await page
        .getByLabel("Alert threshold (SQK)", { exact: true })
        .fill("1.5");
      await page.getByLabel("Alert sound", { exact: false }).uncheck();
      await page.getByLabel("Demo tip feed", { exact: false }).check();
      await page.getByRole("button", { name: "Save settings" }).click();
      await page.getByRole("button", { name: "Settings saved" }).waitFor();
      overlayUrl = await page
        .getByLabel("Overlay URL", { exact: true })
        .inputValue();
      const parsed = new URL(overlayUrl);
      assert.equal(parsed.pathname, "/preview/");
      assert.equal(parsed.searchParams.get("streamer"), fixtures.recipient);
      assert.equal(parsed.searchParams.get("sound"), "0");
      assert.equal(parsed.searchParams.get("demo"), "1");
      assert.equal(parsed.searchParams.get("minTip"), "1.5");
      assert.equal(parsed.hash, "#/stage");
      const tip = new URL(
        await page.getByLabel("Tip page URL", { exact: true }).inputValue(),
      );
      assert.equal(tip.searchParams.get("streamer"), fixtures.recipient);
      assert.equal(tip.searchParams.has("demo"), false);
      assert.equal(tip.hash, "#/tip");
      await page.getByRole("button", { name: "Copy for OBS" }).click();
      assert.equal(await page.evaluate(() => window.__copied), overlayUrl);
      await page.evaluate(() => {
        window.__denyCopy = true;
      });
      await page.getByRole("button", { name: "Copy for chat" }).click();
      await page
        .getByText(
          "Clipboard is unavailable. Select and copy the link shown on this page.",
        )
        .waitFor();
      await page.getByRole("button", { name: "Dismiss message" }).click();
      await page.reload();
      assert.equal(
        await page.getByLabel("Streamer wallet", { exact: true }).inputValue(),
        fixtures.recipient,
      );
      assert.equal(
        await page
          .getByLabel("Alert threshold (SQK)", { exact: true })
          .inputValue(),
        "1.5",
      );
      await scan(page, `${name}-setup`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    });
    await test(`${name}: stage test alert, sound toggle and demo pause`, async () => {
      await page.getByRole("link", { name: "Stage", exact: true }).click();
      await page
        .getByRole("button", { name: "Test alert", exact: true })
        .click();
      await page.getByText("Test tip · Preview only").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Sound off" })
          .getAttribute("aria-pressed"),
        "false",
      );
      await page.getByRole("button", { name: "Sound off" }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Sound on" })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        new URL(
          await page.getByLabel("Overlay URL", { exact: true }).inputValue(),
        ).searchParams.get("sound"),
        "1",
      );
      await page.getByRole("button", { name: "Pause demo" }).click();
      await page.getByText("Demo tips paused", { exact: true }).waitFor();
      await scan(page, `${name}-stage`);
      await page.screenshot({
        path: resolve(scratch, `${name}-stage-390.png`),
        fullPage: true,
      });
    });
    await test(`${name}: transparent OBS export and encoded settings`, async () => {
      const overlayPage = await context.newPage();
      await overlayPage.goto(overlayUrl);
      await overlayPage.locator(".broadcast-wheel").waitFor();
      assert.equal(await overlayPage.locator(".site-header").count(), 0);
      assert.equal(await overlayPage.locator(".site-footer").count(), 0);
      assert.equal(
        await overlayPage.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
        "rgba(0, 0, 0, 0)",
      );
      assert.equal(
        await overlayPage.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await overlayPage
          .locator(".stage-canvas")
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue("--overlay-accent").trim(),
          ),
        "#f2c230",
      );
      await overlayPage.setViewportSize({ width: 1920, height: 1080 });
      await overlayPage.screenshot({
        path: resolve(scratch, `${name}-obs-1920.png`),
        omitBackground: true,
      });
      await overlayPage.close();
    });
    await test(`${name}: recipient, amount and disconnected tip flow`, async () => {
      await page.getByRole("link", { name: "Tip", exact: true }).click();
      await page.getByLabel("Streamer wallet", { exact: true }).fill("");
      await page.getByRole("button", { name: "Continue to wallet" }).click();
      assert.equal(
        await page
          .getByLabel("Streamer wallet", { exact: true })
          .getAttribute("aria-invalid"),
        "true",
      );
      await page
        .getByLabel("Streamer wallet", { exact: true })
        .fill(fixtures.recipient);
      await page.getByRole("button", { name: "25 SQK", exact: true }).click();
      assert.equal(
        await page.getByLabel("Tip amount", { exact: true }).inputValue(),
        "25",
      );
      await page
        .getByLabel("Tip amount", { exact: true })
        .fill("1.0000000000000000001");
      await page.getByRole("button", { name: "Continue to wallet" }).click();
      await page.getByText("SQK supports up to 18 decimal places.").waitFor();
      await page.getByLabel("Tip amount", { exact: true }).fill("5");
      await page.getByRole("button", { name: "Continue to wallet" }).click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Continue to wallet" })
        .scrollIntoViewIfNeeded();
      await scan(page, `${name}-tip`);
      await page.screenshot({
        path: resolve(scratch, `${name}-tip-390.png`),
        fullPage: true,
      });
    });
    await test(`${name}: API outage, stale retention and recovery`, async () => {
      behavior.offline = true;
      await page.goto(base);
      await page
        .getByText(
          "Squeekchain data is unavailable. You can still set up your overlay.",
        )
        .waitFor();
      assert.equal(await page.locator(".status-offline").count(), 1);
      assert.equal(await page.locator(".block-number").textContent(), "–");
      behavior.offline = false;
      await page
        .getByRole("button", { name: "Retry data", exact: true })
        .click();
      await page.locator(".status-live").waitFor();
      behavior.offline = true;
      await page.getByRole("link", { name: "Tip", exact: true }).click();
      await page.evaluate(() =>
        document.querySelector(".button-primary")?.focus(),
      );
      await page.getByRole("link", { name: "Overview", exact: true }).click();
      // The next query interval keeps the previous successful snapshot while exposing the source failure.
      await page.locator(".status-stale").waitFor({ timeout: 15000 });
      assert.equal(await page.locator(".block-number").textContent(), "4,858");
      behavior.offline = false;
      await page
        .getByRole("button", { name: "Retry data", exact: true })
        .click();
      await page.locator(".status-live").waitFor();
    });
    await context.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
    });
    await mockSources(mobile);
    const phone = await mobile.newPage();
    await phone.goto(base);
    await test(`${name}: mobile wallet links and Coinbase option`, async () => {
      await phone.getByRole("button", { name: "Connect", exact: true }).click();
      await phone.getByRole("dialog").waitFor();
      for (const wallet of [
        "MetaMask",
        "Coinbase Wallet",
        "Rabby",
        "Phantom",
      ]) {
        const link = phone.getByRole("link", {
          name: `Open in ${wallet}`,
          exact: true,
        });
        assert.ok(await link.getAttribute("href"));
        assert.ok(
          await link
            .locator("img")
            .evaluate((el) => el.complete && el.naturalWidth > 0),
        );
      }
      assert.equal(
        await phone
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await phone
          .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
          .count(),
        1,
      );
      const rect = await phone.getByRole("dialog").boundingBox();
      assert.ok(rect.y + rect.height >= 843);
      assert.ok(rect.width <= 390);
      await phone.screenshot({
        path: resolve(scratch, `${name}-mobile-wallet.png`),
      });
      await scan(phone, `${name}-mobile-wallet`);
    });
    await mobile.close();

    const walletContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const walletBehavior = {};
    await mockSources(walletContext, walletBehavior);
    await addWallet(walletContext);
    walletContext.setDefaultTimeout(12000);
    const wallet = await walletContext.newPage();
    await wallet.goto(`${base}#/tip`);
    await wallet.locator(".amount-presets").waitFor();
    await test(`${name}: EIP-6963 discovery, rejection and Sepolia switching`, async () => {
      await wallet
        .getByRole("button", { name: "Connect", exact: true })
        .click();
      await wallet
        .getByRole("button", { name: "Test wallet one", exact: true })
        .waitFor();
      assert.equal(
        await wallet
          .getByRole("button", { name: "Test wallet two", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await wallet
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        0,
      );
      await wallet.evaluate(() => {
        window.__mock.reject = true;
      });
      await wallet
        .getByRole("button", { name: "Test wallet one", exact: true })
        .click();
      await wallet
        .getByText("You declined the wallet request. You can try again.")
        .waitFor();
      await wallet.evaluate(() => {
        window.__mock.reject = false;
      });
      await wallet
        .getByRole("button", { name: "Test wallet one", exact: true })
        .click();
      await wallet
        .getByRole("button", { name: "Switch to Sepolia", exact: true })
        .waitFor();
      assert.equal(
        await wallet
          .getByRole("button", { name: "Review tip", exact: true })
          .isDisabled(),
        true,
      );
      await wallet
        .getByRole("button", { name: "Wallet options", exact: true })
        .click();
      await wallet
        .getByRole("button", { name: "Disconnect", exact: true })
        .waitFor();
      await wallet.keyboard.press("Escape");
      await wallet
        .getByRole("button", { name: "Switch to Sepolia", exact: true })
        .click();
      await wallet.locator(".connected-wallet").waitFor();
      assert.ok(
        await wallet.evaluate(() =>
          window.__mock.calls.some(
            (call) =>
              call.method === "wallet_switchEthereumChain" &&
              call.params[0].chainId === "0xaa36a7",
          ),
        ),
      );
      assert.equal(
        await wallet.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    });
    await test(`${name}: exact ERC-20 transfer, rejection, success and receipt failure`, async () => {
      await wallet
        .getByLabel("Streamer wallet", { exact: true })
        .fill(fixtures.recipient);
      await wallet.getByLabel("Tip amount", { exact: true }).fill("5.125");
      await wallet
        .getByRole("button", { name: "Review tip", exact: true })
        .click();
      await wallet.getByRole("heading", { name: "Review your tip" }).waitFor();
      assert.ok(
        (
          await wallet.locator(".transfer-review > .address-text").textContent()
        ).toLowerCase() === fixtures.recipient.toLowerCase(),
      );
      await wallet.evaluate(() => {
        window.__mock.reject = true;
      });
      await wallet
        .getByRole("button", { name: "Send tip", exact: true })
        .click();
      await wallet
        .getByText("You declined the wallet request. You can try again.")
        .waitFor();
      await wallet.evaluate(() => {
        window.__mock.reject = false;
      });
      await wallet
        .getByRole("button", { name: "Send tip", exact: true })
        .click();
      await wallet
        .getByText(
          "5.125 SQK confirmed on Sepolia. Thank you for supporting the stream.",
        )
        .waitFor({ timeout: 15000 });
      const sent = await wallet.evaluate(() =>
        window.__mock.calls
          .filter(
            (call) =>
              call.method === "eth_sendTransaction" ||
              call.method === "wallet_sendTransaction",
          )
          .at(-1),
      );
      assert.equal(
        sent.params[0].to.toLowerCase(),
        fixtures.economy.asset.address.toLowerCase(),
      );
      const expected =
        "0xa9059cbb" +
        fixtures.recipient.slice(2).toLowerCase().padStart(64, "0") +
        (5125n * 10n ** 15n).toString(16).padStart(64, "0");
      assert.equal(sent.params[0].data, expected);
      assert.equal(
        await wallet
          .getByRole("link", { name: "View transaction on Sepolia" })
          .getAttribute("href"),
        `https://sepolia.etherscan.io/tx/${mockHash}`,
      );
      walletBehavior.reverted = true;
      await wallet
        .getByRole("button", { name: "Review tip", exact: true })
        .click();
      await wallet
        .getByRole("button", { name: "Send tip", exact: true })
        .click();
      await wallet
        .getByText(
          "The transfer reverted on Sepolia. No SQK was transferred; gas may have been spent.",
        )
        .waitFor({ timeout: 15000 });
      walletBehavior.reverted = false;
    });
    await test(`${name}: pending receipt, duplicate-send guard and recheck`, async () => {
      await wallet
        .getByRole("button", { name: "Edit tip", exact: true })
        .click();
      walletBehavior.pending = true;
      await wallet
        .getByRole("button", { name: "Review tip", exact: true })
        .click();
      await wallet.clock.install();
      await wallet
        .getByRole("button", { name: "Send tip", exact: true })
        .click();
      await wallet
        .getByText("Tip submitted. Waiting for a Sepolia confirmation.")
        .waitFor();
      await wallet.clock.fastForward(91000);
      await wallet
        .getByText(
          "Confirmation is taking longer than expected. Check the transaction before sending again.",
        )
        .waitFor();
      assert.equal(
        await wallet
          .getByRole("button", { name: "Send tip", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await wallet.getByLabel("Tip amount", { exact: true }).isDisabled(),
        true,
      );
      const before = await wallet.evaluate(
        () =>
          window.__mock.calls.filter((call) =>
            /sendTransaction/.test(call.method),
          ).length,
      );
      walletBehavior.pending = false;
      await wallet
        .getByRole("button", { name: "Check confirmation", exact: true })
        .click();
      await wallet
        .getByText(
          "5.125 SQK confirmed on Sepolia. Thank you for supporting the stream.",
        )
        .waitFor();
      assert.equal(
        await wallet.evaluate(
          () =>
            window.__mock.calls.filter((call) =>
              /sendTransaction/.test(call.method),
            ).length,
        ),
        before,
      );
      await wallet.clock.resume();
    });
    await test(`${name}: disconnect returns to the wallet prompt`, async () => {
      await wallet.locator(".connected-wallet").click();
      await wallet
        .getByRole("button", { name: "Disconnect", exact: true })
        .click();
      await wallet
        .getByRole("button", { name: "Connect", exact: true })
        .waitFor();
    });
    await walletContext.close();
  } finally {
    await browser.close();
  }
}
try {
  await runEngine(chromium, "Chromium");
  await runEngine(webkit, "WebKit");
} finally {
  await new Promise((done) => server.close(done));
}
await writeFile(
  resolve(scratch, "results.json"),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(
  `${results.filter((result) => result.passed).length}/${results.length} checks passed`,
);
if (failures) process.exitCode = 1;
