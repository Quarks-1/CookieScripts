void import("@ext/domains/walmart/lib/queue-probe-bridge.ts").then(({ ensureQueueProbe }) => {
  void ensureQueueProbe(document);
});
