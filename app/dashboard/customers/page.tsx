import { createClient } from "@/lib/supabase/server";
import CustomersClient from "./customers-client";
import { redirect } from "next/navigation";

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: customers, error } = await supabase
    .from("pelanggan")
    .select("*")
    .order("nama_pelanggan", { ascending: true });

  if (error) {
    console.error("Error fetching customers:", error);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Data Pelanggan
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola informasi dan riwayat pelanggan Anda
        </p>
      </header>

      <CustomersClient initialCustomers={customers ?? []} />
    </div>
  );
}
