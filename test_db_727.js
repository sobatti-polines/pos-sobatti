const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.from('transaksi_keluar').select('tgl_transaksi, total, id');
  let sumsByDay = {};
  data.forEach(r => {
     let day = r.tgl_transaksi.split('T')[0];
     if (r.tgl_transaksi.includes(' ')) day = r.tgl_transaksi.split(' ')[0];
     sumsByDay[day] = (sumsByDay[day] || 0) + r.total;
  });
  console.log(sumsByDay);

  let yesterdayTotal = 0;
  let yesterdayCount = 0;
  data.forEach(r => {
    if (r.tgl_transaksi.startsWith("2026-08-21")) {
       yesterdayTotal += r.total;
       yesterdayCount++;
    }
  });
  console.log("Aug 21 total:", yesterdayTotal, "count:", yesterdayCount);
}
check();
