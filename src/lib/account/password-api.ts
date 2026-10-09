import { createRequestLimit } from "../request-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changePassword } from "./auth-flows";
import { readCloudBody } from "./request-validation";
import { sameOriginWrite } from "./request-origin";
export function createPasswordApi(
  getClient: () => Promise<SupabaseClient | null>,
  limit = createRequestLimit({ capacity: 10, perSecond: 0.5 }),
) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  return async function POST(request: Request) {
    if (!sameOriginWrite(request))
      return reply({ ok: false, message: "Invalid origin." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return reply({ ok: false, message: "JSON required." }, 415);
    const retryAfter = limit();
    if (retryAfter) return Response.json({ ok: false, message: "Too many password requests. Try again shortly." }, { status: 429, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Retry-After": String(retryAfter) } });
    try {
      let input: unknown;
      try {
        input = await readCloudBody(request, 4096);
      } catch (error) {
        return reply(
          { ok: false, message: "Invalid or oversized JSON." },
          error instanceof Error && error.message === "too_large" ? 413 : 400,
        );
      }
      const body = input as Record<string, unknown>;
      if (
        !body ||
        typeof body.password !== "string" ||
        typeof body.confirmation !== "string" ||
        typeof body.expectedUser !== "string"
      )
        return reply({ ok: false, message: "Invalid password request." }, 400);
      const result = await changePassword(
        await getClient(),
        body.password,
        body.confirmation,
        body.expectedUser,
      );
      const status = result.ok
        ? 200
        : result.reason === "invalid"
          ? 400
          : result.reason === "unauthenticated"
            ? 401
            : 503;
      return reply({ ok: result.ok, message: result.message }, status);
    } catch {
      return reply(
        {
          ok: false,
          message: "Password update unavailable. Please try again.",
        },
        503,
      );
    }
  };
}
