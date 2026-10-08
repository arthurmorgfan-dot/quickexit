import {
  decodePaperTrading,
  encodePaperTrading,
} from "../paper-trading-storage";
export type AccountIdentity = { id: string; email: string };
export type CloudRecord = {
  userId: string;
  revision: number;
  importDecided: boolean;
  raw: string | null;
};
export type CloudCommand = {
  id: string;
  revision: number;
  raw: string;
  kind: "save" | "import" | "skip_import";
};
export type CloudReply = {
  status: "saved" | "duplicate" | "conflict" | "import_unavailable";
  record: CloudRecord;
  committedRevision?: number;
};
export interface CloudTransport {
  load(userId: string, signal: AbortSignal): Promise<CloudRecord>;
  commit(
    userId: string,
    command: CloudCommand,
    signal: AbortSignal,
  ): Promise<CloudReply>;
}
export const accountKey = (userId: string) => `quickexit.account.${userId}`;
export function decodeCloudRecord(value: unknown, userId: string): CloudRecord {
  const row = value as CloudRecord;
  if (
    !row ||
    row.userId !== userId ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    typeof row.importDecided !== "boolean"
  )
    throw Error("Invalid cloud record");
  if (row.raw === null) {
    if (row.revision !== 0 || row.importDecided)
      throw Error("Invalid empty cloud record");
    return { userId, revision: 0, importDecided: false, raw: null };
  }
  if (row.revision === 0 || !row.importDecided)
    throw Error("Invalid initialized cloud record");
  if (typeof row.raw !== "string") throw Error("Invalid cloud snapshot");
  const restored = decodePaperTrading(row.raw);
  if (!restored) throw Error("Invalid cloud snapshot");
  return {
    userId,
    revision: row.revision,
    importDecided: row.importDecided,
    raw: encodePaperTrading(restored),
  };
}
export function browserCloudTransport(
  request: typeof fetch = fetch,
): CloudTransport {
  const send = async (method: string, signal: AbortSignal, body?: unknown) => {
    const response = await request("/api/paper", {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw Error(
        response.status === 401
          ? "Sign in again to sync your saved paper trades."
          : "Cloud sync is unavailable. Your device copy is kept.",
      );
    return response.json();
  };
  return {
    load: async (userId, signal) =>
      decodeCloudRecord(await send("GET", signal), userId),
    commit: async (userId, command, signal) => {
      const reply = (await send("POST", signal, {
        ...command,
        payload: JSON.parse(command.raw),
        raw: undefined,
      })) as CloudReply;
      if (
        !["saved", "duplicate", "conflict", "import_unavailable"].includes(
          reply.status,
        )
      )
        throw Error("Invalid cloud response");
      return { ...reply, record: decodeCloudRecord(reply.record, userId) };
    },
  };
}
