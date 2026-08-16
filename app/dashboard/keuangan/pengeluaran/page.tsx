import { redirect } from "next/navigation";
import {
  getKategoriBeban,
  getMetodeBayarOptions,
  getPengeluaranList,
} from "./actions";
import PengeluaranClient from "./pengeluaran-client";

export default async function PengeluaranPage() {
  const [kategoriRes, listRes, metodeOptions] = await Promise.all([
    getKategoriBeban(),
    getPengeluaranList(),
    getMetodeBayarOptions(),
  ]);

  if (kategoriRes.error || listRes.error) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Pengeluaran
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola pengeluaran operasional toko (kategori: ATK, Konsumsi, Kebersihan).
        </p>
      </header>

      <PengeluaranClient
        initialData={listRes.data ?? []}
        kategoriBeban={kategoriRes.data ?? []}
        metodeBayarOptions={metodeOptions}
      />
    </div>
  );
}