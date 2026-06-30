const NAV_DEBOUNCE_MS = 50;
export const ENABLE_PATHNAME_POLL = true;
const PATHNAME_POLL_MS = 1000;

export function hookSpaNavigation(onNavigate: () => void): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPathname = location.pathname;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const notify = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onNavigate();
    }, NAV_DEBOUNCE_MS);
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<History["pushState"]>) => {
    originalPushState(...args);
    notify();
  };

  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    originalReplaceState(...args);
    notify();
  };

  const onPopState = () => notify();
  window.addEventListener("popstate", onPopState);

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      notify();
    }
  };
  window.addEventListener("pageshow", onPageShow);

  if (ENABLE_PATHNAME_POLL) {
    pollTimer = setInterval(() => {
      if (location.pathname !== lastPathname) {
        lastPathname = location.pathname;
        notify();
      }
    }, PATHNAME_POLL_MS);
  }

  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer);
    }
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("pageshow", onPageShow);
  };
}
