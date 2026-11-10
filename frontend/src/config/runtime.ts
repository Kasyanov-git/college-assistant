const LOCAL_BACKEND = "http://127.0.0.1:8000";

export function isFileProtocol(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "file:";
}

export function getApiBase(): string {
  return isFileProtocol() ? LOCAL_BACKEND : "";
}

export function withApiBase(path: string): string {
  return `${getApiBase()}${path}`;
}

export function toAbsoluteMediaUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${LOCAL_BACKEND}${url}`;
  return url;
}

export function getWebSocketUrl(path: string): string {
  if (isFileProtocol()) return `ws://127.0.0.1:8000${path}`;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

