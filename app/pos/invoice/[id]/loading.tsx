import { Loader2 } from "lucide-react";

export default function InvoiceLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/20 print:hidden">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Menyiapkan cetakan...</p>
    </div>
  );
}
