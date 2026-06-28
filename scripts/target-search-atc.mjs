/** Search Target and capture cart_items POST on first shippable ATC. */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "/workspace/research/target-live/atc-network.json";
mkdirSync("/workspace/research/target-live", { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
  ],
});

const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => false });
});

await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
);
await page.setViewport({ width: 1440, height: 900 });

const captured = { cartPosts: [], cartResponses: [], allCart: [] };
page.on("request", (req) => {
  const url = req.url();
  if (!url.includes("carts.target.com")) return;
  const entry = {
    method: req.method(),
    url,
    headers: req.headers(),
    postData: req.postData() ?? null,
  };
  captured.allCart.push({ type: "request", ...entry });
  if (req.method() === "POST") captured.cartPosts.push(entry);
});

page.on("response", async (res) => {
  const url = res.url();
  if (!url.includes("carts.target.com")) return;
  let body = null;
  try {
    body = await res.text();
  } catch {}
  const item = { type: "response", status: res.status(), url, body: body?.slice(0, 5000) };
  captured.allCart.push(item);
  if (res.request().method() === "POST") captured.cartResponses.push(item);
});

await page.goto("https://www.target.com/s?searchTerm=scotch+tape", {
  waitUntil: "networkidle2",
  timeout: 90000,
});
await new Promise((r) => setTimeout(r, 3000));

const productLink = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[data-test="product-title"], a[href*="/p/"]')];
  for (const a of links) {
    const href = a.getAttribute("href");
    if (href && /\/p\/.+\/A-\d+/.test(href)) {
      return href.startsWith("http") ? href : `https://www.target.com${href}`;
    }
  }
  return null;
});

if (!productLink) {
  console.error("No product link on search page");
  await browser.close();
  process.exit(1);
}

console.log("PDP:", productLink);
await page.goto(productLink, { waitUntil: "networkidle2", timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

const tcin = productLink.match(/A-(\d+)/)?.[1] ?? null;

const dom = await page.evaluate((tcinArg) => {
  const id = tcinArg ? `addToCartButtonOrTextIdFor${tcinArg}` : null;
  const main = id ? document.getElementById(id) : null;
  const scope = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"]');
  return {
    url: location.href,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim(),
    mainBtn: main
      ? {
          id: main.id,
          dataTest: main.getAttribute("data-test"),
          disabled: main.disabled,
          text: main.textContent?.trim(),
          aria: main.getAttribute("aria-label"),
        }
      : null,
    fulfillmentButtons: scope
      ? [...scope.querySelectorAll("button")].map((b) => ({
          id: b.id,
          dataTest: b.getAttribute("data-test"),
          disabled: b.disabled,
          text: b.textContent?.trim().slice(0, 60),
        }))
      : [],
    qty: [...document.querySelectorAll("[data-test*='quantity'], select[name*='quantity']")].map(
      (el) => ({
        tag: el.tagName,
        dataTest: el.getAttribute("data-test"),
        name: el.getAttribute("name"),
      }),
    ),
    cartAria: document.querySelector('[data-test="@web/CartLink"]')?.getAttribute("aria-label"),
    oos: document.querySelector('[data-test="outOfStockMessage"]')?.textContent?.trim(),
  };
}, tcin);

console.log("DOM:", JSON.stringify(dom, null, 2));

// Select shipping if tabs exist
const hasShippingTab = await page.$('button[data-test="fulfillment-cell-shipping"]');
if (hasShippingTab) {
  await page.click('button[data-test="fulfillment-cell-shipping"]');
  await new Promise((r) => setTimeout(r, 2000));
}

const shipIt = await page.$('button[data-test="shipItButton"]:not([disabled])');
if (shipIt) {
  await shipIt.click();
  await new Promise((r) => setTimeout(r, 1000));
}

const beforeCart = dom.cartAria;
const btnSel = tcin ? `#addToCartButtonOrTextIdFor${tcin}` : null;
let clickMethod = "none";

if (btnSel) {
  const state = await page.evaluate((sel) => {
    const b = document.querySelector(sel);
    return b instanceof HTMLButtonElement
      ? { exists: true, disabled: b.disabled, text: b.textContent?.trim() }
      : { exists: false };
  }, btnSel);

  console.log("Button state:", state);
  if (state.exists && !state.disabled) {
    await page.click(btnSel);
    clickMethod = "click";
    await new Promise((r) => setTimeout(r, 8000));
  }
}

const after = await page.evaluate(() => ({
  cartAria: document.querySelector('[data-test="@web/CartLink"]')?.getAttribute("aria-label"),
  success: !!document.querySelector('[data-test*="addToCartSuccess"]'),
  stickyText: document
    .querySelector('[data-test="StickyAddToCartFulfillmentSection"]')
    ?.textContent?.trim()
    .slice(0, 100),
}));

const apiProbe = await page.evaluate(async (tcinArg, key) => {
  if (!tcinArg) return null;
  const url = `https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART%2CCART_ITEMS%2CSUMMARY&key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-application-name": "web",
    },
    credentials: "include",
    body: JSON.stringify({
      cart_item: { item_channel_id: "10", tcin: tcinArg, quantity: 1 },
      cart_type: "REGULAR",
      channel_id: "10",
      shopping_context: "DIGITAL",
    }),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text.slice(0, 4000) };
}, tcin, "9f36aeafbe60771e321a7cc95a78140772ab3e96");

const result = { productLink, tcin, dom, clickMethod, beforeCart, after, captured, apiProbe };
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`cart POSTs: ${captured.cartPosts.length}`);
console.log(`API probe: ${apiProbe?.status}`);
await browser.close();
