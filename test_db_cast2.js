const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data: raw1 } = await supabase
    .from("transaksi_keluar")
    .select("tgl_transaksi, total")
    .lte("tgl_transaksi", "2026-08-21T16:59:59.000Z");
  
  let sum = 0;
  raw1.forEach(r => sum += r.total);
  console.log("Sum for lte 16:59:59Z:", sum);
}
check();
