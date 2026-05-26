"use client";

export function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="bg-primary text-primary-foreground text-[16px] h-10 rounded-full px-4 hover:bg-primary/90 transition-colors font-normal inline-flex items-center justify-center"
    >
      Cetak Invoice
    </button>
  );
}