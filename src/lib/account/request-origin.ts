/** Next's internal request URL may use localhost behind a proxy. The browser Host is authoritative for same-origin checks. */
export function requestOrigin(request: Request): string {
  const internal = new URL(request.url);
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return internal.origin;
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol =
    forwarded === "https"
      ? "https:"
      : forwarded === "http"
        ? "http:"
        : internal.protocol;
  return new URL(`${protocol}//${host}`).origin;
}
export function sameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && origin === requestOrigin(request);
}
