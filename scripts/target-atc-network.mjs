/**
 * Target add-to-cart network capture — finds shippable PDP and clicks ATC.
 */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";

const API_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
const OUT = "/workspace/research/target-live/atc-network.json";

mkdirSync("/workspace/research/target-live", { recursive: true });

async function findShippableTcin(page) {
  const tcins = [
    "14758404", // tide pods
    "13276134",
    "81114595", // ps5 from gist
    "12945916", // oscar mayer from python example
    "16636689",
    "54367689", // band-aid
    "13969767", // clorox wipes
    "13276332", // charmin
    "54394587", // lysol
    "15043095", // kleenex
  ];

  for (const tcin of tcins) {
    const url = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=${API_KEY}&tcin=${tcin}&is_bot=false&store_id=3991&pricing_store_id=3991&has_pricing_store_id=true&has_financing_options=true&include_obsolete=false&skip_personalized=true&skip_variation_hierarchy=true&channel=WEB&page=%2Fp%2FA-${tcin}`;
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, { credentials: "omit" });
      return { ok: r.ok, status: r.status, json: r.ok ? await r.json() : null };
    }, url);

    if (!res.ok || !res.json) continue;

    const product = res.json?.data?.product;
    const title = product?.item?.product_description?.title ?? null;
    const avail =
      product?.fulfillment?.shipping_options?.availability_status ??
      product?.fulfillment?.is_out_of_stock_in_all_store_locations;

    const shippable =
      product?.fulfillment?.shipping_options?.availability_status === "IN_STOCK" ||
      product?.fulfillment?.is_out_of_stock_in_all_store_locations === false;

    console.log(`TCIN ${tcin}: ${title} | shipping=${product?.fulfillment?.shipping_options?.availability_status}`);

    if (shippable && title) {
      return { tcin, title, productUrl: `https://www.target.com/p/-/A-${tcin}` };
    }
  }
  return null;
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
);
await page.setViewport({ width: 1440, height: 900 });

await page.goto("https://www.target.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const pick = await findShippableTcin(page);
if (!pick) {
  console.error("No shippable TCIN found");
  await browser.close();
  process.exit(1);
}

console.log(`\nUsing: ${pick.title} (${pick.tcin})`);

const captured = { cartPosts: [], cartGets: [], allCart: [], errors: [] };

page.on("request", (req) => {
  const url = req.url();
  if (!url.includes("carts.target.com")) return;
  const entry = {
    method: req.method(),
    url,
    headers: req.headers(),
    postData: req.postData() ?? null,
  };
  captured.allCart.push(entry);
  if (req.method() === "POST" && url.includes("cart_items")) captured.cartPosts.push(entry);
  if (req.method() === "GET" && url.includes("/cart")) captured.cartGets.push(entry);
});

page.on("response", async (res) => {
  const url = res.url();
  if (!url.includes("carts.target.com")) return;
  let body = null;
  try {
    body = await res.text();
  } catch {}
  captured.allCart.push({
    type: "response",
    status: res.status(),
    url,
    body: body?.slice(0, 4000) ?? null,
  });
});

await page.goto(pick.productUrl, { waitUntil: "networkidle2", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));

const dom = await page.evaluate((tcin) => {
  const id = `addToCartButtonOrTextIdFor${tcin}`;
  const btn = document.getElementById(id);
  const scope = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"]');
  const buttons = scope
    ? [...scope.querySelectorAll("button")].map((b) => ({
        id: b.id,
        dataTest: b.getAttribute("data-test"),
        disabled: b.disabled,
        text: b.textContent?.trim(),
        aria: b.getAttribute("aria-label"),
      }))
    : [];

  const shipBtn = document.querySelector('button[data-test="fulfillment-cell-shipping"]');
  const shipIt = document.querySelector('button[data-test="shipItButton"]');
  const shippingBtn = document.querySelector('button[data-test="shippingButton"]');

  return {
    mainBtn: btn
      ? {
          id: btn.id,
          dataTest: btn.getAttribute("data-test"),
          disabled: btn.disabled,
          text: btn.textContent?.trim(),
          aria: btn.getAttribute("aria-label"),
        }
      : null,
    buttons,
    shipBtn: shipBtn ? { dataTest: "fulfillment-cell-shipping", text: shipBtn.textContent?.trim() } : null,
    shipIt: shipIt ? { disabled: shipIt.disabled, text: shipIt.textContent?.trim() } : null,
    shippingButton: shippingBtn
      ? { disabled: shippingBtn.disabled, text: shippingBtn.textContent?.trim() }
      : null,
    bodyOos: /out of stock/i.test(document.body.innerText),
    cartAria: document.querySelector('[data-test="@web/CartLink"]')?.getAttribute("aria-label"),
  };
}, pick.tcin);

console.log("DOM:", JSON.stringify(dom, null, 2));

// Select shipping fulfillment if needed
if (dom.shipBtn) {
  try {
    await page.click('button[data-test="fulfillment-cell-shipping"]');
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    captured.errors.push(`ship_tab: ${e}`);
  }
}

// Optional ship it step
const shipItVisible = await page.$('button[data-test="shipItButton"]:not([disabled])');
if (shipItVisible) {
  await shipItVisible.click();
  await new Promise((r) => setTimeout(r, 1000));
}

const beforeCart = await page.evaluate(() =>
  document.querySelector('[data-test="@web/CartLink"]')?.getAttribute("aria-label"),
);

const btnSelector = `#addToCartButtonOrTextIdFor${pick.tcin}`;
let clickMethod = "none";
try {
  await page.waitForSelector(btnSelector, { timeout: 10000 });
  const canClick = await page.evaluate((sel) => {
    const b = document.querySelector(sel);
    return b instanceof HTMLButtonElement && !b.disabled;
  }, btnSelector);

  if (canClick) {
    await page.click(btnSelector);
    clickMethod = "puppeteer_click";
    await new Promise((r) => setTimeout(r, 6000));
  } else {
    // Try keyboard like extension does
    await page.focus(btnSelector);
    await page.keyboard.down("Enter");
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.up("Enter");
    clickMethod = "keyboard_enter";
    await new Promise((r) => setTimeout(r, 6000));
  }
} catch (e) {
  captured.errors.push(`click: ${e}`);
}

const afterDom = await page.evaluate(() => ({
  cartAria: document.querySelector('[data-test="@web/CartLink"]')?.getAttribute("aria-label"),
  successModal: !!document.querySelector('[data-test*="addToCartSuccess"]'),
  sticky: document.querySelector('[data-test="StickyAddToCartFulfillmentSection"]')?.textContent?.slice(0, 120),
  liveRegions: [...document.querySelectorAll('[aria-live]')].map((el) => el.textContent?.trim()).filter(Boolean),
}));

// Direct API probe from page context (same-origin cookies)
const apiProbe = await page.evaluate(async (tcin, key) => {
  const url = `https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART%2CCART_ITEMS%2CSUMMARY&key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-application-name": "web",
      },
      credentials: "include",
      body: JSON.stringify({
        cart_item: { item_channel_id: "10", tcin, quantity: 1 },
        cart_type: "REGULAR",
        channel_id: "10",
        shopping_context: "DIGITAL",
      }),
    });
    const text = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
      body: text.slice(0, 3000),
    };
  } catch (e) {
    return { error: String(e) };
  }
}, pick.tcin, API_KEY);

// Checkout probe with same session
const checkout = await page.evaluate(async () => {
  const res = await fetch("https://www.target.com/checkout/start", {
    redirect: "manual",
    credentials: "include",
  });
  return {
    status: res.status,
    redirected: res.redirected,
    url: res.url,
    location: res.headers.get("location"),
  };
});

const result = {
  pick,
  dom,
  clickMethod,
  beforeCart,
  afterDom,
  captured,
  apiProbe,
  checkout,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nWrote ${OUT}`);
console.log(`cart_items POSTs captured: ${captured.cartPosts.length}`);
console.log(`API probe status: ${apiProbe.status ?? apiProbe.error}`);

await browser.close();
