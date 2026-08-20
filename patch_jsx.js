const fs = require('fs');
let code = fs.readFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', 'utf8');

code = code.replace(
  /\{sudahDitutup \? \(\n\s*<div className="flex items-start/g,
  `{sudahDitutup ? (\n                    <div className="flex flex-col gap-4">\n                    <div className="flex items-start`
);
code = code.replace(
  /Cetak Laporan<\/Button>\n\s*\) : \(/g,
  `Cetak Laporan</Button>\n                    </div>\n                  ) : (`
);

fs.writeFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', code);
