import { Suspense } from "react";
import { LegacyHomeRedirect } from "./redirect";

export default function LegacyHome(props: {searchParams: Promise<{demo?: string}>}) {
 return <Suspense fallback={<p role="status">Opening your portfolio…</p>}><LegacyHomeRedirect {...props} /></Suspense>;
}
