const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data: raw1 } = await supabase
    .from("transaksi_keluar")
    .select("tgl_transaksi")
    .lte("tgl_transaksi", "2026-08-21T16:59:59.000Z")
    .gte("tgl_transaksi", "2026-08-21T17:00:00");
  
  console.log("Matches between 17:00 and 16:59Z:", raw1);
}
check();
