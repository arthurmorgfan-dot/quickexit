import { redirect } from "next/navigation";
export async function LegacyHomeRedirect({searchParams}: {searchParams: Promise<{demo?: string}>}) {
 const params=await searchParams;
 return redirect(params.demo === "1" ? "/app?view=Portfolio&demo=1" : "/app?view=Portfolio");
}

