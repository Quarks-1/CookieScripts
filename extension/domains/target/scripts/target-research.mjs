/**
 * One-off Target.com DOM + network research (puppeteer).
 * Not shipped with the extension.
 */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";

const PRODUCT_URLS = [
  "https://www.target.com/p/restockr/-/A-1011209279",
  "https://www.target.com/p/bounty-select-a-size-paper-towels/-/A-13276134",
  "https://www.target.com/p/tide-pods-laundry-detergent-pacs/-/A-14758404",
];

const OUT_DIR = "/workspace/research/target-live";

mkdirSync(OUT_DIR, { recursive: true });

function summarizeRequest(req) {
  const url = req.url();
  if (
    !url.includes("target.com") &&
    !url.includes("redsky") &&
    !url.includes("carts.")
  ) {
    return null;
  }
  const interesting =
    req.method() === "POST" ||
    url.includes("cart") ||
    url.includes("redsky") ||
    url.includes("checkout") ||
    url.includes("fulfillment") ||
    url.includes("inventory");
  if (!interesting) return null;

  const headers = req.headers();
  return {
    method: req.method(),
    url,
    resourceType: req.resourceType(),
    headers: {
      accept: headers.accept,
      "content-type": headers["content-type"],
      origin: headers.origin,
      referer: headers.referer,
      "x-application-name": headers["x-application-name"],
      cookie: headers.cookie ? `[${headers.cookie.length} chars]` : undefined,
    },
    postData: req.postData() ?? null,
  };
}

async function extractDom(page) {
  return page.evaluate(() => {
    const tcinMatch = location.pathname.match(/\/A-(\d+)/);
    const tcin = tcinMatch?.[1] ?? null;

    const pick = (sel) => {
      const nodes = [...document.querySelectorAll(sel)];
      return nodes.slice(0, 8).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        dataTest: el.getAttribute("data-test"),
        ariaLabel: el.getAttribute("aria-label"),
        disabled: el instanceof HTMLButtonElement ? el.disabled : null,
        text: (el.textContent ?? "").trim().slice(0, 80),
        classes: el.className?.toString().slice(0, 120) || null,
      }));
    };

    const scopes = [
      '[data-test="@web/AddToCart/FulfillmentSection"]',
      '[data-test="@web/AddToCart/Fulfillment/ShippingSection"]',
      '[data-test="StickyAddToCartFulfillmentSection"]',
    ];

    const scopeInfo = scopes.map((sel) => ({
      selector: sel,
      count: document.querySelectorAll(sel).length,
      buttons: pick(`${sel} button`).slice(0, 12),
    }));

    const atcButtons = pick(
      'button[id^="addToCartButtonOrTextIdFor"], button[data-test="shippingButton"], button[data-test="addToCartButton"], button[data-test="shipItButton"], button[data-test="orderPickupButton"]',
    );

    const oosSignals = pick(
      '[data-test*="outOfStock"], [data-test*="OutOfStock"], [data-test="soldOutBlock"], [data-test="unavailableBlock"]',
    );

    const qty = pick(
      'select[data-test*="quantity"], button[data-test*="quantity"], [data-test="quantityPicker"], [data-test="quantity"]',
    );

    const cart = pick(
      '[data-test="@web/CartLinkQuantity"], [data-test="@web/CartLink"], a[href*="/cart"]',
    );

    const pageTitle = document.title;
    const h1 = document.querySelector("h1")?.textContent?.trim() ?? null;

    const scripts = [...document.scripts]
      .map((s) => s.src || s.textContent?.slice(0, 200) || "")
      .filter((t) => /apiKey|redsky|carts\.target|web_checkouts|9f36aeaf/i.test(t))
      .slice(0, 10);

    const bodyText = document.body?.innerText?.slice(0, 4000) ?? "";
    const trafficBlock =
      /high traffic|please wait|access denied|verify you are human|robot|captcha|something went wrong/i.test(
        bodyText,
      );

    return {
      url: location.href,
      tcin,
      pageTitle,
      h1,
      trafficBlock,
      scopeInfo,
      atcButtons,
      oosSignals,
      qty,
      cart,
      scriptHints: scripts,
      bodySnippet: bodyText.slice(0, 800),
    };
  });
}

async function researchProduct(browser, productUrl) {
  const page = await browser.newPage();
  const network = [];
  const responses = [];

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1440, height: 900 });

  page.on("request", (req) => {
    const summary = summarizeRequest(req);
    if (summary) network.push({ phase: "initial", ...summary });
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (
      res.request().method() === "POST" &&
      (url.includes("cart") || url.includes("checkout") || url.includes("fulfillment"))
    ) {
      let body = null;
      try {
        body = await res.text();
      } catch {
        body = null;
      }
      responses.push({
        status: res.status(),
        url,
        body: body?.slice(0, 2000) ?? null,
      });
    }
  });

  console.log(`\n=== Visiting ${productUrl} ===`);
  let navError = null;
  try {
    await page.goto(productUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    navError = String(e);
  }

  await new Promise((r) => setTimeout(r, 3000));
  const domBefore = await extractDom(page);

  // Try clicking main ATC if present
  const clickResult = await page.evaluate(() => {
    const tcinMatch = location.pathname.match(/\/A-(\d+)/);
    const tcin = tcinMatch?.[1];
    const id = tcin ? `addToCartButtonOrTextIdFor${tcin}` : null;
    const candidates = [
      id ? document.getElementById(id) : null,
      document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] button[data-test="shippingButton"]'),
      document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] button[id^="addToCartButtonOrTextIdFor"]'),
      document.querySelector('button[data-test="shippingButton"]'),
    ].filter(Boolean);

    for (const btn of candidates) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      const rect = btn.getBoundingClientRect();
      return {
        found: true,
        id: btn.id,
        dataTest: btn.getAttribute("data-test"),
        disabled: btn.disabled,
        text: btn.textContent?.trim(),
        width: rect.width,
        height: rect.height,
        willClick: !btn.disabled && rect.width > 0,
        selector: btn.id ? `#${btn.id}` : `[data-test="${btn.getAttribute("data-test")}"]`,
      };
    }
    return { found: false };
  });

  const clickNetwork = [];
  const clickHandler = (req) => {
    const summary = summarizeRequest(req);
    if (summary) clickNetwork.push(summary);
  };
  page.on("request", clickHandler);

  let clickOutcome = null;
  if (clickResult.found && clickResult.willClick) {
    console.log(`Clicking: ${clickResult.selector}`);
    try {
      await page.click(clickResult.selector, { delay: 50 });
      await new Promise((r) => setTimeout(r, 5000));
      clickOutcome = "clicked";
    } catch (e) {
      clickOutcome = `click_failed: ${e}`;
    }
  } else {
    clickOutcome = clickResult.found
      ? `button_disabled_or_hidden: disabled=${clickResult.disabled}`
      : "button_not_found";
  }

  page.off("request", clickHandler);
  const domAfter = await extractDom(page);

  // Checkout start probe (navigation only, no purchase)
  const checkoutPage = await browser.newPage();
  let checkoutInfo = null;
  try {
    await checkoutPage.goto("https://www.target.com/checkout/start", {
      waitUntil: "networkidle2",
      timeout: 45000,
    });
    checkoutInfo = await checkoutPage.evaluate(() => ({
      url: location.href,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      loginPrompt: /sign in|log in|create account/i.test(document.body?.innerText ?? ""),
      cartEmpty: /cart is empty|your cart is empty|no items/i.test(document.body?.innerText ?? ""),
      bodySnippet: document.body?.innerText?.slice(0, 600) ?? "",
    }));
  } catch (e) {
    checkoutInfo = { error: String(e) };
  }
  await checkoutPage.close();

  const slug = productUrl.match(/\/A-(\d+)/)?.[1] ?? "unknown";
  const result = {
    productUrl,
    navError,
    domBefore,
    clickResult,
    clickOutcome,
    clickNetwork,
    responses,
    domAfter,
    initialNetworkSample: network.slice(0, 80),
    checkoutInfo,
  };

  writeFileSync(`${OUT_DIR}/product-${slug}.json`, JSON.stringify(result, null, 2));
  await page.close();
  return result;
}

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ],
});

const all = [];
for (const url of PRODUCT_URLS) {
  try {
    all.push(await researchProduct(browser, url));
  } catch (e) {
    all.push({ productUrl: url, fatal: String(e) });
  }
}

writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(all, null, 2));
await browser.close();
console.log(`\nWrote research to ${OUT_DIR}`);
