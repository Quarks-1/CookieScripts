/** Test cart_items fetch with/without Shape headers on warm session. */
import puppeteer from "puppeteer";
import { writeFileSync } from "node:fs";

const KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
const TCIN = "13356914";
const URL = `https://www.target.com/p/scotch-3pk-magic-tape-3-4-34-x-350-34/-/A-${TCIN}`;

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));

const probes = await page.evaluate(async (tcin, key) => {
  const endpoint = `https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART%2CCART_ITEMS%2CSUMMARY&key=${key}`;
  const body = JSON.stringify({
    cart_item: { item_channel_id: "10", tcin, quantity: 1 },
    cart_type: "REGULAR",
    channel_id: "10",
    shopping_context: "DIGITAL",
  });

  async function post(label, headers) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", ...headers },
      credentials: "include",
      body,
    });
    const text = await res.text();
    return { label, status: res.status, body: text.slice(0, 500) };
  }

  return {
    minimal: await post("minimal", {}),
    webApp: await post("webApp", { "x-application-name": "web" }),
    getCart: await fetch(
      `https://carts.target.com/web_checkouts/v1/cart?cart_type=REGULAR&field_groups=CART_ITEMS%2CSUMMARY&key=${key}`,
      { credentials: "include", headers: { accept: "application/json", "x-application-name": "web" } },
    ).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 800) })),
  };
}, TCIN, KEY);

// Checkout navigation
await page.goto("https://www.target.com/checkout/start", { waitUntil: "networkidle2", timeout: 60000 });
const checkoutDom = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  signIn: !!document.querySelector('[data-test="accountNav-signIn"], a[href*="login"]'),
  checkoutSteps: [...document.querySelectorAll("[data-test]")]
    .map((el) => el.getAttribute("data-test"))
    .filter((t) => /checkout|cart|shipping|payment|sign/i.test(t ?? ""))
    .slice(0, 30),
  body: document.body.innerText.slice(0, 1200),
}));

writeFileSync(
  "/workspace/research/target-live/api-probes.json",
  JSON.stringify({ probes, checkoutDom }, null, 2),
);
console.log(JSON.stringify({ probes, checkoutUrl: checkoutDom.url }, null, 2));
await browser.close();
