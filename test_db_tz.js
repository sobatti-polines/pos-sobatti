const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.from('transaksi_keluar').select('tgl_transaksi').limit(1);
  console.log("tgl_transaksi raw:", data);
}
check();
