const fs = require('fs');
let code = fs.readFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', 'utf8');

code = code.replace(
  /<Button variant="outline" className="mt-4" onClick=\{\(\) => window.print\(\)\}/g,
  `</div>\n                    <Button variant="outline" className="mt-4" onClick={() => window.print()}`
);
code = code.replace(
  /Cetak Laporan<\/Button>\n                    <\/div>/g,
  `Cetak Laporan</Button>`
);

fs.writeFileSync('app/dashboard/tutup-kasir/tutup-kasir-client.tsx', code);
