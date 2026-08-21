const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data, error } = await supabase
    .from('transaksi_keluar')
    .select('id, no_transaksi, tgl_transaksi, total, bayar, kembali')
    .order('tgl_transaksi', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }
  
  let dashboardSum = 0;
  let allSum = 0;
  
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowWIB = new Date(nowUtc + wibOffset);
  const todayStr = nowWIB.toISOString().slice(0, 10);
  const todayStart = new Date(`${todayStr}T00:00:00+07:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59+07:00`);
  
  data.forEach(t => {
     allSum += t.total;
     const dt = new Date(t.tgl_transaksi);
     const isToday = dt >= todayStart && dt <= todayEnd;
     if (isToday) dashboardSum += t.total;
     console.log(`[${t.id}] ${t.no_transaksi} | ${t.tgl_transaksi} | ${t.total} | isToday: ${isToday}`);
  });
  
  console.log("All Sum:", allSum);
  console.log("Dashboard Sum:", dashboardSum);
  
  const todayStartStr = todayStart.toISOString();
  const todayEndStr = todayEnd.toISOString();
  console.log("Dashboard Range:", todayStartStr, "to", todayEndStr);
}

check();
