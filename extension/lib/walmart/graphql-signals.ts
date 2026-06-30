const GQL_SIGNALS: Record<string, string> = {
  updateItems: "gql_atc",
  getCart: "gql_cart_read",
  MergeAndGetCart: "gql_cart_init",
};

export function graphqlSignalForOperation(operation?: string): string | undefined {
  if (!operation) {
    return undefined;
  }
  return GQL_SIGNALS[operation];
}

export function isOrchestraFailureStatus(status?: number): boolean {
  return status === 412 || status === 418 || status === 429 || status === 456 || status === 521;
}
