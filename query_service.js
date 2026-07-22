import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk4MDg2MCwiZXhwIjoyMDk0NTU2ODYwfQ.GJQI4vuFlqAC5qSWtqVL8znooL5CKSM73SfvADCjJCA'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('produk').select('id, nama_produk, barcode, sku').limit(5)
  console.log("All Products Sample:")
  console.log(data)

  const { data: withBarcode, error: err2 } = await supabase.from('produk').select('id, nama_produk, barcode').not('barcode', 'is', null).neq('barcode', '')
  console.log("Products WITH Barcode:")
  console.log(withBarcode)
}
test()
