export function buildSkuSearchCorpus(messageText: string, urls: string[]): string {
  if (urls.length === 0) {
    return messageText;
  }
  return `${messageText}\n${urls.join("\n")}`;
}
