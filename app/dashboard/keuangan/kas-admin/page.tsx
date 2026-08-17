import { redirect } from "next/navigation";
import { getKasAdminData } from "./actions";
import KasAdminClient from "./kas-admin-client";

export default async function KasAdminPage() {
  const res = await getKasAdminData();
  if (res.error || !res.data) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Kas Admin
        </h1>
        <p className="text-muted-foreground mt-2">
          Kas operasional dari owner — penambahan saldo & pengeluaran (ATK, konsumsi, kebersihan).
        </p>
      </header>

      <KasAdminClient initialData={res.data} />
    </div>
  );
}
