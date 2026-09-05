import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },

      // Pastikan setiap request ke Supabase selalu fresh (no-cache)
      // Ini penting untuk halaman yang bergantung pada data real-time seperti jadwal
      global: {
        fetch: (url, options) => {
          const defaultOptions = {
            ...options,
            cache: "no-store" as const,
          };
          return fetch(url, defaultOptions);
        },
      },
    }
  );
}
