import { serverSupabase } from "@/lib/supabase/server";
import { createPaperApi } from "@/lib/account/paper-api";
const handlers = createPaperApi(serverSupabase);
export const GET = handlers.GET;
export const POST = handlers.POST;
