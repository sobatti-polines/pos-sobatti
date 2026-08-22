const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.from('transaksi_keluar').select('tgl_transaksi, total').gte('tgl_transaksi', '2026-08-22T00:00:00').lte('tgl_transaksi', '2026-08-22T23:59:59');
  console.log("Trans on 22nd:", data);
}
check();
