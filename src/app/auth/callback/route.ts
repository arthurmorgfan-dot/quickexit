import { authCallbackDestination } from "@/lib/account/auth-flows";
import { requestOrigin } from "@/lib/account/request-origin";
import { serverSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  let destination = "/signin?confirmation=failed";
  try {
    destination = await authCallbackDestination(
      await serverSupabase(),
      new URL(request.url),
    );
  } catch {
    /* No credentials in redirects/logs. */
  }
  const response = NextResponse.redirect(
    new URL(destination, requestOrigin(request)),
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
