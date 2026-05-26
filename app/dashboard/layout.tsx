import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;

  if (role === "KASIR") {
    redirect("/pos");
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background flex-col md:flex-row">
      <DashboardSidebar role={role} />
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <DashboardMobileNav role={role} />
        <main className="flex-1 overflow-auto flex flex-col w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
