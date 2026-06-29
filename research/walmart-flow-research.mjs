/**
 * Walmart.com guest purchase flow research script.
 * Captures URLs, DOM selectors, network, storage, WebSockets for recorder gap analysis.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dirname, "walmart-research-output");
mkdirSync(OUT_DIR, { recursive: true });

const findings = {
  steps: [],
  network: [],
  graphqlOps: new Set(),
  wsConnections: [],
  storage: { localStorage: {}, sessionStorage: {} },
  cookies: [],
  selectors: { atc: [], checkout: [], queue: [], variants: [], other: [] },
  nextData: [],
  jsonLd: [],
  thirdPartyHosts: new Set(),
  errors: [],
  iframes: [],
  shadowDom: [],
  serviceWorkers: [],
};

function addStep(name, url, extra = {}) {
  findings.steps.push({ name, url, timestamp: new Date().toISOString(), ...extra });
  console.log(`[STEP] ${name}: ${url}`);
}

function categorizeHost(url) {
  try {
    const host = new URL(url).hostname;
    if (!host.includes("walmart.com") && !host.includes("walmartimages.com")) {
      findings.thirdPartyHosts.add(host);
    }
    return host;
  } catch {
    return null;
  }
}

async function collectDom(page, label) {
  return page.evaluate((label) => {
    const result = {
      label,
      url: location.href,
      title: document.title,
      buttons: [],
      atcCandidates: [],
      dialogs: [],
      forms: [],
      iframes: [],
      shadowHosts: [],
      nextData: null,
      jsonLd: [],
      storageKeys: { local: [], session: [] },
      cookieNames: document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean),
    };

    // Buttons with automation attrs
    for (const el of document.querySelectorAll("button, [role='button'], a[data-automation-id], a[data-testid]")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const entry = {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 80),
        disabled: el.disabled ?? el.getAttribute("aria-disabled") === "true",
        automationId: el.getAttribute("data-automation-id"),
        testId: el.getAttribute("data-testid"),
        ariaLabel: el.getAttribute("aria-label"),
        ariaDisabled: el.getAttribute("aria-disabled"),
        className: (el.className || "").toString().slice(0, 120),
        id: el.id || null,
      };
      result.buttons.push(entry);
      const text = entry.text.toLowerCase();
      const aria = (entry.ariaLabel || "").toLowerCase();
      if (
        text.includes("add to cart") ||
        aria.includes("add to cart") ||
        entry.automationId?.toLowerCase().includes("add-to-cart") ||
        entry.testId?.toLowerCase().includes("add-to-cart")
      ) {
        result.atcCandidates.push(entry);
      }
    }

    // Dialogs
    for (const d of document.querySelectorAll("[role='dialog'], dialog, [data-testid*='modal'], [data-automation-id*='modal']")) {
      result.dialogs.push({
        automationId: d.getAttribute("data-automation-id"),
        testId: d.getAttribute("data-testid"),
        ariaLabel: d.getAttribute("aria-label"),
        htmlSnippet: d.outerHTML.slice(0, 2000),
      });
    }

    // Forms
    for (const f of document.querySelectorAll("form")) {
      result.forms.push({
        action: f.action,
        method: f.method,
        automationId: f.getAttribute("data-automation-id"),
        testId: f.getAttribute("data-testid"),
      });
    }

    // Iframes
    for (const iframe of document.querySelectorAll("iframe")) {
      result.iframes.push({
        src: iframe.src,
        id: iframe.id,
        title: iframe.title,
        automationId: iframe.getAttribute("data-automation-id"),
      });
    }

    // Shadow DOM hosts
    for (const el of document.querySelectorAll("*")) {
      if (el.shadowRoot) {
        result.shadowHosts.push({
          tag: el.tagName.toLowerCase(),
          id: el.id,
          automationId: el.getAttribute("data-automation-id"),
          testId: el.getAttribute("data-testid"),
        });
      }
    }

    // __NEXT_DATA__
    const nextScript = document.getElementById("__NEXT_DATA__");
    if (nextScript?.textContent) {
      try {
        const parsed = JSON.parse(nextScript.textContent);
        result.nextData = {
          page: parsed.page,
          buildId: parsed.buildId,
          keys: Object.keys(parsed.props?.pageProps || {}),
          query: parsed.query,
        };
      } catch {
        result.nextData = { error: "parse failed" };
      }
    }

    // JSON-LD
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        result.jsonLd.push(JSON.parse(s.textContent || ""));
      } catch {
        result.jsonLd.push({ raw: (s.textContent || "").slice(0, 500) });
      }
    }

    // Storage keys
    try {
      result.storageKeys.local = Object.keys(localStorage);
      result.storageKeys.session = Object.keys(sessionStorage);
    } catch {}

    // Variant selectors
    result.variantSelectors = [];
    for (const el of document.querySelectorAll(
      "[data-automation-id*='variant'], [data-testid*='variant'], [data-automation-id*='fulfillment'], [data-testid*='fulfillment'], select, [role='listbox'], [role='radiogroup']"
    )) {
      result.variantSelectors.push({
        tag: el.tagName.toLowerCase(),
        automationId: el.getAttribute("data-automation-id"),
        testId: el.getAttribute("data-testid"),
        ariaLabel: el.getAttribute("aria-label"),
        text: (el.textContent || "").trim().slice(0, 100),
      });
    }

    // Queue indicators
    result.queueIndicators = [];
    for (const el of document.querySelectorAll(
      "[data-automation-id*='queue'], [data-testid*='queue'], [class*='queue'], [id*='queue']"
    )) {
      result.queueIndicators.push({
        tag: el.tagName.toLowerCase(),
        automationId: el.getAttribute("data-automation-id"),
        testId: el.getAttribute("data-testid"),
        text: (el.textContent || "").trim().slice(0, 200),
      });
    }

    return result;
  }, label);
}

async function waitForStable(page, ms = 2000) {
  await page.waitForTimeout(ms);
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {}
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    permissions: ["geolocation"],
  });

  const page = await context.newPage();

  // Network interception
  page.on("request", (req) => {
    const url = req.url();
    const host = categorizeHost(url);
    const entry = {
      method: req.method(),
      url,
      host,
      resourceType: req.resourceType(),
      headers: {
        "x-o-correlation-id": req.headers()["x-o-correlation-id"],
        "x-o-platform": req.headers()["x-o-platform"],
        "x-o-segment": req.headers()["x-o-segment"],
        "wm_qos.correlation_id": req.headers()["wm_qos.correlation_id"],
        "x-apollo-operation-name": req.headers()["x-apollo-operation-name"],
      },
    };
    if (
      url.includes("graphql") ||
      url.includes("/orchestra/") ||
      url.includes("/api/") ||
      url.includes("walmart.com")
    ) {
      findings.network.push(entry);
    }
    const opName = req.headers()["x-apollo-operation-name"];
    if (opName) findings.graphqlOps.add(opName);
    if (req.postData()) {
      const body = req.postData();
      if (body.includes("operationName")) {
        try {
          const parsed = JSON.parse(body);
          if (parsed.operationName) findings.graphqlOps.add(parsed.operationName);
        } catch {
          const m = body.match(/"operationName"\s*:\s*"([^"]+)"/);
          if (m) findings.graphqlOps.add(m[1]);
        }
      }
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("walmart.com") && !url.includes("graphql") && !url.includes("orchestra")) return;
    const req = res.request();
    if (req.method() === "OPTIONS") return;
    const ct = res.headers()["content-type"] || "";
    if (url.includes("graphql") || url.includes("orchestra") || url.includes("/api/")) {
      let bodyPreview = null;
      if (ct.includes("json") && res.status() < 400) {
        try {
          const text = await res.text();
          bodyPreview = text.slice(0, 500);
        } catch {}
      }
      findings.network.push({
        type: "response",
        status: res.status(),
        url,
        contentType: ct,
        bodyPreview,
        correlationId: res.headers()["x-o-correlation-id"] || res.headers()["wm_qos.correlation_id"],
      });
    }
  });

  page.on("websocket", (ws) => {
    findings.wsConnections.push({ url: ws.url(), openedAt: new Date().toISOString() });
    ws.on("framereceived", (f) => {
      findings.wsConnections.push({
        url: ws.url(),
        direction: "received",
        payload: typeof f.payload === "string" ? f.payload.slice(0, 500) : "[binary]",
      });
    });
    ws.on("framesent", (f) => {
      findings.wsConnections.push({
        url: ws.url(),
        direction: "sent",
        payload: typeof f.payload === "string" ? f.payload.slice(0, 500) : "[binary]",
      });
    });
  });

  try {
    // 1. Homepage
    await page.goto("https://www.walmart.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForStable(page, 3000);
    addStep("homepage", page.url());
    let dom = await collectDom(page, "homepage");
    writeFileSync(join(OUT_DIR, "01-homepage.json"), JSON.stringify(dom, null, 2));

    // Handle location/zip modal if present
    try {
      const zipInput = page.locator('input[aria-label*="zip"], input[placeholder*="zip" i], input[name*="zip"]').first();
      if (await zipInput.isVisible({ timeout: 3000 })) {
        await zipInput.fill("72712");
        const submit = page.locator('button:has-text("Shop"), button:has-text("Continue"), button[type="submit"]').first();
        if (await submit.isVisible({ timeout: 2000 })) await submit.click();
        await waitForStable(page, 2000);
        addStep("location_set", page.url(), { zip: "72712" });
      }
    } catch {}

    // Dismiss any overlays
    for (const sel of [
      'button[aria-label="Close"]',
      'button:has-text("Continue shopping")',
      '[data-automation-id="close-button"]',
      'button:has-text("Maybe later")',
    ]) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) await btn.click();
      } catch {}
    }

    // 2. Search
    const searchSelectors = [
      'input[data-automation-id="search-input"]',
      'input[aria-label="Search"]',
      'input[type="search"]',
      '[data-testid="search-input"]',
    ];
    let searched = false;
    for (const sel of searchSelectors) {
      try {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill("paper towels");
          await input.press("Enter");
          searched = true;
          break;
        }
      } catch {}
    }
    if (!searched) {
      await page.goto("https://www.walmart.com/search?q=paper+towels", { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await waitForStable(page, 4000);
    addStep("search_results", page.url());
    dom = await collectDom(page, "search_results");
    writeFileSync(join(OUT_DIR, "02-search.json"), JSON.stringify(dom, null, 2));

    // 3. Click first in-stock product
    const productLinkSelectors = [
      '[data-automation-id="product-title"] a',
      '[data-testid="product-title"] a',
      'a[link-identifier="itemClick"]',
      '[data-item-id] a[href*="/ip/"]',
      'div[data-item-id] a',
    ];
    let clickedProduct = false;
    for (const sel of productLinkSelectors) {
      try {
        const link = page.locator(sel).first();
        if (await link.isVisible({ timeout: 3000 })) {
          const href = await link.getAttribute("href");
          await link.click();
          clickedProduct = true;
          addStep("product_click", href);
          break;
        }
      } catch {}
    }
    if (!clickedProduct) {
      // fallback: navigate to known cheap item
      await page.goto("https://www.walmart.com/ip/Mainstays-Plastic-Hanger-10-Pack/10452410", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      addStep("product_fallback", page.url());
    }
    await waitForStable(page, 4000);
    addStep("pdp", page.url());
    dom = await collectDom(page, "pdp");
    writeFileSync(join(OUT_DIR, "03-pdp.json"), JSON.stringify(dom, null, 2));
    if (dom.atcCandidates.length) findings.selectors.atc.push(...dom.atcCandidates);

    // 4. Add to cart
    const atcSelectors = [
      '[data-automation-id="add-to-cart-button"]',
      '[data-testid="add-to-cart-button"]',
      'button:has-text("Add to cart")',
      '[aria-label*="Add to cart"]',
      'button[data-automation-id*="add-to-cart"]',
    ];
    let atcClicked = false;
    for (const sel of atcSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          const disabled = await btn.isDisabled().catch(() => false);
          findings.selectors.atc.push({ selector: sel, disabled, url: page.url() });
          if (!disabled) {
            await btn.click();
            atcClicked = true;
            break;
          }
        }
      } catch {}
    }
    await waitForStable(page, 4000);
    addStep("post_atc", page.url(), { atcClicked });
    dom = await collectDom(page, "post_atc");
    writeFileSync(join(OUT_DIR, "04-post-atc.json"), JSON.stringify(dom, null, 2));

    // PAC page handling
    if (page.url().includes("/pac") || page.url().includes("protect-your-purchase")) {
      addStep("pac_page", page.url());
      // Try continue to cart / checkout
      for (const sel of [
        'a[href*="/cart"]',
        'button:has-text("View cart")',
        'button:has-text("Continue")',
        'button:has-text("No thanks")',
        '[data-automation-id="view-cart-button"]',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await waitForStable(page, 2000);
            break;
          }
        } catch {}
      }
    }

    // 5. Cart page
    await page.goto("https://www.walmart.com/cart", { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForStable(page, 4000);
    addStep("cart", page.url());
    dom = await collectDom(page, "cart");
    writeFileSync(join(OUT_DIR, "05-cart.json"), JSON.stringify(dom, null, 2));

    // Checkout button
    const checkoutSelectors = [
      '[data-automation-id="checkout-button"]',
      '[data-testid="checkout-button"]',
      'button:has-text("Continue to checkout")',
      'button:has-text("Start checkout")',
      'a[href*="/checkout"]',
      '[data-automation-id="continue-checkout"]',
    ];
    for (const sel of checkoutSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          findings.selectors.checkout.push({ selector: sel, text: await btn.textContent(), url: page.url() });
          await btn.click();
          await waitForStable(page, 5000);
          addStep("checkout_click", page.url());
          break;
        }
      } catch {}
    }
    dom = await collectDom(page, "checkout");
    writeFileSync(join(OUT_DIR, "06-checkout.json"), JSON.stringify(dom, null, 2));

    // Guest checkout path
    for (const sel of [
      'button:has-text("Continue as guest")',
      'button:has-text("Guest checkout")',
      'a:has-text("Continue as guest")',
      '[data-automation-id="guest-checkout"]',
      'button:has-text("Check out as guest")',
    ]) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          await waitForStable(page, 4000);
          addStep("guest_checkout", page.url());
          break;
        }
      } catch {}
    }
    dom = await collectDom(page, "guest_checkout");
    writeFileSync(join(OUT_DIR, "07-guest-checkout.json"), JSON.stringify(dom, null, 2));

    // Collect final storage
    const storage = await page.evaluate(() => ({
      localStorage: Object.fromEntries(
        Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)?.slice(0, 200) ?? null])
      ),
      sessionStorage: Object.fromEntries(
        Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)?.slice(0, 200) ?? null])
      ),
    }));
    findings.storage = storage;

    findings.cookies = (await context.cookies()).map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));

    // Service workers
    try {
      const sw = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return [];
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.map((r) => ({ scope: r.scope, scriptURL: r.active?.scriptURL }));
      });
      findings.serviceWorkers = sw;
    } catch {}

    // Queue URL probe (public patterns)
    const queueUrls = [
      "https://www.walmart.com/queue",
      "https://www.walmart.com/waiting-room",
      "https://www.walmart.com/early-access",
    ];
    for (const qUrl of queueUrls) {
      try {
        const resp = await page.goto(qUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        addStep("queue_probe", page.url(), { status: resp?.status() });
        dom = await collectDom(page, `queue_${qUrl}`);
        if (dom.queueIndicators?.length) findings.selectors.queue.push(...dom.queueIndicators);
      } catch (e) {
        findings.errors.push({ url: qUrl, error: String(e) });
      }
    }

    // OOS product probe
    await page.goto("https://www.walmart.com/search?q=ps5+console", { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForStable(page, 3000);
    try {
      const link = page.locator('a[href*="/ip/"]').first();
      if (await link.isVisible({ timeout: 3000 })) await link.click();
      await waitForStable(page, 3000);
      addStep("oos_pdp_probe", page.url());
      dom = await collectDom(page, "oos_pdp");
      writeFileSync(join(OUT_DIR, "08-oos-pdp.json"), JSON.stringify(dom, null, 2));
    } catch {}

  } catch (err) {
    findings.errors.push({ fatal: String(err), stack: err.stack });
    console.error("Fatal:", err);
  }

  // Summarize network by host/path
  const networkSummary = {};
  for (const n of findings.network) {
    if (!n.url) continue;
    try {
      const u = new URL(n.url);
      const key = `${u.hostname}${u.pathname.split("/").slice(0, 4).join("/")}`;
      networkSummary[key] = (networkSummary[key] || 0) + 1;
    } catch {}
  }

  const report = {
    steps: findings.steps,
    graphqlOps: [...findings.graphqlOps].sort(),
    networkSummary,
    networkSample: findings.network.slice(0, 200),
    wsConnections: findings.wsConnections,
    storage: findings.storage,
    cookies: findings.cookies,
    selectors: findings.selectors,
    thirdPartyHosts: [...findings.thirdPartyHosts].sort(),
    serviceWorkers: findings.serviceWorkers,
    errors: findings.errors,
  };

  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log("Steps:", findings.steps.length);
  console.log("GraphQL ops:", findings.graphqlOps.size);
  console.log("Network entries:", findings.network.length);
  console.log("WebSockets:", findings.wsConnections.length);
  console.log("Third-party hosts:", findings.thirdPartyHosts.size);
  console.log("Output:", OUT_DIR);

  await browser.close();
}

main().catch(console.error);
