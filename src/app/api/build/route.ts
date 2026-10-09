import { buildInfo } from "@/lib/build-info";
export function GET() {
  return Response.json(buildInfo(), { headers: { "Cache-Control": "public, max-age=0, must-revalidate" } });
}
