export interface ElementDescriptorInput {
  element: Element;
  label: string;
  stepKind: "add_to_cart" | "fulfillment_choice" | "cart_success_signal" | "navigate_checkout";
  pageUrlPattern: string;
}

export interface GeneratedDescriptor {
  id: string;
  label: string;
  stepKind: ElementDescriptorInput["stepKind"];
  selectors: string[];
  ariaLabel?: string;
  dataTest?: string;
  role?: string;
  tagName: string;
  recordedAt: string;
  pageUrlPattern: string;
  brittle: boolean;
}

function escapeCssIdent(value: string): string {
  if (typeof CSS !== "undefined" && "escape" in CSS) {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

function findActionableElement(element: Element): Element {
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (tag === "button" || tag === "a" || current.getAttribute("role") === "button") {
      return current;
    }
    current = current.parentElement;
  }
  return element;
}

function selectorForElement(element: Element): { selector: string; brittle: boolean }[] {
  const results: { selector: string; brittle: boolean }[] = [];
  const dataTest = element.getAttribute("data-test");
  if (dataTest) {
    results.push({
      selector: `[data-test="${escapeCssIdent(dataTest)}"]`,
      brittle: false,
    });
  }

  const id = element.id;
  if (id) {
    results.push({ selector: `#${escapeCssIdent(id)}`, brittle: false });
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    results.push({
      selector: `[aria-label="${escapeCssIdent(ariaLabel)}"]`,
      brittle: false,
    });
  }

  const role = element.getAttribute("role");
  const tagName = element.tagName.toLowerCase();
  if (role) {
    results.push({ selector: `${tagName}[role="${escapeCssIdent(role)}"]`, brittle: true });
  }

  results.push({ selector: tagName, brittle: true });
  return results;
}

export function buildElementDescriptor(input: ElementDescriptorInput): GeneratedDescriptor {
  const actionable = findActionableElement(input.element);
  const selectorEntries = selectorForElement(actionable);
  const selectors = selectorEntries.map((entry) => entry.selector);
  const brittle = selectorEntries.every((entry) => entry.brittle);

  return {
    id: crypto.randomUUID(),
    label: input.label,
    stepKind: input.stepKind,
    selectors,
    ariaLabel: actionable.getAttribute("aria-label") ?? undefined,
    dataTest: actionable.getAttribute("data-test") ?? undefined,
    role: actionable.getAttribute("role") ?? undefined,
    tagName: actionable.tagName.toLowerCase(),
    recordedAt: new Date().toISOString(),
    pageUrlPattern: input.pageUrlPattern,
    brittle,
  };
}
