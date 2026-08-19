const fs = require('fs');
let content = fs.readFileSync('app/dashboard/inventory/actions.ts', 'utf8');

// Add import if not exists
if (!content.includes('supabaseAdmin')) {
  content = 'import { supabaseAdmin } from "@/lib/supabase/admin";\n' + content;
}

// Replace supabase.from(...) with supabaseAdmin.from(...) inside forceDeleteProduct
const forceDeleteRegex = /export async function forceDeleteProduct[\s\S]*?revalidatePath\("\/dashboard\/inventory"\);\n  return { success: true };\n}/;
let forceDeleteFunc = content.match(forceDeleteRegex)[0];

forceDeleteFunc = forceDeleteFunc.replace(
  /await supabase\.from\("event_promo_produk"\)/g,
  'await supabaseAdmin.from("event_promo_produk")'
);
forceDeleteFunc = forceDeleteFunc.replace(
  /await supabase\.from\("stok_opname_sesi_detail"\)/g,
  'await supabaseAdmin.from("stok_opname_sesi_detail")'
);
forceDeleteFunc = forceDeleteFunc.replace(
  /await supabase\.from\("stok_opname"\)/g,
  'await supabaseAdmin.from("stok_opname")'
);
forceDeleteFunc = forceDeleteFunc.replace(
  /await supabase\.from\("barang_masuk"\)/g,
  'await supabaseAdmin.from("barang_masuk")'
);
forceDeleteFunc = forceDeleteFunc.replace(
  /await supabase\.from\("riwayat_avco"\)/g,
  'await supabaseAdmin.from("riwayat_avco")'
);
forceDeleteFunc = forceDeleteFunc.replace(
  /const { error } = await supabase\.from\("produk"\)\.delete\(\)\.eq\("id", id\);/g,
  'const { error } = await supabaseAdmin.from("produk").delete().eq("id", id);'
);

content = content.replace(forceDeleteRegex, forceDeleteFunc);

fs.writeFileSync('app/dashboard/inventory/actions.ts', content);
console.log('actions.ts patched 2');
