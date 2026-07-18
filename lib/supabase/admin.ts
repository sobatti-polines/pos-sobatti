import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SERVICE_ROLE;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SERVICE_ROLE must be set");
}

export const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

export async function createAdminClient() {
  return createClient(supabaseUrl!, serviceRoleKey!);
}
