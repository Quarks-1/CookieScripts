function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RetryUntilConfirmedOptions = {
  retryIntervalMs: number;
  shouldContinue: () => boolean;
  isConfirmed: () => boolean;
  tryAction: () => Promise<void>;
};

export async function retryUntilConfirmed(
  options: RetryUntilConfirmedOptions,
): Promise<"confirmed" | "aborted"> {
  while (options.shouldContinue()) {
    if (options.isConfirmed()) {
      return "confirmed";
    }

    await options.tryAction();

    if (options.isConfirmed()) {
      return "confirmed";
    }

    await sleep(options.retryIntervalMs);
  }

  return options.isConfirmed() ? "confirmed" : "aborted";
}
