(function () {
  var REQUEST_EVENT = "cookiescripts:cart-probe-request";
  var RESPONSE_EVENT = "cookiescripts:cart-probe-response";
  var BRIDGE_SCRIPT_ID = "cookiescripts-cart-probe-bridge";

  function buildCartHeaders() {
    return {
      accept: "application/json",
      "content-type": "application/json",
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

  markBridgeReady();
})();
