const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://aryyefzoieylcxpvxwlm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeXllZnpvaWV5bGN4cHZ4d2xtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk4MDg2MCwiZXhwIjoyMDk0NTU2ODYwfQ.GJQI4vuFlqAC5qSWtqVL8znooL5CKSM73SfvADCjJCA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = [];
    let cur = '';
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    if (vals.length >= 4 && vals[0] && vals[1]) {
      rows.push({ sku: vals[0], nama: vals[1], kategori: vals[2], merk: vals[3] });
    }
  }
  return rows;
}

function brandCode(name) {
  if (!name || name === 'GENERIC') return 'GENR';
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

async function importCategories(rows) {
  // Get all existing categories
  const { data: existing } = await supabase.from('kategori').select('id, nama').order('id');
  const catMap = new Map();
  let maxId = 0;
  if (existing) {
    for (const c of existing) {
      catMap.set(c.nama.toLowerCase(), c.id);
      if (c.id > maxId) maxId = c.id;
    }
  }
  console.log(`Existing kategori: ${catMap.size}, max id: ${maxId}`);

  // Unique categories from CSV
  const csvCats = [...new Set(rows.map(r => r.kategori).filter(Boolean))];
  const toInsert = csvCats.filter(n => !catMap.has(n.toLowerCase()));

  if (toInsert.length === 0) {
    console.log('No new categories to insert');
    return catMap;
  }

  // Insert categories one by one with explicit id
  let nextId = maxId + 1;
  let inserted = 0;
  for (const nama of toInsert) {
    // Try normal insert first
    const { data, error } = await supabase.from('kategori').insert({ id: nextId, nama }).select('id');
    if (error) {
      // If SERIAL issue, try with explicit id
      const { data: d2, error: e2 } = await supabase.from('kategori').insert({ id: nextId, nama }).select('id');
      if (e2) {
        console.error(`  Insert kategori '${nama}' FAILED: ${e2.message}`);
        continue;
      } else if (d2) {
        catMap.set(nama.toLowerCase(), d2[0].id);
        inserted++;
      }
    } else if (data) {
      catMap.set(nama.toLowerCase(), data[0].id);
      inserted++;
    }
    nextId++;
  }
  console.log(`Inserted categories: ${inserted}, total: ${catMap.size}`);
  return catMap;
}

async function importMerks(rows) {
  // Get existing merks
  const { data: existing } = await supabase.from('merk').select('id, nama, kode');
  const merkMap = new Map();
  const usedCodes = new Set();
  let nextId = 0;
  if (existing) {
    for (const m of existing) {
      merkMap.set(m.nama.toLowerCase(), m.id);
      usedCodes.add(m.kode);
      if (m.id > nextId) nextId = m.id;
    }
  }
  console.log(`Existing merks: ${merkMap.size}`);

  const csvMerks = [...new Set(rows.map(r => r.merk).filter(Boolean))];
  let inserted = 0;

  for (const nama of csvMerks) {
    if (merkMap.has(nama.toLowerCase())) continue;

    let kode = brandCode(nama);
    // Handle code conflicts
    let suffix = 0;
    let finalKode = kode;
    while (usedCodes.has(finalKode)) {
      suffix++;
      finalKode = kode.slice(0, 3) + suffix;
    }

    nextId++;
    const { data, error } = await supabase.from('merk').insert({
      id: nextId,
      nama,
      kode: finalKode
    }).select('id');

    if (error) {
      // Try without explicit id
      const { data: d2, error: e2 } = await supabase.from('merk').insert({
        nama, kode: finalKode
      }).select('id');
      if (e2) {
        console.error(`  Insert merk '${nama}' (${finalKode}) FAILED: ${e2.message}`);
        continue;
      } else if (d2) {
        merkMap.set(nama.toLowerCase(), d2[0].id);
        usedCodes.add(finalKode);
        inserted++;
      }
    } else if (data) {
      merkMap.set(nama.toLowerCase(), data[0].id);
      usedCodes.add(finalKode);
      inserted++;
    }
  }

  console.log(`Inserted merks: ${inserted}, total: ${merkMap.size}`);
  return merkMap;
}

async function importProducts(rows, catMap, merkMap) {
  let inserted = 0;
  let errors = 0;
  let skipped = 0;
  const BATCH = 25;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const records = [];

    for (const r of batch) {
      const id_kategori = catMap.get(r.kategori.toLowerCase()) || null;
      const id_merk = merkMap.get(r.merk.toLowerCase()) || null;

      // Check dup sku
      const { data: exist } = await supabase.from('produk').select('id').eq('sku', r.sku).maybeSingle();
      if (exist) { skipped++; continue; }

      records.push({
        sku: r.sku,
        nama_produk: r.nama,
        id_kategori,
        id_merk,
        hitung_stok: true,
        harga_modal: 0,
        harga_jual_satuan: 0,
        diskon: 0,
        stok_minimum: 0,
        stok: 0,
        stok_gudang: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (records.length === 0) continue;

    const { error } = await supabase.from('produk').insert(records);
    if (error) {
      for (const rec of records) {
        const { error: e } = await supabase.from('produk').insert(rec);
        if (e && !e.message.includes('duplicate')) {
          console.error(`  FAILED ${rec.sku}: ${e.message}`);
          errors++;
        } else if (e && e.message.includes('duplicate')) {
          skipped++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += records.length;
    }

    const pct = Math.round((i + batch.length) / rows.length * 100);
    process.stdout.write(`\r  Progress: ${pct}% | inserted: ${inserted} | errors: ${errors} | skipped: ${skipped}`);
  }

  console.log(`\n`);
  return { inserted, errors, skipped };
}

async function main() {
  const csvText = fs.readFileSync('DAFTAR BARANG PLK - WITH SKU.csv', 'utf-8');
  const rows = parseCSV(csvText);
  console.log(`CSV: ${rows.length} produk\n`);

  console.log('=== IMPORT KATEGORI ===');
  const catMap = await importCategories(rows);

  console.log('\n=== IMPORT MERK ===');
  const merkMap = await importMerks(rows);

  console.log('\n=== IMPORT PRODUK ===');
  const result = await importProducts(rows, catMap, merkMap);

  console.log('\n=== DONE ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
