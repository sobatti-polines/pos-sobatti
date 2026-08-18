import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Pastikan dotenv di-install atau jalankan dengan --env-file

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aryyefzoieylcxpvxwlm.supabase.co';
const serviceRoleKey = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Missing SERVICE_ROLE key in environment variables.');
  console.error('Jalankan dengan: SERVICE_ROLE=your_key node scripts/gen-sku-barcode.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('🔍 Fetching products...');
  
  // Fetch all products (paginated)
  let allProducts = [];
  let from = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('produk')
      .select('id, nama_produk, sku, barcode, id_merk')
      .order('id')
      .range(from, from + chunkSize - 1);
    
    if (error) {
      console.error('Error fetching products:', error.message);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    if (data.length < chunkSize) break;
    from += chunkSize;
  }
  
  console.log(`📦 Found ${allProducts.length} products`);

  // Fetch all merks
  const { data: merks, error: merkErr } = await supabase
    .from('merk')
    .select('id, nama, kode');
  
  if (merkErr) {
    console.error('Error fetching merks:', merkErr.message);
    process.exit(1);
  }
  
  console.log(`🏷️  Found ${merks.length} merks`);
  
  const merkMap = new Map(
    merks.map(m => [m.id, { nama: m.nama, kode: m.kode || '' }])
  );

  // Helper: extract 3-letter abbreviation from product name
  const extractNamaAbbrev = (nama, merkNama) => {
    let cleaned = nama.toUpperCase();
    if (merkNama) {
      cleaned = cleaned.replace(new RegExp(merkNama.toUpperCase(), 'g'), '');
    }
    const letters = cleaned.replace(/[^A-Z]/g, '');
    return (letters.slice(0, 3) || 'XXX').padEnd(3, 'X');
  };

  // Generate SKUs
  const generatedSkus = new Set();
  // Pre-populate existing SKUs
  for (const p of allProducts) {
    if (p.sku) generatedSkus.add(p.sku.toUpperCase());
  }

  const baseCounter = new Map();
  const updates = [];

  for (const p of allProducts) {
    const merk = p.id_merk ? merkMap.get(p.id_merk) : null;
    const merkCode = (merk?.kode?.trim().toUpperCase().slice(0, 2) || 'NO').padEnd(2, 'X');
    const namaAbbrev = extractNamaAbbrev(p.nama_produk, merk?.nama || '');
    const base = `M${merkCode}${namaAbbrev}`;

    let sku;

    if (p.sku) {
      // SKU exists → keep it
      sku = p.sku;
    } else {
      // Generate new SKU
      const currentCount = baseCounter.get(base) || 0;
      const nextCount = currentCount + 1;
      baseCounter.set(base, nextCount);
      sku = `${base}${String(nextCount).padStart(2, '0')}`;

      // Handle collision
      while (generatedSkus.has(sku.toUpperCase())) {
        const nextNum = baseCounter.get(base) + 1;
        baseCounter.set(base, nextNum);
        sku = `${base}${String(nextNum).padStart(2, '0')}`;
      }
    }

    generatedSkus.add(sku.toUpperCase());

    // Barcode = SKU (always overwrite)
    updates.push({
      id: p.id,
      sku: p.sku ? null : sku,  // only update if new
      barcode: sku,             // always overwrite
      oldSku: p.sku,
      oldBarcode: p.barcode,
    });
  }

  console.log(`\n📝 Prepared ${updates.length} updates`);
  console.log(`   - SKU to generate: ${updates.filter(u => u.sku).length}`);
  console.log(`   - Barcode to overwrite: ${updates.filter(u => u.oldBarcode !== u.barcode).length}`);

  // Batch update
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const u of updates) {
    const payload = { barcode: u.barcode };
    if (u.sku) payload.sku = u.sku;

    const { error } = await supabase
      .from('produk')
      .update(payload)
      .eq('id', u.id);

    if (error) {
      console.error(`❌ Failed id=${u.id}: ${error.message}`);
      errors.push({ id: u.id, error: error.message });
      failed++;
    } else {
      success++;
      if (success % 50 === 0) {
        console.log(`   ✅ ${success}/${updates.length} updated...`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Berhasil: ${success} produk`);
  console.log(`❌ Gagal: ${failed} produk`);
  if (errors.length > 0) {
    console.log(`\nErrors:`);
    errors.forEach(e => console.log(`  id=${e.id}: ${e.error}`));
  }
  
  // Show some samples
  console.log(`\n📋 Contoh hasil:`);
  const samples = updates.slice(0, 15);
  for (const u of samples) {
    const p = allProducts.find(x => x.id === u.id);
    console.log(`  ${p.nama_produk.slice(0, 45).padEnd(45)} → SKU: ${(u.sku || u.oldSku || '-').padEnd(10)} | Barcode: ${u.barcode}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
