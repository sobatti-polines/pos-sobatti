const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const nowUtc = Date.now();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc + wibOffset);
  const todayStr = nowWIB.toISOString().slice(0, 10);
  console.log("todayStr:", todayStr);

  const { data: todayRes } = await supabase
      .from("transaksi_keluar")
      .select("total, detail_transaksi_keluar(qty)")
      .gte("tgl_transaksi", `${todayStr}T00:00:00`)
      .lte("tgl_transaksi", `${todayStr}T23:59:59`);

  console.log("todayRes size:", todayRes?.length);
  if (todayRes) {
    let sum = 0;
    todayRes.forEach(r => sum += r.total);
    console.log("sum:", sum);
  }
}
check();
