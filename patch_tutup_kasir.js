const fs = require('fs');
let code = fs.readFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', 'utf8');

code = code.replace(
  /\{\/\* LANGKAH 1 — BUKA SESI \*\/\}[\s\S]*?\{!sudahDibuka && \([\s\S]*?\{\/\* LANGKAH 2/g,
  `{/* LANGKAH 1 — BUKA SESI */}
            {!sudahDibuka && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 border border-border/50 rounded-2xl">
                <AlertCircle className="w-12 h-12 text-warning mb-4" />
                <h3 className="text-xl font-medium text-foreground">Sesi Kasir Belum Dibuka</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Anda tidak bisa menutup kasir karena sesi hari ini belum dibuka. Silakan menuju halaman <strong>Buka Kasir</strong> terlebih dahulu.
                </p>
              </div>
            )}

            {/* LANGKAH 2`
);

fs.writeFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', code);
