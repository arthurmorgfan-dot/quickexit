export const INTRO_KEY = "quickexit.introduction";
export type IntroStorage = Pick<Storage, "getItem" | "setItem">;
export function introductionSeen(storage: IntroStorage): boolean {
  try { return storage.getItem(INTRO_KEY) === "v1:complete"; } catch { return false; }
}
export function completeIntroduction(storage: IntroStorage): boolean {
  try { storage.setItem(INTRO_KEY, "v1:complete"); return true; } catch { return false; }
}
/** User-written text only: never attach account, portfolio, URL, or device data. */
export function feedbackReport(kind: string, text: string): string | null {
  if (!["Bug", "Suggestion"].includes(kind) || typeof text !== "string") return null;
  const body = text.trim();
  if (body.length < 10 || body.length > 2000) return null;
  return `QuickExit private beta feedback\nType: ${kind}\n\n${body}\n`;
}
