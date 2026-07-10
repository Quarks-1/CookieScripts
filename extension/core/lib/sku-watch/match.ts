function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function messageContainsExactSku(corpus: string, sku: string): boolean {
  if (!sku) {
    return false;
  }
  const pattern = new RegExp(`(?:^|[^\\d])${escapeRegex(sku)}(?:[^\\d]|$)`);
  return pattern.test(corpus);
}
