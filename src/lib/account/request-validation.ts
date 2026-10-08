import {
  decodePaperTrading,
  encodePaperTrading,
} from "../paper-trading-storage";
import type { CloudCommand } from "./cloud-api";
export function parseCloudCommand(body: unknown): CloudCommand | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      b.id,
    ) ||
    !Number.isSafeInteger(b.revision) ||
    (b.revision as number) < 0 ||
    !["save", "import", "skip_import"].includes(String(b.kind)) ||
    "userId" in b ||
    "user_id" in b
  )
    return null;
  try {
    const restored = decodePaperTrading(JSON.stringify(b.payload));
    if (!restored) return null;
    return {
      id: b.id,
      revision: b.revision as number,
      kind: b.kind as CloudCommand["kind"],
      raw: encodePaperTrading(restored),
    };
  } catch {
    return null;
  }
}
/** Bound the stream before accumulating an untrusted body, even without Content-Length. */
export async function readCloudBody(
  request: Request,
  max = 2_100_000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > max)
    throw Error("too_large");
  if (!request.body) throw Error("invalid_json");
  const reader = request.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw Error("too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}
