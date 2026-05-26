const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODA4NjAsImV4cCI6MjA5NDU1Njg2MH0.g8T8bqO6vx6Rc-HgNf1IAR4-pksoYx_PekJZAY7_aCg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('transaksi_keluar')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Columns in transaksi_keluar:', Object.keys(data[0]));
  } else {
    console.log('No data found in transaksi_keluar.');
  }
}
run();
