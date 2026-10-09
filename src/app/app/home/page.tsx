import { Suspense } from "react";
import { redirect } from "next/navigation";
export async function LegacyHomeRedirect({searchParams}: {searchParams: Promise<{demo?: string}>}) {
 const params=await searchParams;
 return redirect(params.demo === "1" ? "/app?view=Portfolio&demo=1" : "/app?view=Portfolio");
}

export default function LegacyHome(props: {searchParams: Promise<{demo?: string}>}) {
 return <Suspense fallback={<p role="status">Opening your portfolio…</p>}><LegacyHomeRedirect {...props} /></Suspense>;
}
