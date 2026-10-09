/** In-process abuse guard, not a distributed/edge rate limiter. No IP trust or personal data. */
export function createRequestLimit({ capacity, perSecond, maxKeys = 1, now = Date.now }: {
  capacity: number; perSecond: number; maxKeys?: number; now?: () => number;
}) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isFinite(perSecond) || perSecond <= 0 || !Number.isSafeInteger(maxKeys) || maxKeys < 1) throw Error("Invalid request limit");
  const entries = new Map<string, { tokens: number; at: number; usedAt: number }>();
  return (key = "global"): number => {
    const time = now();
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= maxKeys) {
        for (const [name, value] of entries) if (time - value.usedAt >= capacity / perSecond * 1000) entries.delete(name);
        if (entries.size >= maxKeys) return Math.ceil(capacity / perSecond);
      }
      entry = { tokens: capacity, at: time, usedAt: time }; entries.set(key, entry);
    }
    entry.tokens = Math.min(capacity, entry.tokens + Math.max(0, time - entry.at) / 1000 * perSecond);
    entry.at = Math.max(time, entry.at); entry.usedAt = Math.max(time, entry.usedAt);
    if (entry.tokens < 1) return Math.max(1, Math.ceil((1 - entry.tokens) / perSecond));
    entry.tokens -= 1; return 0;
  };
}
