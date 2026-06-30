export function describeClickLabel(element: Element): string {
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (tag === "button" || tag === "a" || current.getAttribute("role") === "button") {
      const aria = current.getAttribute("aria-label")?.trim();
      if (aria) {
        return aria.slice(0, 120);
      }
      const text = (current.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) {
        return text.slice(0, 120);
      }
      const automation = current.getAttribute("data-automation-id");
      if (automation) {
        return automation;
      }
      return tag;
    }
    current = current.parentElement;
  }
  return "Recorded click";
}
