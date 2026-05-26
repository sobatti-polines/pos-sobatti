const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODA4NjAsImV4cCI6MjA5NDU1Njg2MH0.g8T8bqO6vx6Rc-HgNf1IAR4-pksoYx_PekJZAY7_aCg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: existing } = await supabase
    .from('metode_bayar')
    .select('id')
    .ilike('nama', 'DP')
    .maybeSingle();
  
  if (!existing) {
    console.log('Adding DP payment method...');
    const { error } = await supabase
      .from('metode_bayar')
      .insert([{ nama: 'DP' }]);
    
    if (error) console.error('Error adding DP:', error);
    else console.log('DP payment method added successfully.');
  } else {
    console.log('DP payment method already exists.');
  }
}
run();
