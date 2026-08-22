const fs = require('fs');

const files = [
  'lib/dashboard.ts',
  'lib/laporan-kasir.ts',
  'lib/laporan-keuangan.ts',
  'app/api/laporan/penjualan/route.ts',
  'app/api/laporan/penjualan/export/route.ts',
  'app/api/laporan/penjualan/rekap/route.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Match .from("transaksi_keluar") followed by .select(...) 
  // We use a regex that matches .from("transaksi_keluar") and the next .select(...) including multiline selects
  // and inserts .eq("status", "berhasil") right after the closing parenthesis of .select()
  
  content = content.replace(/\.from\("transaksi_keluar"\)\s*\.select\([^)]*\)/g, match => {
    return match + '\n      .eq("status", "berhasil")';
  });
  
  // Also handle .select(` ... `) which has backticks
  content = content.replace(/\.from\("transaksi_keluar"\)\s*\.select\(`[^`]*`\)/g, match => {
    return match + '\n      .eq("status", "berhasil")';
  });
  
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
});
