(function () {
  // Keep in sync with TARGET_CART_API_KEY in extension/domains/target/lib/cart-api.ts
  var CART_API_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
  var CART_WARMUP_URL =
    "https://carts.target.com/web_checkouts/v1/cart?cart_type=REGULAR&field_groups=CART,CART_ITEMS,SUMMARY&key=" +
    CART_API_KEY;
  var CART_WARMUP_TTL_MS = 30_000;
  var REQUEST_EVENT = "cookiescripts:cart-probe-request";
  var RESPONSE_EVENT = "cookiescripts:cart-probe-response";
  var BRIDGE_SCRIPT_ID = "cookiescripts-cart-probe-bridge";
  var cartWarmupPromise = null;
  var lastCartWarmupMs = 0;

  function buildCartHeaders() {
    return {
      accept: "application/json",
      "content-type": "application/json",
      "x-application-name": "web",
    };
  }

  function markBridgeReady() {
    var scriptEl = document.getElementById(BRIDGE_SCRIPT_ID);
    if (scriptEl) {
      scriptEl.setAttribute("data-cs-bridge", "ready");
    }
  }

  if (!window.__cookieScriptsNativeFetch) {
    window.__cookieScriptsNativeFetch = window.fetch.bind(window);
  }
  var nativeFetch = window.__cookieScriptsNativeFetch;

  function ensureCartWarmup() {
    var nowMs = Date.now();
    if (cartWarmupPromise && nowMs - lastCartWarmupMs < CART_WARMUP_TTL_MS) {
      return cartWarmupPromise;
    }
    lastCartWarmupMs = nowMs;
    cartWarmupPromise = nativeFetch(CART_WARMUP_URL, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-application-name": "web",
      },
    })
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      });
    return cartWarmupPromise;
  }

  if (window.__cookieScriptsCartProbe) {
    markBridgeReady();
    return;
  }
  window.__cookieScriptsCartProbe = true;

  document.addEventListener(REQUEST_EVENT, function (event) {
    var detail = event.detail;
    if (!detail || !detail.probeId || !detail.url) {
      return;
    }

    ensureCartWarmup().then(function () {
      nativeFetch(detail.url, {
        method: "POST",
        credentials: "include",
        headers: buildCartHeaders(),
        body: detail.body,
      })
        .then(function (response) {
          return response.text().then(function (text) {
            var body = null;
            if (text) {
              try {
                body = JSON.parse(text);
              } catch (_error) {
                body = null;
              }
            }
            document.dispatchEvent(
              new CustomEvent(RESPONSE_EVENT, {
                detail: {
                  probeId: detail.probeId,
                  status: response.status,
                  body: body,
                },
              }),
            );
          });
        })
        .catch(function () {
          document.dispatchEvent(
            new CustomEvent(RESPONSE_EVENT, {
              detail: {
                probeId: detail.probeId,
                error: true,
              },
            }),
          );
        });
    });
  });

  markBridgeReady();
})();
