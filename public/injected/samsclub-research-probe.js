(function () {
  var EVENT_NAME = "cookiescripts:samsclub-probe";
  var BRIDGE_ID = "cookiescripts-samsclub-probe-bridge";
  var PROBE_VERSION = "1.1.0";
  var MAX_BODY = 65536;
  var correlationCounter = 0;

  function truncate(text) {
    if (!text || text.length <= MAX_BODY) {
      return text;
    }
    return text.slice(0, MAX_BODY) + "…[truncated]";
  }

  function nextCorrelationId() {
    correlationCounter += 1;
    return "cs-" + correlationCounter;
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, window.location.href).href;
    } catch (_error) {
      return String(url);
    }
  }

  function headersFromInit(init) {
    var out = {};
    if (!init || !init.headers) {
      return out;
    }
    if (init.headers instanceof Headers) {
      init.headers.forEach(function (value, key) {
        out[key] = value;
      });
      return out;
    }
    if (Array.isArray(init.headers)) {
      init.headers.forEach(function (pair) {
        out[pair[0]] = pair[1];
      });
      return out;
    }
    return Object.assign(out, init.headers);
  }

  function headersFromXhr(xhr) {
    var raw = xhr.getAllResponseHeaders();
    if (!raw) {
      return {};
    }
    var out = {};
    raw
      .trim()
      .split(/[\r\n]+/)
      .forEach(function (line) {
        var parts = line.split(": ");
        var key = parts.shift();
        if (key) {
          out[key] = parts.join(": ");
        }
      });
    return out;
  }

  function emit(payload) {
    payload.pageUrl = window.location.href;
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  }

  function markReady() {
    var el = document.getElementById(BRIDGE_ID);
    if (el) {
      el.setAttribute("data-cs-bridge", "ready");
      el.setAttribute("data-cs-probe-version", PROBE_VERSION);
    }
  }

  if (window.__cookieScriptsSamsclubProbeHooks) {
    markReady();
    return;
  }

  var nativeFetch = window.fetch.bind(window);
  var NativeXHR = window.XMLHttpRequest;
  var NativeWebSocket = window.WebSocket;
  var nativeBeacon = navigator.sendBeacon.bind(navigator);

  window.__cookieScriptsSamsclubProbeHooks = true;

  window.fetch = function (input, init) {
    var started = Date.now();
    var correlationId = nextCorrelationId();
    var method = (init && init.method) || "GET";
    var url = typeof input === "string" ? input : input.url;
    var requestBody =
      init && init.body && typeof init.body === "string" ? truncate(init.body) : undefined;
    var requestHeaders = headersFromInit(init);
    return nativeFetch(input, init)
      .then(function (response) {
        var clone = response.clone();
        var responseHeaders = {};
        clone.headers.forEach(function (value, key) {
          responseHeaders[key] = value;
        });
        clone
          .text()
          .then(function (text) {
            emit({
              kind: "network",
              transport: "fetch",
              correlationId: correlationId,
              method: method,
              url: url,
              status: response.status,
              requestBody: requestBody,
              responseSnippet: truncate(text),
              requestHeaders: requestHeaders,
              responseHeaders: responseHeaders,
              durationMs: Date.now() - started,
            });
          })
          .catch(function () {
            emit({
              kind: "network",
              transport: "fetch",
              correlationId: correlationId,
              method: method,
              url: url,
              status: response.status,
              requestHeaders: requestHeaders,
              responseHeaders: responseHeaders,
              durationMs: Date.now() - started,
            });
          });
        return response;
      })
      .catch(function (error) {
        emit({
          kind: "network",
          transport: "fetch",
          correlationId: correlationId,
          method: method,
          url: url,
          requestBody: requestBody,
          requestHeaders: requestHeaders,
          durationMs: Date.now() - started,
          failed: true,
        });
        throw error;
      });
  };

  window.XMLHttpRequest = function () {
    var xhr = new NativeXHR();
    var method = "GET";
    var url = "";
    var requestBody;
    var started = 0;
    var correlationId = nextCorrelationId();
    var open = xhr.open;
    xhr.open = function (m, u) {
      method = m;
      url = u;
      return open.apply(xhr, arguments);
    };
    var send = xhr.send;
    xhr.send = function (body) {
      started = Date.now();
      if (typeof body === "string") {
        requestBody = truncate(body);
      }
      xhr.addEventListener("loadend", function () {
        emit({
          kind: "network",
          transport: "xhr",
          correlationId: correlationId,
          method: method,
          url: url,
          status: xhr.status,
          requestBody: requestBody,
          responseSnippet: truncate(xhr.responseText || ""),
          responseHeaders: headersFromXhr(xhr),
          durationMs: Date.now() - started,
          failed: xhr.status === 0 && xhr.readyState === 4,
        });
      });
      return send.apply(xhr, arguments);
    };
    return xhr;
  };

  window.WebSocket = function (url, protocols) {
    var correlationId = nextCorrelationId();
    var ws = protocols !== undefined ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);
    emit({
      kind: "websocket",
      correlationId: correlationId,
      direction: "open",
      url: String(url),
    });
    var nativeSend = ws.send.bind(ws);
    ws.send = function (data) {
      emit({
        kind: "websocket",
        correlationId: correlationId,
        direction: "send",
        url: String(url),
        payloadSnippet: truncate(typeof data === "string" ? data : ""),
      });
      return nativeSend(data);
    };
    ws.addEventListener("message", function (event) {
      emit({
        kind: "websocket",
        correlationId: correlationId,
        direction: "message",
        url: String(url),
        payloadSnippet: truncate(typeof event.data === "string" ? event.data : ""),
      });
    });
    ws.addEventListener("close", function (event) {
      emit({
        kind: "websocket",
        correlationId: correlationId,
        direction: "close",
        url: String(url),
        code: event.code,
      });
    });
    return ws;
  };

  navigator.sendBeacon = function (url, data) {
    emit({
      kind: "network",
      transport: "beacon",
      correlationId: nextCorrelationId(),
      method: "POST",
      url: String(url),
      requestBody: truncate(typeof data === "string" ? data : ""),
    });
    return nativeBeacon(url, data);
  };

  markReady();
})();
