let settingsMutationTail: Promise<void> = Promise.resolve();

export function runSettingsMutationExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsMutationTail.then(operation, operation);
  settingsMutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
