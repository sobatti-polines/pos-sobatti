"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();
  // Tanpa penanda proses, klik "Keluar" tidak memberi umpan balik apa pun
  // selama signOut + redirect berjalan.
  const [keluar, setKeluar] = useState(false);

  const handleLogout = async () => {
    if (keluar) return;
    setKeluar(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setKeluar(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleLogout}
      disabled={keluar}
      className="rounded-full w-10 h-10 border-border bg-background cursor-pointer"
      title="Keluar"
    >
      {keluar ? (
        <Loader2 className="w-4 h-4 animate-spin text-foreground" />
      ) : (
        <LogOut className="w-4 h-4 text-foreground" />
      )}
    </Button>
  );
}
