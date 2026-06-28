/**
 * Focused drop/OOS PDP research for TCIN 1011209279.
 */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";

const TCIN = "1011209279";
const DROP_URL = "https://www.target.com/p/-/A-1011209279";
const INSTOCK_URL = "https://www.target.com/p/scotch-3pk-magic-tape-3-4-34-x-350-34/-/A-13356914";
const API_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
const OUT = "/workspace/research/target-live/drop-1011209279.json";

mkdirSync("/workspace/research/target-live", { recursive: true });

function parseRedskyUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("redsky.target.com")) return null;
    const path = u.pathname;
    const params = Object.fromEntries(u.searchParams.entries());
    return { path, params: { tcin: params.tcin, store_id: params.store_id, zip: params.zip } };
  } catch {
    return null;
  }
}

async function extractFullDom(page) {
  return page.evaluate(() => {
    const tcinMatch = location.pathname.match(/\/A-(\d+)/);
    const tcin = tcinMatch?.[1] ?? null;

    const scope = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"]');
    const sticky = document.querySelector('[data-test="StickyAddToCartFulfillmentSection"]');

    const pickButtons = (root) =>
      root
        ? [...root.querySelectorAll("button, a[role='button']")].map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            dataTest: el.getAttribute("data-test"),
            ariaLabel: el.getAttribute("aria-label"),
            disabled: el instanceof HTMLButtonElement ? el.disabled : null,
            href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
            text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
          }))
        : [];

    const mainId = tcin ? `addToCartButtonOrTextIdFor${tcin}` : null;
    const mainBtn = mainId ? document.getElementById(mainId) : null;

    const dataTests = [...document.querySelectorAll("[data-test]")]
      .map((el) => el.getAttribute("data-test"))
      .filter((t) =>
        /stock|cart|fulfill|drop|queue|traffic|coming|soon|sold|unavail|buy|sign|restock|alert|badge|notify/i.test(
          t ?? "",
        ),
      );

    const recTiles = [...document.querySelectorAll('[data-test="addToCartSuccessModalRecommendations"], [data-test*="Recommendations"]')]
      .slice(0, 3)
      .map((el) => ({
        dataTest: el.getAttribute("data-test"),
        buttons: pickButtons(el).slice(0, 6),
      }));

    const bodyText = document.body?.innerText ?? "";
    const patterns = {
      outOfStock: /out of stock/i.test(bodyText),
      comingSoon: /coming soon/i.test(bodyText),
      highTraffic: /high traffic|please wait|something went wrong/i.test(bodyText),
      finalSale: /final sale/i.test(bodyText),
      findAlternative: /find alternative/i.test(bodyText),
      bestseller: /bestseller/i.test(bodyText),
      newAtTarget: /new at\s*target/i.test(bodyText),
      signInBuyNow: /sign in to buy now/i.test(bodyText),
      notifyMe: /notify me|email me|get notified/i.test(bodyText),
      countdown: /\d{1,2}:\d{2}:\d{2}/.test(bodyText),
      queue: /queue|your turn|waiting room/i.test(bodyText),
    };

    const badges = [...document.querySelectorAll("[class*='badge'], [class*='Badge'], [data-test*='badge']")]
      .slice(0, 15)
      .map((el) => ({
        dataTest: el.getAttribute("data-test"),
        text: (el.textContent ?? "").trim().slice(0, 80),
      }));

    const priceArea = document.querySelector('[data-test="product-price"]')?.textContent?.trim()
      ?? bodyText.match(/\$\d+\.\d{2}/)?.[0]
      ?? null;

    return {
      url: location.href,
      tcin,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      priceArea,
      mainButton: mainBtn
        ? {
            id: mainBtn.id,
            dataTest: mainBtn.getAttribute("data-test"),
            disabled: mainBtn.disabled,
            ariaLabel: mainBtn.getAttribute("aria-label"),
            text: mainBtn.textContent?.trim(),
            rect: (() => {
              const r = mainBtn.getBoundingClientRect();
              return { width: r.width, height: r.height };
            })(),
          }
        : null,
      fulfillmentSection: {
        present: !!scope,
        buttons: pickButtons(scope),
      },
      stickySection: {
        present: !!sticky,
        buttons: pickButtons(sticky),
        text: sticky?.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) ?? null,
      },
      oosElements: [...document.querySelectorAll('[data-test*="outOfStock"], [data-test*="OutOfStock"], [data-test="soldOutBlock"]')].map(
        (el) => ({
          dataTest: el.getAttribute("data-test"),
          text: (el.textContent ?? "").trim().slice(0, 120),
        }),
      ),
      dropRelatedDataTests: [...new Set(dataTests)].sort(),
      recommendationTiles: recTiles,
      badges,
      bodyPatterns: patterns,
      bodySnippet: bodyText.slice(0, 2500),
      hasShippingSection: !!document.querySelector('[data-test="@web/AddToCart/Fulfillment/ShippingSection"]'),
      signInToBuyNow: !!document.querySelector('[data-test="sign-in-to-buy-now-button"]'),
      qtyControl: [...document.querySelectorAll("select, [data-test*='quantity']")].map((el) => ({
        tag: el.tagName,
        id: el.id,
        dataTest: el.getAttribute("data-test"),
        text: (el.textContent ?? "").trim().slice(0, 40),
      })),
    };
  });
}

async function probeRedsky(page, tcin) {
  const endpoints = [
    `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=${API_KEY}&tcin=${tcin}&is_bot=false&store_id=2272&pricing_store_id=2272&has_pricing_store_id=true&has_financing_options=true&include_obsolete=false&skip_personalized=true&skip_variation_hierarchy=true&channel=WEB&page=%2Fp%2FA-${tcin}`,
    `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?key=${API_KEY}&required_store_id=2272&latitude=39.030&longitude=-77.490&scheduled_delivery_store_id=2272&state=VA&zip=20147&store_id=2272&paid_membership=false&base_membership=false&card_membership=false&is_bot=false&tcin=${tcin}&channel=WEB&page=%2Fp%2FA-${tcin}`,
    `https://redsky.target.com/redsky_aggregations/v1/web/pdp_recommendations_placement_v1?key=${API_KEY}&tcins=${tcin}&placement_id=adapt_pdp_oos_01&purchasable_store_ids=2272&pricing_store_id=2272&channel=WEB&page=%2Fp%2FA-${tcin}`,
  ];

  const results = [];
  for (const url of endpoints) {
    const res = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, {
          credentials: "omit",
          headers: { accept: "application/json" },
        });
        const text = await r.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        return { status: r.status, ok: r.ok, text: text.slice(0, 12000), json };
      } catch (e) {
        return { error: String(e) };
      }
    }, url);
    results.push({ url: parseRedskyUrl(url), ...res });
  }
  return results;
}

async function probeCartApi(page, tcin) {
  return page.evaluate(async (tcinArg, key) => {
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
    return { status: res.status, ok: res.ok, body: text.slice(0, 3000) };
  }, tcin, API_KEY);
}

async function researchUrl(browser, url, label) {
  const page = await browser.newPage();
  const network = { redsky: [], carts: [], captcha: [], fulfillment: [] };
  const redskyBodies = [];

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  page.on("response", async (res) => {
    const u = res.url();
    const status = res.status();
    if (u.includes("redsky.target.com")) {
      const entry = { status, url: u, parsed: parseRedskyUrl(u) };
      network.redsky.push(entry);
      if (
        u.includes("pdp_client") ||
        u.includes("fulfillment") ||
        u.includes("oos") ||
        u.includes("recommendations_placement")
      ) {
        try {
          const body = await res.text();
          redskyBodies.push({ url: u, status, body: body.slice(0, 15000) });
        } catch {}
      }
      if (u.includes("captcha") || u.includes("RttCheck") || u.includes("AtaVerify")) {
        network.captcha.push({ status, url: u });
      }
    }
    if (u.includes("carts.target.com")) {
      let body = null;
      try {
        body = (await res.text()).slice(0, 2000);
      } catch {}
      network.carts.push({ method: res.request().method(), status, url: u, body });
    }
  });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 5000));

  const dom = await extractFullDom(page);
  const redskyProbe = await probeRedsky(page, dom.tcin ?? TCIN);
  const cartProbe = await probeCartApi(page, dom.tcin ?? TCIN);

  await page.close();
  return { label, url, dom, network, redskyBodies, redskyProbe, cartProbe };
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
});

console.log("Researching drop PDP...");
const drop = await researchUrl(browser, DROP_URL, "drop-oos");
console.log("Researching in-stock reference...");
const instock = await researchUrl(browser, INSTOCK_URL, "instock-reference");

await browser.close();

function summarizeFulfillment(redskyBodies) {
  const out = {};
  for (const { url, body } of redskyBodies) {
    try {
      const j = JSON.parse(body);
      if (url.includes("pdp_client")) {
        const p = j?.data?.product;
        out.pdp_client = {
          title: p?.item?.product_description?.title,
          price: p?.price?.formatted_current_price,
          availability_status: p?.fulfillment?.shipping_options?.availability_status,
          is_out_of_stock_all_stores: p?.fulfillment?.is_out_of_stock_in_all_store_locations,
          sold_out: p?.fulfillment?.sold_out,
          is_marketplace: p?.fulfillment?.is_marketplace,
          purchase_limit: p?.fulfillment?.purchase_limit,
        };
      }
      if (url.includes("fulfillment_and_variation")) {
        const p = j?.data?.product;
        out.fulfillment_hierarchy = {
          shipping: p?.fulfillment?.shipping_options,
          store_options: p?.fulfillment?.store_options,
          is_out_of_stock_all_stores: p?.fulfillment?.is_out_of_stock_in_all_store_locations,
        };
      }
      if (url.includes("recommendations_placement") || url.includes("oos_01")) {
        out.oos_recommendations = {
          placement: j?.data?.recommended_products?.length ?? j?.data?.products?.length,
          placement_id: "adapt_pdp_oos_01",
        };
      }
    } catch {}
  }
  return out;
}

const result = {
  capturedAt: new Date().toISOString(),
  drop,
  instock,
  comparison: {
    drop: {
      mainDisabled: drop.dom.mainButton?.disabled,
      mainDataTest: drop.dom.mainButton?.dataTest,
      fulfillmentTabs: drop.dom.fulfillmentSection.buttons.filter((b) =>
        b.dataTest?.startsWith("fulfillment-cell"),
      ),
      stickyAction: drop.dom.stickySection.buttons[0]?.text,
      bodyPatterns: drop.dom.bodyPatterns,
      oosPlacement: drop.network.redsky.some((r) => r.url.includes("oos_01")),
    },
    instock: {
      mainDisabled: instock.dom.mainButton?.disabled,
      mainDataTest: instock.dom.mainButton?.dataTest,
      fulfillmentTabs: instock.dom.fulfillmentSection.buttons.filter((b) =>
        b.dataTest?.startsWith("fulfillment-cell"),
      ),
      stickyAction: instock.dom.stickySection.buttons[0]?.text,
      bodyPatterns: instock.dom.bodyPatterns,
    },
  },
  fulfillmentSummary: {
    drop: summarizeFulfillment(drop.redskyBodies),
    instock: summarizeFulfillment(instock.redskyBodies),
  },
  cartProbe: {
    drop: drop.cartProbe,
    instock: instock.cartProbe,
  },
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`Wrote ${OUT}`);
console.log("Drop main button:", drop.dom.mainButton);
console.log("Drop cart probe status:", drop.cartProbe.status);
console.log("Fulfillment summary:", JSON.stringify(result.fulfillmentSummary.drop, null, 2));
