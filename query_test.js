import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODA4NjAsImV4cCI6MjA5NDU1Njg2MH0.g8T8bqO6vx6Rc-HgNf1IAR4-pksoYx_PekJZAY7_aCg'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('produk').select('id, nama_produk, barcode').limit(10)
  console.log(data, error)
}
test()
