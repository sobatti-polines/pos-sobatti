import { createClient } from "@supabase/supabase-js";

export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SERVICE_ROLE;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SERVICE_ROLE env");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
