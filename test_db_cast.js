const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.rpc('process_checkout', {}).select('*'); 
  // Let's just use a direct query. We can't do arbitrary SQL, but we can query transaksi_keluar.
  const { data: raw } = await supabase
    .from("transaksi_keluar")
    .select("tgl_transaksi, total")
    .lte("tgl_transaksi", "2026-08-21T16:59:59.000Z")
    .gte("tgl_transaksi", "2026-08-21T16:00:00.000Z");
  console.log("Matched:", raw);
}
check();
