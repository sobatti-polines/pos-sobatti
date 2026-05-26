const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODA4NjAsImV4cCI6MjA5NDU1Njg2MH0.g8T8bqO6vx6Rc-HgNf1IAR4-pksoYx_PekJZAY7_aCg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('transaksi_keluar')
    .select(`
      *,
      pelanggan:id_pelanggan ( nama_pelanggan, alamat, no_hp ),
      kasir:id_kasir ( username ),
      metode_bayar:id_metode_bayar ( nama )
    `)
    .limit(1);
  console.log('Error:', error);
  if (data && data.length > 0) {
    console.log('ID field:', data[0].id);
    console.log('No Transaksi:', data[0].no_transaksi);
  } else {
    console.log('No data found.');
  }
}
run();
