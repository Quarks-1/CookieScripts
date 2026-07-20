type ReactInputEvent = { target: HTMLInputElement };

type ReactHandlerBag = {
  onChange?: (event: ReactInputEvent) => void;
  onInput?: (event: ReactInputEvent) => void;
  onValueChange?: (value: string) => void;
  onUpdate?: (value: string) => void;
  onBlur?: (event: ReactInputEvent) => void;
  onPaste?: (event: ClipboardEvent) => void;
  onBeforeInput?: (event: InputEvent) => void;
};

type ReactFiberNode = {
  memoizedProps?: Record<string, unknown>;
  pendingProps?: Record<string, unknown>;
  return?: ReactFiberNode;
};

function reactKeys(element: Element): string[] {
  return Reflect.ownKeys(element).filter((key): key is string => typeof key === "string");
}

function pickHandlers(props: Record<string, unknown> | undefined): ReactHandlerBag | null {
  if (!props) {
    return null;
  }
  const bag: ReactHandlerBag = {
    onChange: props.onChange as ReactHandlerBag["onChange"],
    onInput: props.onInput as ReactHandlerBag["onInput"],
    onValueChange: props.onValueChange as ReactHandlerBag["onValueChange"],
    onUpdate: props.onUpdate as ReactHandlerBag["onUpdate"],
    onBlur: props.onBlur as ReactHandlerBag["onBlur"],
    onPaste: props.onPaste as ReactHandlerBag["onPaste"],
    onBeforeInput: props.onBeforeInput as ReactHandlerBag["onBeforeInput"],
  };
  if (
    typeof bag.onChange === "function" ||
    typeof bag.onInput === "function" ||
    typeof bag.onValueChange === "function" ||
    typeof bag.onUpdate === "function" ||
    typeof bag.onPaste === "function" ||
    typeof bag.onBeforeInput === "function"
  ) {
    return bag;
  }
  return null;
}

function readReactPropsBag(element: Element): ReactHandlerBag | null {
  const propsKey = reactKeys(element).find(
    (key) => key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$"),
  );
  if (!propsKey) {
    return null;
  }
  const raw = (element as Element & Record<string, Record<string, unknown> | undefined>)[propsKey];
  return pickHandlers(raw);
}

function readFiberHandlers(element: Element): ReactHandlerBag | null {
  const fiberKey = reactKeys(element).find(
    (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) {
    return null;
  }

  let fiber = (element as Element & Record<string, ReactFiberNode | undefined>)[fiberKey];
  let depth = 0;
  while (fiber && depth < 32) {
    const handlers = pickHandlers(fiber.memoizedProps) ?? pickHandlers(fiber.pendingProps);
    if (handlers) {
      return handlers;
    }
    fiber = fiber.return;
    depth += 1;
  }
  return null;
}

export function findReactInputHandlers(
  input: HTMLInputElement,
): { element: Element; handlers: ReactHandlerBag } | null {
  let node: Element | null = input;
  while (node) {
    const propsBag = readReactPropsBag(node);
    if (propsBag) {
      return { element: node, handlers: propsBag };
    }
    const fiberBag = readFiberHandlers(node);
    if (fiberBag) {
      return { element: node, handlers: fiberBag };
    }
    node = node.parentElement;
  }
  return null;
}

export function listReactHandlerProps(input: HTMLInputElement): Array<{
  tag: string;
  id: string | null;
  className: string | null;
  handlerProps: string[];
}> {
  const out: Array<{
    tag: string;
    id: string | null;
    className: string | null;
    handlerProps: string[];
  }> = [];
  let node: Element | null = input;
  while (node) {
    const handlerProps = new Set<string>();
    const propsKey = reactKeys(node).find(
      (key) => key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$"),
    );
    if (propsKey) {
      const raw = (node as Element & Record<string, Record<string, unknown> | undefined>)[propsKey];
      for (const key of Object.keys(raw ?? {})) {
        if (key.startsWith("on") && typeof raw?.[key] === "function") {
          handlerProps.add(key);
        }
      }
    }
    out.push({
      tag: node.tagName,
      id: node.id || null,
      className: node.className || null,
      handlerProps: [...handlerProps],
    });
    node = node.parentElement;
  }
  return out;
}

export function hasReactInputHandlers(input: HTMLInputElement): boolean {
  return findReactInputHandlers(input) !== null;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
}

function syncReactValueTracker(input: HTMLInputElement, trackerValue: string): void {
  const tracker = (
    input as HTMLInputElement & { _valueTracker?: { setValue: (value: string) => void } }
  )._valueTracker;
  tracker?.setValue(trackerValue);
}

function invokeHandler(
  input: HTMLInputElement,
  handler: (event: ReactInputEvent) => void,
  eventType: "input" | "change" | "blur",
): void {
  const event = new Event(eventType, { bubbles: true });
  Object.defineProperty(event, "target", { writable: false, value: input });
  Object.defineProperty(event, "currentTarget", { writable: false, value: input });
  handler(event as unknown as ReactInputEvent);
}

function dispatchInsertText(input: HTMLInputElement, text: string, inputType: string): void {
  input.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data: text,
    }),
  );
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data: text,
    }),
  );
}

function tryFillViaReactPaste(input: HTMLInputElement, handlers: ReactHandlerBag, value: string): boolean {
  if (!handlers.onPaste) {
    return false;
  }
  input.focus({ preventScroll: true });
  syncReactValueTracker(input, "");
  setNativeInputValue(input, "");
  try {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    Object.defineProperty(event, "target", { writable: false, value: input });
    handlers.onPaste(event);
  } catch {
    return false;
  }
  return input.value.trim() === value;
}

function applyDigitToReactInput(
  input: HTMLInputElement,
  handlers: ReactHandlerBag,
  previous: string,
  next: string,
  char: string,
): void {
  syncReactValueTracker(input, previous);
  setNativeInputValue(input, next);

  if (handlers.onBeforeInput) {
    const before = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: "insertText",
      data: char,
    });
    Object.defineProperty(before, "target", { writable: false, value: input });
    handlers.onBeforeInput(before);
  }

  dispatchInsertText(input, char, "insertText");

  if (handlers.onValueChange) {
    handlers.onValueChange(next);
  }
  if (handlers.onUpdate) {
    handlers.onUpdate(next);
  }
  if (handlers.onInput) {
    invokeHandler(input, handlers.onInput, "input");
  }
  if (handlers.onChange) {
    invokeHandler(input, handlers.onChange, "change");
  }
}

function fillReactInputDigitByDigit(
  input: HTMLInputElement,
  handlers: ReactHandlerBag,
  value: string,
): void {
  syncReactValueTracker(input, "");
  setNativeInputValue(input, "");

  let built = "";
  for (const char of value) {
    const previous = built;
    built += char;
    applyDigitToReactInput(input, handlers, previous, built, char);
  }
}

function finishReactInput(input: HTMLInputElement, handlers: ReactHandlerBag): void {
  input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  if (handlers.onBlur) {
    invokeHandler(input, handlers.onBlur, "blur");
  }
}

/** Drive a React-controlled input by calling its internal handlers. */
export function tryFillViaReactHandlers(input: HTMLInputElement, value: string): boolean {
  const match = findReactInputHandlers(input);
  if (!match) {
    return false;
  }

  const { handlers } = match;
  input.focus({ preventScroll: true });

  if (tryFillViaReactPaste(input, handlers, value)) {
    finishReactInput(input, handlers);
    return true;
  }

  fillReactInputDigitByDigit(input, handlers, value);
  if (input.value.trim() === value) {
    finishReactInput(input, handlers);
    return true;
  }

  // Living Design may only commit on per-digit onChange; retry if DOM was reset.
  fillReactInputDigitByDigit(input, handlers, value);
  finishReactInput(input, handlers);
  return input.value.trim() === value;
}
