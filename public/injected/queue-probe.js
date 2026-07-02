(function () {
  var EVENT_NAME = "cookiescripts:walmart-queue-probe";
  var BRIDGE_ID = "cookiescripts-walmart-queue-probe";
  var MAX_BODY = 16384;

  function truncate(text) {
    if (!text || text.length <= MAX_BODY) {
      return text;
    }
    return text.slice(0, MAX_BODY) + "…[truncated]";
  }

  function emit(payload) {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  }

  function markReady() {
    var el = document.getElementById(BRIDGE_ID);
    if (el) {
      el.setAttribute("data-cs-bridge", "ready");
    }
  }

  function queueApiKind(url) {
    var absolute = String(url);
    if (absolute.indexOf("q-api.www.walmart.com") === -1) {
      return null;
    }
    if (absolute.indexOf("validateTickets") !== -1) {
      return "validateTickets";
    }
    if (absolute.indexOf("issueTicket") !== -1) {
      return "issueTicket";
    }
    return null;
  }

  if (window.__cookieScriptsWalmartQueueProbeHooks) {
    markReady();
    return;
  }

  var nativeFetch = window.fetch.bind(window);
  var NativeXHR = window.XMLHttpRequest;

  window.__cookieScriptsWalmartQueueProbeHooks = true;

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input.url;
    var kind = queueApiKind(url);
    return nativeFetch(input, init).then(function (response) {
      if (kind) {
        var clone = response.clone();
        clone
          .text()
          .then(function (text) {
            emit({
              kind: kind,
              url: url,
              status: response.status,
              responseSnippet: truncate(text),
            });
          })
          .catch(function () {
            emit({ kind: kind, url: url, status: response.status, responseSnippet: "" });
          });
      }
      return response;
    });
  };

  function PatchedXHR() {
    var xhr = new NativeXHR();
    var requestUrl = "";
    var open = xhr.open;
    xhr.open = function (method, url) {
      requestUrl = String(url);
      return open.apply(xhr, arguments);
    };
    xhr.addEventListener("load", function () {
      var kind = queueApiKind(requestUrl);
      if (!kind) {
        return;
      }
      emit({
        kind: kind,
        url: requestUrl,
        status: xhr.status,
        responseSnippet: truncate(xhr.responseText),
      });
    });
    return xhr;
  }
  PatchedXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  markReady();
})();
