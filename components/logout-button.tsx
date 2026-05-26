"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleLogout}
      className="rounded-full w-10 h-10 border-border bg-background cursor-pointer"
      title="Keluar"
    >
      <LogOut className="w-4 h-4 text-foreground" />
    </Button>
  );
}
