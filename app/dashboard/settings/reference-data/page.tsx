import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReferenceClient } from "./reference-client";

export const metadata = {
  title: "Data Referensi - POS",
};

export default async function ReferenceDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  // Based on access rules, Admin or Owner can access settings like Reference Data
  if (role !== "ADMIN" && role !== "OWNER") {
    redirect("/dashboard/settings");
  }

  // Fetch all reference data in parallel
  const [
    { data: kategori, error: errKategori },
    { data: satuan, error: errSatuan },
    { data: metode_bayar, error: errMetodeBayar }
  ] = await Promise.all([
    supabase.from("kategori").select("id, nama").order("id", { ascending: true }),
    supabase.from("satuan").select("id, nama").order("id", { ascending: true }),
    supabase.from("metode_bayar").select("id, nama").order("id", { ascending: true })
  ]);

  if (errKategori) console.error("Error fetching kategori:", errKategori);
  if (errSatuan) console.error("Error fetching satuan:", errSatuan);
  if (errMetodeBayar) console.error("Error fetching metode_bayar:", errMetodeBayar);

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full max-h-screen overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Data Referensi
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola kategori produk, satuan barang, dan metode pembayaran
        </p>
      </header>

      <ReferenceClient 
        initialKategori={kategori || []}
        initialSatuan={satuan || []}
        initialMetodeBayar={metode_bayar || []}
      />
    </div>
  );
}
