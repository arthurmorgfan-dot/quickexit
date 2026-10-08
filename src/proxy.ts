import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (
    !config ||
    (request.nextUrl.pathname === "/app" &&
      request.nextUrl.searchParams.get("demo") === "1")
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* Read-only page/demo access survives auth provider outages. API verifies independently. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/app/:path*", "/signin", "/signup", "/auth/:path*", "/api/paper"],
};
