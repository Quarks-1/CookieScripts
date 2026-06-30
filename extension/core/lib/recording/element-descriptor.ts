export interface ElementDescriptorInput {
  element: Element;
  label: string;
  pageUrlPattern: string;
  attributePriority?: string[];
}

export interface GeneratedDescriptor {
  id: string;
  label: string;
  selectors: string[];
  ariaLabel?: string;
  dataAutomationId?: string;
  dataTestId?: string;
  role?: string;
  tagName: string;
  recordedAt: string;
  pageUrlPattern: string;
  brittle: boolean;
}

const DEFAULT_ATTRIBUTE_PRIORITY = ["data-automation-id", "data-testid", "data-test", "id", "aria-label"];

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

function selectorForElement(
  element: Element,
  priority: string[],
): { selector: string; brittle: boolean }[] {
  const results: { selector: string; brittle: boolean }[] = [];

  for (const attr of priority) {
    const value = element.getAttribute(attr);
    if (!value) {
      continue;
    }
    if (attr === "id") {
      results.push({ selector: `#${escapeCssIdent(value)}`, brittle: false });
      continue;
    }
    results.push({
      selector: `[${attr}="${escapeCssIdent(value)}"]`,
      brittle: attr === "data-test" ? false : attr !== "data-automation-id",
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
  const priority = input.attributePriority ?? DEFAULT_ATTRIBUTE_PRIORITY;
  const selectorEntries = selectorForElement(actionable, priority);
  const selectors = selectorEntries.map((entry) => entry.selector);
  const brittle = selectorEntries.every((entry) => entry.brittle);

  return {
    id: crypto.randomUUID(),
    label: input.label,
    selectors,
    ariaLabel: actionable.getAttribute("aria-label") ?? undefined,
    dataAutomationId: actionable.getAttribute("data-automation-id") ?? undefined,
    dataTestId: actionable.getAttribute("data-testid") ?? undefined,
    role: actionable.getAttribute("role") ?? undefined,
    tagName: actionable.tagName.toLowerCase(),
    recordedAt: new Date().toISOString(),
    pageUrlPattern: input.pageUrlPattern,
    brittle,
  };
}
