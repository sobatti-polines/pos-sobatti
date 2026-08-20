import { Loader2 } from "lucide-react";

export default function PosLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/20 print:hidden">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-sm">Menyiapkan POS...</p>
      </div>
    </div>
  );
}
