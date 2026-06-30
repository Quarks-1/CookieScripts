export function readCookieNames(): string[] {
  try {
    if (!document.cookie) {
      return [];
    }
    return document.cookie
      .split(";")
      .map((part) => part.trim().split("=")[0] ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}
