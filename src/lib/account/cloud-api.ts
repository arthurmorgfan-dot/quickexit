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
/** Validate acknowledgements before a retry journal can be cleared. */
export function decodeCloudReply(value: unknown, userId: string): CloudReply {
  if (!value || typeof value !== "object") throw Error("Invalid cloud response");
  const reply = value as CloudReply;
  if (!["saved", "duplicate", "conflict", "import_unavailable"].includes(reply.status)) throw Error("Invalid cloud response");
  const record = decodeCloudRecord(reply.record, userId);
  if (["saved", "duplicate"].includes(reply.status) && (
    !Number.isSafeInteger(reply.committedRevision) || reply.committedRevision! < 1 ||
    reply.committedRevision! > record.revision || !record.raw ||
    (reply.status === "saved" && reply.committedRevision !== record.revision)
  )) throw Error("Invalid cloud acknowledgement");
  return { status: reply.status, record, ...(reply.committedRevision === undefined ? {} : { committedRevision: reply.committedRevision }) };
}
export class CloudTransportError extends Error {
  constructor(
    public readonly kind: "auth" | "network",
    public readonly status: number,
  ) {
    super(
      kind === "auth"
        ? "Your session ended. Sign in again; your device copy and pending changes are kept."
        : "Cloud sync is unavailable. Your device copy is kept.",
    );
  }
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
      throw new CloudTransportError(
        response.status === 401 ? "auth" : "network",
        response.status,
      );
    return response.json();
  };
  return {
    load: async (userId, signal) =>
      decodeCloudRecord(await send("GET", signal), userId),
    commit: async (userId, command, signal) => {
      const reply = await send("POST", signal, {
        ...command,
        payload: JSON.parse(command.raw),
        raw: undefined,
      });
      return decodeCloudReply(reply, userId);
    },
  };
}
