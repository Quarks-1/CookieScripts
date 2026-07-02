import { describe, expect, it } from "vitest";

import {
  detectQueuePassFromBanner,
  detectQueuePassFromNavigation,
  detectQueuePassFromTickets,
  hasPendingTickets,
  isHoldSpotNavigation,
  parseValidateTicketsResponse,
} from "@ext/domains/walmart/lib/queue-pass.ts";

const VALID_TICKET_FIXTURE = JSON.stringify([
  {
    queue: "qa007b65c6a174",
    itemId: "19607974314",
    state: "valid",
    customMetadata: { item: { name: "Zygarde Premium Collection" } },
  },
]);

describe("parseValidateTicketsResponse", () => {
  it("parses top-level ticket array", () => {
    const tickets = parseValidateTicketsResponse(VALID_TICKET_FIXTURE);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.state).toBe("valid");
    expect(tickets[0]?.queue).toBe("qa007b65c6a174");
  });

  it("parses wrapped tickets object", () => {
    const tickets = parseValidateTicketsResponse(
      JSON.stringify({
        tickets: [{ queue: "q1", itemId: "123", state: "pending" }],
      }),
    );
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.state).toBe("pending");
  });
});

describe("detectQueuePassFromTickets", () => {
  it("emits valid tickets not yet seen", () => {
    const tickets = parseValidateTicketsResponse(VALID_TICKET_FIXTURE);
    const events = detectQueuePassFromTickets(tickets, new Set());
    expect(events).toHaveLength(1);
    expect(events[0]?.itemId).toBe("19607974314");
  });

  it("skips already seen tickets", () => {
    const tickets = parseValidateTicketsResponse(VALID_TICKET_FIXTURE);
    const events = detectQueuePassFromTickets(tickets, new Set(["qa007b65c6a174:19607974314"]));
    expect(events).toHaveLength(0);
  });
});

describe("detectQueuePassFromBanner", () => {
  it("detects ready count increase", () => {
    const result = detectQueuePassFromBanner(
      "You're in line for 11 items. 1 item is ready to buy.",
      0,
    );
    expect(result).toEqual({ readyCount: 1, newPasses: 1 });
  });

  it("returns null when count unchanged", () => {
    expect(
      detectQueuePassFromBanner("You're in line for 2 items.", 2),
    ).toBeNull();
  });
});

describe("detectQueuePassFromNavigation", () => {
  it("detects qp to product navigation", () => {
    const event = detectQueuePassFromNavigation(
      "https://www.walmart.com/qp?qpdata=abc",
      "https://www.walmart.com/ip/foo/12345",
      new Set(),
    );
    expect(event?.itemId).toBe("12345");
    expect(event?.source).toBe("nav");
  });
});

describe("hasPendingTickets", () => {
  it("returns true when any pending", () => {
    expect(
      hasPendingTickets(
        parseValidateTicketsResponse(
          JSON.stringify([{ queue: "q", itemId: "1", state: "pending" }]),
        ),
      ),
    ).toBe(true);
  });
});

describe("isHoldSpotNavigation", () => {
  it("detects qp to homepage", () => {
    expect(
      isHoldSpotNavigation(
        "https://www.walmart.com/qp?qpdata=abc",
        "https://www.walmart.com/",
      ),
    ).toBe(true);
  });
});
