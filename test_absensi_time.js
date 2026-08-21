const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').config({ path: '.env.local' });
if (!env.parsed) require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE);

async function check() {
  const { data } = await supabase.from('absensi').select('jam_masuk, jam_pulang, tanggal').order('tanggal', { ascending: false }).limit(2);
  console.log("absensi raw:", data);
}
check();
