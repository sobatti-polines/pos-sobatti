import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function PosLayout({
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

  // Since we are in a Layout, we can't easily get the current path without 'headers' 
  // or passing it from middleware, but we can simplify the logic:
  // ONLY redirect if the user is an ADMIN/OWNER and NOT on a specific subpage that we want to allow.
  // A better way is to move this check to the specific pages or use middleware.
  // For now, let's just remove the strict redirect from the layout so they can at least view invoices.
  // We can add a redirect inside 'app/pos/page.tsx' instead for the main POS screen.

  return (
    <div className="flex min-h-[100dvh] md:h-[100dvh] md:overflow-hidden bg-background">
      <div className="flex-1 md:overflow-hidden flex flex-col w-full">
        {children}
      </div>
    </div>
  );
}
