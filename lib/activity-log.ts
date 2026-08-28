import { SupabaseClient } from "@supabase/supabase-js";

export interface LogActivityParams {
  aksi: "CREATE" | "UPDATE" | "DELETE";
  entitas: string;
  id_entitas?: number | null;
  deskripsi: string;
  data_lama?: Record<string, unknown> | null;
  data_baru?: Record<string, unknown> | null;
}

/**
 * Catat aktivitas admin/owner ke tabel log_aktivitas.
 * Panggil setelah mutasi sukses. Gunakan try/catch agar tidak mengganggu response utama.
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const username =
      user.user_metadata?.username || user.email?.split("@")[0];

    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id")
      .eq("username", username)
      .single();

    if (!pengguna) return;

    await supabase.rpc("tambah_log_aktivitas", {
      p_id_pengguna: pengguna.id,
      p_aksi: params.aksi,
      p_entitas: params.entitas,
      p_id_entitas: params.id_entitas ?? null,
      p_deskripsi: params.deskripsi,
      p_data_lama: params.data_lama ?? null,
      p_data_baru: params.data_baru ?? null,
      p_ip_address: null,
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

// ---------------------------------------------------------------------------
// buildDeskripsi — generate deskripsi log otomatis dari data perubahan
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  produk: "Produk",
  pelanggan: "Pelanggan",
  supplier: "Supplier",
  pengguna: "Pengguna",
  kategori: "Kategori",
  satuan: "Satuan",
  merk: "Merk",
  lokasi_area: "Lokasi Area",
  metode_bayar: "Metode Bayar",
  pengaturan: "Pengaturan Toko",
  pengaturan_keuangan: "Pengaturan Keuangan",
  barang_masuk: "Barang Masuk",
  retur_pembelian: "Retur Pembelian",
  stok_opname: "Stok Opname",
  sesi_stok_opname: "Sesi Stok Opname",
  saldo_kas_harian: "Saldo Kas Harian",
  transaksi_keluar: "Transaksi",
  pengeluaran: "Pengeluaran",
  kategori_beban: "Kategori Beban",
  event_promo: "Event Promo",
  event_promo_produk: "Produk Event Promo",
  po_custom: "PO Custom",
  po_custom_pembayaran: "Pembayaran PO Custom",
  jadwal_mingguan: "Jadwal Mingguan",
  jadwal_karyawan: "Jadwal Karyawan",
  shift_kerja: "Shift Kerja",
};

const COLUMN_LABELS: Record<string, string> = {
  nama_produk: "Nama Produk",
  nama_pelanggan: "Nama Pelanggan",
  nama_supplier: "Nama Supplier",
  username: "Username",
  level: "Level",
  nama: "Nama",
  aktif: "Aktif",
  password: "",
  harga_modal: "Harga Modal",
  harga_jual_satuan: "Harga Retail",
  harga_jual_grosir: "Harga Grosir",
  harga_jual_promo: "Harga Promo",
  diskon: "Diskon",
  stok_minimum: "Stok Minimum Display",
  stok_minimum_gudang: "Stok Minimum Gudang",
  stok: "Stok Display",
  stok_gudang: "Stok Gudang",
  id_kategori: "Kategori",
  id_satuan: "Satuan",
  id_merk: "Merk",
  id_lokasi_area: "Lokasi Area",
  sku: "SKU",
  barcode: "Barcode",
  hitung_stok: "Hitung Stok",
  default_purchase_unit: "Satuan Pembelian",
  conversion_ratio: "Rasio Konversi",
  jual_satuan: "Satuan Jual Besar",
  harga_jual_besar_satuan: "Harga Jual Besar (Eceran)",
  harga_jual_besar_grosir: "Harga Jual Besar (Grosir)",
  harga_jual_besar_promo: "Harga Jual Besar (Promo)",
  id_produk_master: "Produk Master",
  qty_per_unit: "Qty per Unit",
  isi_satuan: "Satuan Isi",
  jenis_isi_paket: "Jenis Isi Paket",
  kode: "Kode",
  tanggal_selesai: "Tanggal Selesai",
  tipe_diskon: "Tipe Diskon",
  nilai_diskon: "Nilai Diskon",
  jumlah_produk: "Jumlah Produk",
  no_sesi: "No. Sesi",
  tgl_sesi: "Tanggal Sesi",
  total_item: "Total Item",
  total_selisih: "Total Selisih",
  total_nilai: "Total Nilai",
  nama_toko: "Nama Toko",
  alamat: "Alamat",
  telepon: "Telepon",
  email: "Email",
  no_hp: "No. HP",
  keterangan: "Keterangan",
  modal_awal: "Modal Awal",
  tanggal_mulai: "Tanggal Mulai",
  nama_pemilik: "Nama Pemilik",
  npwp: "NPWP",
  metode_diskon: "Metode Diskon",
  pajak_persen: "Pajak",
  jenis_nota: "Jenis Nota",
  metode_cetak: "Metode Cetak",
  logo_nota: "Logo Nota",
  bank1_nama: "Bank 1",
  bank1_rekening: "Rekening 1",
  bank1_atas_nama: "A/n Rek. 1",
  bank2_nama: "Bank 2",
  bank2_rekening: "Rekening 2",
  bank2_atas_nama: "A/n Rek. 2",
  footer_struk_1: "Footer Struk 1",
  footer_struk_2: "Footer Struk 2",
  footer_struk_3: "Footer Struk 3",
  footer_invoice_1: "Footer Invoice 1",
  footer_invoice_2: "Footer Invoice 2",
  footer_invoice_3: "Footer Invoice 3",
  hormat_kami_nama: "Hormat Kami",
  stok_fisik: "Stok Fisik",
  stok_sistem: "Stok Sistem",
  selisih: "Selisih",
  supplied_qty: "Jml Suplai",
  supplied_unit: "Satuan Suplai",
  total_cost: "Total Biaya",
  tanggal: "Tanggal",
  jumlah_item: "Jumlah Item",
  tgl_masuk: "Tanggal Masuk",
  no_surat: "No. Surat",
  no_retur: "No. Retur",
  qty_retur: "Qty Retur",
  id_supplier: "Supplier",
  id_produk: "Produk",
  point: "Poin",
  poin_min_pembelian: "Min. Pembelian Poin",
  poin_ditukar: "Poin Ditukar",
  nama_pengeluaran: "Nama Pengeluaran",
  jumlah: "Jumlah",
  no_po: "No. PO",
  nama_pesanan: "Nama Pesanan",
  spesifikasi: "Spesifikasi",
  atribut_custom: "Atribut Custom",
  qty: "Qty",
  harga_total: "Harga Total",
  target_selesai: "Target Selesai",
  catatan_internal: "Catatan Internal",
  jumlah_bayar: "Jumlah Bayar",
  jenis_pembayaran: "Jenis Pembayaran",
  metode_bayar: "Metode Bayar",
  minggu_mulai: "Minggu Mulai",
  kebutuhan_pagi: "Kebutuhan Pagi",
  kebutuhan_sore: "Kebutuhan Sore",
  tipe_jadwal: "Tipe Jadwal",
  id_shift: "Shift",
  id_kategori_beban: "Kategori Beban",
  status_pengeluaran: "Status Pengeluaran",
  updated_at: "",
  created_at: "",
};

const IDENTIFIER_FIELDS: Record<string, string[]> = {
  produk: ["nama_produk", "sku"],
  pelanggan: ["nama_pelanggan", "no_hp"],
  supplier: ["nama_supplier"],
  pengguna: ["username", "nama"],
  kategori: ["nama"],
  satuan: ["nama"],
  merk: ["nama"],
  lokasi_area: ["nama"],
  metode_bayar: ["nama"],
  event_promo: ["nama"],
  sesi_stok_opname: ["no_sesi"],
  po_custom: ["no_po", "nama_pesanan"],
  jadwal_mingguan: ["minggu_mulai"],
  shift_kerja: ["kode", "nama"],
};

function extractIdentifier(
  entitas: string,
  data?: Record<string, unknown> | null,
): string | null {
  if (!data) return null;
  const fields = IDENTIFIER_FIELDS[entitas];
  if (!fields) return null;
  for (const field of fields) {
    const val = data[field];
    if (val != null && val !== "") return String(val);
  }
  return null;
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "boolean") return val ? "Ya" : "Tidak";
  if (typeof val === "number") {
    if (Number.isInteger(val) && Math.abs(val) >= 1000)
      return new Intl.NumberFormat("id-ID").format(val);
    return String(val);
  }
  return String(val);
}

function changedValueStr(key: string, val: unknown): string {
  const label = COLUMN_LABELS[key];
  if (label === undefined || label === "") return "";
  return `${label}: ${formatVal(val)}`;
}

function changedPairStr(key: string, oldVal: unknown, newVal: unknown): string {
  const label = COLUMN_LABELS[key];
  if (label === undefined || label === "") return "";
  return `${label} ${formatVal(oldVal)} → ${formatVal(newVal)}`;
}

const CHANGES_LIMIT = 8;
const CREATE_FIELDS_LIMIT = 5;

export function buildDeskripsi(params: {
  aksi: "CREATE" | "UPDATE" | "DELETE";
  entitas: string;
  id_entitas?: number | null;
  data_lama?: Record<string, unknown> | null;
  data_baru?: Record<string, unknown> | null;
}): string {
  const { aksi, entitas, id_entitas, data_lama, data_baru } = params;
  const label = ENTITY_LABELS[entitas] || entitas;

  const ident =
    extractIdentifier(entitas, data_baru) ||
    extractIdentifier(entitas, data_lama) ||
    (id_entitas ? `ID ${id_entitas}` : null);

  const identStr = ident ? ` '${ident}'` : id_entitas ? ` ID ${id_entitas}` : "";

  if (aksi === "CREATE") {
    if (data_baru) {
      const parts = Object.keys(data_baru)
        .map((k) => changedValueStr(k, data_baru[k]))
        .filter(Boolean);
      if (parts.length > 0 && parts.length <= CREATE_FIELDS_LIMIT)
        return `Menambahkan ${label}${identStr}: ${parts.join(", ")}`;
    }
    return `Menambahkan ${label}${identStr}`;
  }

  if (aksi === "DELETE") {
    return `Menghapus ${label}${identStr}`;
  }

  if (aksi === "UPDATE") {
    if (data_lama && data_baru) {
      const allKeys = [
        ...new Set([...Object.keys(data_lama), ...Object.keys(data_baru)]),
      ];
      const changes = allKeys
        .filter((k) => {
          const lbl = COLUMN_LABELS[k];
          if (lbl === undefined || lbl === "") return false;
          return (
            JSON.stringify(data_lama[k]) !== JSON.stringify(data_baru[k])
          );
        })
        .map((k) => changedPairStr(k, data_lama[k], data_baru[k]))
        .filter(Boolean);

      if (changes.length > 0) {
        if (changes.length <= CHANGES_LIMIT)
          return `Mengubah ${label}${identStr}: ${changes.join(", ")}`;
        return `Mengubah ${label}${identStr}: ${changes.length} perubahan`;
      }
    }

    if (data_baru) {
      const parts = Object.keys(data_baru)
        .filter((k) => {
          const lbl = COLUMN_LABELS[k];
          return lbl !== undefined && lbl !== "";
        })
        .map((k) => changedValueStr(k, data_baru[k]))
        .filter(Boolean);
      if (parts.length > 0 && parts.length <= CHANGES_LIMIT)
        return `Mengubah ${label}${identStr}: ${parts.join(", ")}`;
    }

    return `Mengubah ${label}${identStr}`;
  }

  return `${aksi} ${label}${identStr}`;
}
