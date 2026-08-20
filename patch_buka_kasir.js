const fs = require('fs');
let code = fs.readFileSync('app/dashboard/buka-kasir/buka-kasir-client.tsx', 'utf8');

code = code.replace(/TutupKasirClient/g, 'BukaKasirClient');
code = code.replace(
  /\{\/\* LANGKAH 2 — TUTUP KASIR \*\/\}[\s\S]*?\{sudahDibuka && \([\s\S]*?\n\s*\)\}/g,
  `{sudahDibuka && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 border border-border/50 rounded-2xl">
                <Check className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-xl font-medium text-foreground">Kasir Sudah Dibuka</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Sesi kasir untuk hari ini telah berhasil dibuka. Silakan menuju halaman <strong>Tutup Kasir</strong> di penghujung hari untuk mengakhiri sesi.
                </p>
              </div>
            )}`
);
// Also rename `import { ... } from "./actions"` to `from "../tutup-kasir/actions"` since we copied the file
code = code.replace(/from "\.\/actions"/g, 'from "../tutup-kasir/actions"');

fs.writeFileSync('app/dashboard/buka-kasir/buka-kasir-client.tsx', code);
