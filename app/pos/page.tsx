import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosClient } from "./pos-client";

export default async function PosPage() {
  const supabase = await createClient();

  // VULN-003 fix: layouts are not a security boundary in Next.js; verify auth per-page.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;

  // Halaman POS khusus KASIR. Redirect sebelum render agar non-KASIR tidak
  // pernah melihat UI kasir (tanpa flash). Akses halaman per role dijaga
  // oleh proxy.ts.
  if (role !== "KASIR") {
    redirect("/dashboard");
  }

  return <PosClient />;
}
