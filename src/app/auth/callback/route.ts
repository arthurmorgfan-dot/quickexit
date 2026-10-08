import { requestOrigin } from "@/lib/account/request-origin";
import { serverSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  try {
    const client = await serverSupabase();
    if (client && code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL("/app", requestOrigin(request)));
    }
  } catch {
    /* No credentials/tokens included in redirects or logs. */
  }
  return NextResponse.redirect(
    new URL("/signin?confirmation=failed", requestOrigin(request)),
  );
}
