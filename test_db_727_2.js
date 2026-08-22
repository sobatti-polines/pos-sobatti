const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.from('transaksi_keluar').select('tgl_transaksi, total, id');
  let sumsByDay = {};
  let countByDay = {};
  data.forEach(r => {
     let day = r.tgl_transaksi.split('T')[0];
     if (r.tgl_transaksi.includes(' ')) day = r.tgl_transaksi.split(' ')[0];
     sumsByDay[day] = (sumsByDay[day] || 0) + r.total;
     countByDay[day] = (countByDay[day] || 0) + 1;
  });
  console.log("Sums:", sumsByDay);
  console.log("Counts:", countByDay);
  
  // Also check if any evening transactions were accidentally pushed to the 22nd!
  // E.g. what time did the transactions on the 21st actually happen?
  data.filter(r => r.tgl_transaksi.startsWith("2026-08-21")).forEach(r => {
    console.log(r.tgl_transaksi, r.total);
  });
}
check();
