import re

with open('/home/haydar/Code/POS/app/app/dashboard/inventory/actions.ts', 'r') as f:
    content = f.read()

target_start = '  const payload: any[] = [];'
target_end = 'return { success: true, count: payload.length, message: `Berhasil mengimpor ${payload.length} data produk.` };'

if target_start not in content or target_end not in content:
    print("Cannot find target markers.")
    exit(1)

start_idx = content.find(target_start)
end_idx = content.find(target_end) + len(target_end)

new_code = """  // Fetch existing products for UPSERT logic
  const { data: existingProducts } = await supabase
    .from("produk")
    .select("id, sku, barcode, nama_produk, stok, stok_gudang, harga_pokok_avco, nilai_persediaan");

  const existingByBarcode = new Map<string, any>();
  const existingBySku = new Map<string, any>();
  const existingByName = new Map<string, any>();

  if (existingProducts) {
    for (const p of existingProducts) {
      if (p.barcode) existingByBarcode.set(p.barcode.trim().toLowerCase(), p);
      if (p.sku) existingBySku.set(p.sku.trim().toLowerCase(), p);
      if (p.nama_produk) existingByName.set(p.nama_produk.trim().toLowerCase(), p);
    }
  }

  const inserts: any[] = [];
  const updates: any[] = [];

  for (const r of rows) {
    const nama_produk = r["Nama Produk"] || r["nama_produk"] || "";
    if (!nama_produk.trim()) continue;

    const catName = r["Kategori Produk"] || r["Kategori"] || r["kategori"] || "";
    const unitName = r["Satuan Dasar"] || r["Satuan"] || r["satuan"] || r["base_unit"] || "";
    const brandName = r["Merk / Brand"] || r["Merk"] || r["merk"] || "";
    const lokName = r["Lokasi / Rak"] || r["Lokasi"] || r["lokasi"] || r["Lokasi Area"] || r["lokasi_area"] || "";

    const id_kategori = catName ? (await getOrCreateRef("kategori", categoryMap, catName)) || defaultCatId : defaultCatId;
    const id_satuan = unitName ? (await getOrCreateRef("satuan", unitMap, unitName)) || defaultUnitId : defaultUnitId;
    const id_merk = brandName ? await getOrCreateRef("merk", brandMap, brandName) : null;
    const id_lokasi_area = lokName ? await getOrCreateRef("lokasi_area", lokasiMap, lokName) : null;

    const sku = (r["SKU / Kode Produk"] || r["SKU"] || r["sku"] || "").trim() || null;
    const barcode = (r["Barcode"] || r["barcode"] || "").trim() || null;

    const parseNum = (val: string | undefined, def: number = 0) => {
      if (!val) return def;
      const cleaned = val.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? def : parsed;
    };

    const harga_modal = parseNum(r["Harga Modal / Beli"] || r["Harga Modal"] || r["harga_modal"]);
    const harga_jual_satuan = parseNum(r["Harga Jual Eceran"] || r["Harga Jual Satuan"] || r["harga_jual_satuan"]);
    const harga_jual_grosir = parseNum(r["Harga Jual Grosir"] || r["harga_jual_grosir"], harga_jual_satuan);
    const harga_jual_promo = r["Harga Jual Promo"] || r["harga_jual_promo"] ? parseNum(r["Harga Jual Promo"] || r["harga_jual_promo"]) : null;
    const diskon = parseNum(r["Diskon per Item (Rp)"] || r["Diskon"] || r["diskon"]);

    const stok = parseNum(r["Stok di Rak / Display"] || r["Stok Display"] || r["Stok"] || r["stok"]);
    const stok_gudang = parseNum(r["Stok di Gudang"] || r["Stok Gudang"] || r["stok_gudang"]);
    const stok_minimum = parseNum(r["Stok Minimum"] || r["stok_minimum"], 5);
    const stokMinimumGudangRaw = (r["Stok Minimum Gudang"] || r["stok_minimum_gudang"] || "").trim();
    const stok_minimum_gudang = stokMinimumGudangRaw ? parseNum(stokMinimumGudangRaw) : null;

    const hitungStokRaw = (r["Hitung Stok (ya/tidak)"] || r["Hitung Stok"] || r["hitung_stok"] || "ya").toString().toLowerCase().trim();
    const hitung_stok = hitungStokRaw === "ya" || hitungStokRaw === "true" || hitungStokRaw === "1";

    const default_purchase_unit = (r["Satuan Beli dari Supplier"] || r["Satuan Beli"] || r["default_purchase_unit"] || "").trim() || null;
    const conversion_ratio = parseNum(r["Isi per Satuan Beli"] || r["Rasio Konversi"] || r["conversion_ratio"], 1);

    // Satuan jual besar (multi-unit selling) — harga besar TIDAK diimport,
    // otomatis dihitung = harga jual kecil × conversion_ratio.
    const jual_satuan = (r["Satuan Jual Besar"] || r["jual_satuan"] || "").trim() || null;
    const harga_jual_besar_satuan = jual_satuan ? Math.round(harga_jual_satuan * conversion_ratio) : null;
    const harga_jual_besar_grosir = jual_satuan ? Math.round(harga_jual_grosir * conversion_ratio) : null;
    const harga_jual_besar_promo = jual_satuan && harga_jual_promo != null
      ? Math.round(harga_jual_promo * conversion_ratio)
      : null;

    // Paket fields
    const id_produk_master_raw = (r["Produk Master (ID)"] || r["ID Master"] || r["id_produk_master"] || "").trim();
    let id_produk_master: number | null = null;
    if (id_produk_master_raw) {
      const parsed = parseInt(id_produk_master_raw, 10);
      if (!isNaN(parsed)) {
        id_produk_master = parsed;
      } else {
        // Try find by name
        const { data: masterProd } = await supabase
          .from("produk")
          .select("id")
          .ilike("nama_produk", id_produk_master_raw)
          .is("id_produk_master", null)
          .limit(1)
          .single();
        if (masterProd) id_produk_master = masterProd.id;
      }
    }
    const qty_per_unit_raw = r["Qty Isi per Paket"] || r["Qty Per Unit"] || r["qty_per_unit"];
    const qty_per_unit = qty_per_unit_raw ? parseNum(qty_per_unit_raw) : null;
    const jenis_isi_paket_raw = (r["Jenis Isi Paket"] || r["jenis_isi_paket"] || "").trim().toUpperCase();
    const jenis_isi_paket = (jenis_isi_paket_raw === "ACTUAL_WEIGHT" || jenis_isi_paket_raw === "FIXED_RATIO") ? jenis_isi_paket_raw : null;
    const isi_satuan = (r["Satuan Isi Paket"] || r["Satuan Isi"] || r["isi_satuan"] || "").trim() || null;

    const totalStok = stok + stok_gudang;
    const harga_pokok_avco = harga_modal;
    const nilai_persediaan = harga_modal * totalStok;

    let matchedProduct = null;
    if (barcode && existingByBarcode.has(barcode.toLowerCase())) {
      matchedProduct = existingByBarcode.get(barcode.toLowerCase());
    } else if (sku && existingBySku.has(sku.toLowerCase())) {
      matchedProduct = existingBySku.get(sku.toLowerCase());
    } else if (existingByName.has(nama_produk.toLowerCase())) {
      matchedProduct = existingByName.get(nama_produk.toLowerCase());
    }

    const basePayload = {
      nama_produk,
      id_kategori,
      id_satuan,
      id_merk,
      id_lokasi_area,
      sku,
      barcode,
      harga_modal,
      harga_jual_satuan,
      harga_jual_grosir,
      harga_jual_promo,
      diskon,
      stok_minimum,
      stok_minimum_gudang,
      hitung_stok: id_produk_master ? true : hitung_stok,
      id_produk_master,
      qty_per_unit,
      isi_satuan,
      jenis_isi_paket,
      default_purchase_unit,
      conversion_ratio,
      jual_satuan,
      harga_jual_besar_satuan,
      harga_jual_besar_grosir,
      harga_jual_besar_promo,
    };

    if (matchedProduct) {
      // UPDATE: Gunakan nilai stok dan AVCO yang sudah ada di database (Abaikan dari CSV)
      updates.push({
        ...basePayload,
        id: matchedProduct.id,
        stok: matchedProduct.stok,
        stok_gudang: matchedProduct.stok_gudang,
        harga_pokok_avco: matchedProduct.harga_pokok_avco,
        nilai_persediaan: matchedProduct.nilai_persediaan,
      });
    } else {
      // INSERT: Gunakan nilai stok dan AVCO baru dari CSV
      inserts.push({
        ...basePayload,
        stok,
        stok_gudang,
        harga_pokok_avco,
        nilai_persediaan,
      });
    }
  }

  if (inserts.length === 0 && updates.length === 0) {
    return { error: "Tidak ada baris data produk yang valid" };
  }

  let insertCount = 0;
  let updateCount = 0;

  if (inserts.length > 0) {
    const { error: errInsert } = await supabase.from("produk").insert(inserts);
    if (errInsert) {
      console.error("Failed to insert products:", errInsert);
      return { error: "Gagal menyimpan data produk baru: " + errInsert.message };
    }
    insertCount = inserts.length;
  }

  if (updates.length > 0) {
    const { error: errUpdate } = await supabase.from("produk").upsert(updates, { onConflict: "id" });
    if (errUpdate) {
      console.error("Failed to update products:", errUpdate);
      return { error: "Gagal memperbarui data produk lama: " + errUpdate.message };
    }
    updateCount = updates.length;
  }

  const msg = `Berhasil mengimpor: ${insertCount} produk baru ditambah, ${updateCount} produk diperbarui.`;

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "produk",
    deskripsi: msg,
    data_baru: { insertCount, updateCount },
  });

  revalidatePath("/dashboard/inventory");
  return { success: true, count: insertCount + updateCount, message: msg };"""

new_content = content[:start_idx] + new_code + content[end_idx:]

with open('/home/haydar/Code/POS/app/app/dashboard/inventory/actions.ts', 'w') as f:
    f.write(new_content)

print("File updated successfully.")
