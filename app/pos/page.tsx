import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPosBootstrapData } from "@/lib/pos-data";
import { PosClient } from "./pos-client";
// Kerangka yang sama dengan app/pos/loading.tsx supaya tampilan tunggu
// konsisten, baik saat pindah halaman maupun saat data awal sedang diambil.
import PosLoading from "./loading";

export default async function PosPage() {
  // VULN-003 fix: layouts are not a security boundary in Next.js; verify auth per-page.
  // getSessionUser() di-dedupe per request, jadi layout /pos dan halaman ini
  // tidak menempuh dua round-trip auth yang terpisah.
  const user = await getSessionUser();
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

  const username: string =
    user.user_metadata?.username || user.email?.split("@")[0] || "Kasir";

  // Data katalog diambil di dalam boundary Suspense. Kerangka POS + bundel JS
  // dikirim ke browser lebih dulu, lalu data menyusul: jadi unduhan JS (biaya
  // terbesar di jaringan lambat) berjalan bersamaan dengan query database,
  // bukan sesudahnya. Rincian pengambilan data ada di lib/pos-data.ts.
  return (
    <Suspense fallback={<PosLoading />}>
      <PosBootstrap username={username} />
    </Suspense>
  );
}

async function PosBootstrap({ username }: { username: string }) {
  const initialData = await getPosBootstrapData(username);
  return <PosClient initialData={initialData} />;
}
