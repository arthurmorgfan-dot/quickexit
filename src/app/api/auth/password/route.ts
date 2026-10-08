import { serverSupabase } from "@/lib/supabase/server";
import { createPasswordApi } from "@/lib/account/password-api";
export const POST = createPasswordApi(serverSupabase);
