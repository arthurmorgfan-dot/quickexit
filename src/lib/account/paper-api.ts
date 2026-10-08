import type { SupabaseClient } from "@supabase/supabase-js";
import { sameOriginWrite } from "@/lib/account/request-origin";
import {
  parseCloudCommand,
  readCloudBody,
} from "@/lib/account/request-validation";
import type { CloudRecord } from "@/lib/account/cloud-api";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const record = (
  row: {
    user_id: string;
    revision: number;
    import_decided: boolean;
    payload: unknown;
  } | null,
  userId: string,
): CloudRecord => {
  if (row && row.user_id !== userId)
    throw new Error("Cloud ownership mismatch");
  return {
    userId,
    revision: row?.revision ?? 0,
    importDecided: row?.import_decided ?? false,
    raw: row?.payload ? JSON.stringify(row.payload) : null,
  };
};
export function createPaperApi(
  getClient: () => Promise<SupabaseClient | null>,
) {
  async function verifiedClient() {
    const client = await getClient();
    if (!client)
      return {
        response: reply({ error: "Accounts are not configured." }, 503),
      };
    const { data, error } = await client.auth.getUser();
    if (
      error &&
      (error.status === 0 ||
        (error.status ?? 0) >= 500 ||
        error.name === "AuthRetryableFetchError")
    )
      return {
        response: reply(
          { error: "Authentication temporarily unavailable." },
          503,
        ),
      };
    if (error || !data.user)
      return { response: reply({ error: "Sign in required." }, 401) };
    return { client, user: data.user };
  }
  async function GET() {
    try {
      const verified = await verifiedClient();
      if (verified.response) return verified.response;
      const { data, error } = await verified
        .client!.from("paper_workspaces")
        .select("user_id,payload,revision,import_decided")
        .eq("user_id", verified.user!.id)
        .maybeSingle();
      if (error) return reply({ error: "Cloud state unavailable." }, 503);
      return reply(record(data, verified.user!.id));
    } catch {
      return reply({ error: "Cloud state unavailable." }, 503);
    }
  }
  async function POST(request: Request) {
    // Cookie-authenticated writes require same-origin requests. No client-supplied owner is accepted.
    if (!sameOriginWrite(request))
      return reply({ error: "Invalid origin." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return reply({ error: "JSON required." }, 415);
    try {
      const verified = await verifiedClient();
      if (verified.response) return verified.response;
      let body: unknown;
      try {
        body = await readCloudBody(request);
      } catch (error) {
        return reply(
          { error: "Invalid or oversized JSON." },
          error instanceof Error && error.message === "too_large" ? 413 : 400,
        );
      }
      const command = parseCloudCommand(body);
      if (!command)
        return reply({ error: "Invalid paper-trading request." }, 400);
      const { data: result, error } = await verified.client!.rpc(
        "commit_paper_workspace",
        {
          p_expected_revision: command.revision,
          p_operation_id: command.id,
          p_payload: JSON.parse(command.raw),
          p_kind: command.kind,
        },
      );
      if (error) return reply({ error: "Unable to save paper state." }, 503);
      return reply({
        ...result,
        record: record(result.record, verified.user!.id),
      });
    } catch {
      return reply({ error: "Unable to save paper state." }, 503);
    }
  }

  return { GET, POST };
}
