# API Laporan Penjualan — POS Sobatti

> Base URL: `https://[domain]/api/laporan/penjualan`  
> Format: `application/json` (kecuali endpoint **export** → `text/csv`)  
> Autentikasi: **Service Role** (`createAdminClient`) — akses server-to-server penuh.

---

## Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/laporan/penjualan` | Daftar transaksi + ringkasan + pagination |
| GET | `/api/laporan/penjualan/rekap` | Rekap agregasi per grup |
| GET | `/api/laporan/penjualan/{id}` | Detail satu transaksi |
| GET | `/api/laporan/penjualan/export` | Download CSV |

---

## 1. Daftar Transaksi

```
GET /api/laporan/penjualan
```

Mengembalikan daftar transaksi dalam periode tertentu, lengkap dengan ringkasan meta (total penjualan, laba, diskon, pajak) dan data item per transaksi.

### Query Parameters

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `start_date` | `string` (YYYY-MM-DD) | hari ini | Awal periode filter |
| `end_date` | `string` (YYYY-MM-DD) | hari ini | Akhir periode filter |
| `id_pelanggan` | `number` | `0` | Filter berdasarkan pelanggan (`0` = semua) |
| `id_metode_bayar` | `number` | `0` | Filter berdasarkan metode pembayaran (`0` = semua) |
| `id_kasir` | `number` | `0` | Filter berdasarkan kasir/pengguna (`0` = semua) |
| `search` | `string` | `""` | Cari berdasarkan nomor transaksi atau nama pelanggan (partial match) |
| `page` | `number` | `1` | Halaman (min 1) |
| `limit` | `number` | `50` | Jumlah data per halaman (min 1, max 200) |
| `sort_by` | `string` | `tgl_transaksi` | Kolom sorting (contoh: `total`, `no_transaksi`) |
| `sort_order` | `asc` / `desc` | `desc` | Arah sorting |
| `include_items` | `true` / `false` | `true` | Sertakan array item dalam setiap transaksi |

### Response (200 OK)

```json
{
  "meta": {
    "total_transaksi": 42,
    "total_penjualan": 12500000,
    "total_hpp": 8250000,
    "total_laba_kotor": 4250000,
    "total_diskon": 250000,
    "total_pajak": 1250000,
    "rata_rata_per_transaksi": 297619,
    "periode": {
      "start": "2026-07-01",
      "end": "2026-07-20"
    }
  },
  "data": [
    {
      "id": 1,
      "no_transaksi": "#10000001",
      "tgl_transaksi": "2026-07-20T14:30:00+07:00",
      "kasir": { "id": 3, "nama": "Budi Santoso" },
      "pelanggan": { "id": 5, "nama": "Sari Indah", "no_hp": "08123456789" },
      "metode_bayar": { "id": 1, "nama": "Tunai" },
      "subtotal": 1000000,
      "diskon_persen": 10,
      "diskon_nominal": 100000,
      "pajak_persen": 11,
      "pajak_nominal": 110000,
      "total": 1010000,
      "bayar": 1010000,
      "kembali": 0,
      "total_hpp": 700000,
      "laba_kotor": 300000,
      "piutang": null,
      "items": [
        {
          "id": 10,
          "id_produk": 25,
          "nama_produk": "Indomie Goreng",
          "barcode": "8991002101432",
          "kategori": "Makanan",
          "type_harga_jual": "satuan",
          "harga_modal": 2500,
          "harga_jual": 3500,
          "diskon_item": 0,
          "qty": 10,
          "jumlah": 35000,
          "harga_pokok_satuan": 2500,
          "total_harga_pokok": 25000,
          "profit": 10000
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 42,
    "total_pages": 1
  }
}
```

### Catatan

- Jika `include_items=false`, field `items` pada setiap transaksi tidak disertakan (`undefined`).
- Field `piutang` selalu `null` (cadangan untuk fitur piutang).

---

## 2. Rekap / Agregasi

```
GET /api/laporan/penjualan/rekap
```

Mengembalikan data agregasi transaksi yang dikelompokkan berdasarkan parameter `group_by`.

### Query Parameters

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `start_date` | `string` (YYYY-MM-DD) | hari ini | Awal periode filter |
| `end_date` | `string` (YYYY-MM-DD) | hari ini | Akhir periode filter |
| `group_by` | `enum` | `hari` | Grup data: `hari`, `kasir`, `metode_bayar`, `pelanggan` |

### Nilai `group_by`

| Nilai | Hasil Grup | Field Identitas |
|-------|------------|-----------------|
| `hari` | Per tanggal | `tanggal` |
| `kasir` | Per kasir | `id_kasir`, `nama_kasir` |
| `metode_bayar` | Per metode pembayaran | `id_metode_bayar`, `metode_bayar` |
| `pelanggan` | Per pelanggan | `id_pelanggan`, `nama_pelanggan` |

### Response (200 OK)

**Contoh `group_by=hari`:**

```json
{
  "meta": {
    "periode": { "start": "2026-07-01", "end": "2026-07-20" },
    "total_penjualan": 12500000,
    "total_transaksi": 42,
    "group_by": "hari"
  },
  "data": [
    {
      "tanggal": "2026-07-20",
      "total_transaksi": 8,
      "total_penjualan": 3200000,
      "total_laba": 1100000,
      "total_hpp": 2100000,
      "total_diskon": 150000,
      "total_pajak": 320000,
      "total_item_terjual": 0
    }
  ]
}
```

**Contoh `group_by=kasir`:**

```json
{
  "meta": { ... },
  "data": [
    {
      "id_kasir": 3,
      "nama_kasir": "Budi Santoso",
      "total_transaksi": 20,
      "total_penjualan": 6500000,
      "total_laba": 2200000,
      "total_hpp": 4300000,
      "total_diskon": 100000,
      "total_pajak": 650000,
      "total_item_terjual": 0
    }
  ]
}
```

**Contoh `group_by=metode_bayar`:**

```json
{
  "meta": { ... },
  "data": [
    {
      "id_metode_bayar": 1,
      "metode_bayar": "Tunai",
      "total_transaksi": 30,
      "total_penjualan": 8500000,
      "total_laba": 3000000,
      "total_hpp": 5500000,
      "total_diskon": 200000,
      "total_pajak": 850000,
      "total_item_terjual": 0
    }
  ]
}
```

**Contoh `group_by=pelanggan`:**

```json
{
  "meta": { ... },
  "data": [
    {
      "id_pelanggan": 5,
      "nama_pelanggan": "Sari Indah",
      "total_transaksi": 3,
      "total_penjualan": 1500000,
      "total_laba": 500000,
      "total_hpp": 1000000,
      "total_diskon": 50000,
      "total_pajak": 150000,
      "total_item_terjual": 0
    }
  ]
}
```

---

## 3. Detail Transaksi

```
GET /api/laporan/penjualan/{id}
```

Mengembalikan detail satu transaksi berdasarkan ID-nya, termasuk seluruh item.

### Path Parameters

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `id` | `number` | ID transaksi (wajib, min 1) |

### Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "no_transaksi": "#10000001",
    "tgl_transaksi": "2026-07-20T14:30:00+07:00",
    "kasir": { "id": 3, "nama": "Budi Santoso" },
    "pelanggan": { "id": 5, "nama": "Sari Indah", "no_hp": "08123456789" },
    "metode_bayar": { "id": 1, "nama": "Tunai" },
    "subtotal": 1000000,
    "diskon_persen": 10,
    "diskon_nominal": 100000,
    "pajak_persen": 11,
    "pajak_nominal": 110000,
    "total": 1010000,
    "bayar": 1010000,
    "kembali": 0,
    "total_hpp": 700000,
    "laba_kotor": 300000,
    "piutang": null,
    "items": [
      {
        "id": 10,
        "id_produk": 25,
        "nama_produk": "Indomie Goreng",
        "barcode": "8991002101432",
        "kategori": "Makanan",
        "type_harga_jual": "satuan",
        "harga_modal": 2500,
        "harga_jual": 3500,
        "diskon_item": 0,
        "qty": 10,
        "jumlah": 35000,
        "harga_pokok_satuan": 2500,
        "total_harga_pokok": 25000,
        "profit": 10000
      }
    ]
  }
}
```

### Error Response (404)

```json
{
  "error": "Transaksi tidak ditemukan"
}
```

---

## 4. Export CSV

```
GET /api/laporan/penjualan/export
```

Mengunduh data transaksi dalam format CSV (comma-separated values). Response berupa file download, bukan JSON.

### Query Parameters

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `start_date` | `string` (YYYY-MM-DD) | hari ini | Awal periode filter |
| `end_date` | `string` (YYYY-MM-DD) | hari ini | Akhir periode filter |
| `id_pelanggan` | `number` | `0` | Filter pelanggan (`0` = semua) |
| `id_metode_bayar` | `number` | `0` | Filter metode bayar (`0` = semua) |
| `id_kasir` | `number` | `0` | Filter kasir (`0` = semua) |

### Response (200 OK)

**Headers:**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="penjualan_2026-07-01_2026-07-20.csv"
```

**Body (CSV):**

```csv
No Transaksi,Tanggal,Kasir,Pelanggan,Metode Bayar,Subtotal,Diskon %,Diskon,PPN %,PPN,Total,Bayar,Kembali,Total HPP,Laba Kotor
#10000001,2026-07-20T14:30:00+07:00,Budi Santoso,Sari Indah,Tunai,1000000,10,100000,11,110000,1010000,1010000,0,700000,300000
```

### Kolom CSV

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| No Transaksi | `string` | Nomor unik transaksi |
| Tanggal | `string` (ISO 8601) | Tanggal & jam transaksi (WIB/+07:00) |
| Kasir | `string` | Nama kasir |
| Pelanggan | `string` | Nama pelanggan (kosong jika tidak ada) |
| Metode Bayar | `string` | Nama metode pembayaran |
| Subtotal | `number` | Total sebelum diskon & pajak |
| Diskon % | `number` | Persentase diskon transaksi |
| Diskon | `number` | Nominal diskon transaksi |
| PPN % | `number` | Persentase pajak |
| PPN | `number` | Nominal pajak |
| Total | `number` | Total akhir (subtotal - diskon + pajak) |
| Bayar | `number` | Jumlah yang dibayarkan |
| Kembali | `number` | Uang kembalian |
| Total HPP | `number` | Total harga pokok penjualan |
| Laba Kotor | `number` | Laba kotor (total - total HPP) |

---

## Error Handling

Semua endpoint mengembalikan error dengan format JSON berikut (kecuali export yang tetap mengembalikan CSV error body):

### Format Error

```json
{
  "error": "Deskripsi pesan error"
}
```

### HTTP Status Codes

| Status | Arti | Penyebab |
|--------|------|----------|
| `200` | OK | Request berhasil |
| `400` | Bad Request | Parameter tidak valid (format tanggal salah, `group_by` tidak dikenal, dll.) |
| `404` | Not Found | Data transaksi dengan ID tertentu tidak ditemukan |
| `500` | Internal Server Error | Terjadi kesalahan di server |

### Contoh Error

**400 — Parameter tidak valid:**

```json
{
  "error": "start_date tidak valid. Format: YYYY-MM-DD"
}
```

```json
{
  "error": "group_by harus salah satu: hari, kasir, metode_bayar, pelanggan"
}
```

**500 — Internal server error:**

```json
{
  "error": "Failed to fetch"
}
```

---

## Contoh Penggunaan (cURL)

### Daftar transaksi hari ini

```bash
curl "https://[domain]/api/laporan/penjualan?start_date=2026-07-20&end_date=2026-07-20&include_items=true"
```

### Daftar transaksi dengan filter & pagination

```bash
curl "https://[domain]/api/laporan/penjualan?start_date=2026-07-01&end_date=2026-07-20&id_kasir=3&id_metode_bayar=1&page=1&limit=10&sort_by=total&sort_order=desc"
```

### Rekap per kasir

```bash
curl "https://[domain]/api/laporan/penjualan/rekap?start_date=2026-07-01&end_date=2026-07-20&group_by=kasir"
```

### Detail transaksi

```bash
curl "https://[domain]/api/laporan/penjualan/1"
```

### Export CSV

```bash
curl -o penjualan.csv "https://[domain]/api/laporan/penjualan/export?start_date=2026-07-01&end_date=2026-07-20"
```

---

## Batasan & Catatan

- Parameter tanggal (`start_date`, `end_date`) **wajib** menggunakan format `YYYY-MM-DD`.
- Zona waktu yang digunakan adalah **WIB (UTC+7)**.
- Data transaksi difilter berdasarkan kolom `tgl_transaksi` pada rentang `00:00:00+07:00` s.d. `23:59:59+07:00`.
- Pencarian (`search`) bersifat *case-insensitive partial match* pada nomor transaksi dan nama pelanggan.
- `limit` maksimal **200** data per halaman.
- Endpoint **export** saat ini hanya mendukung format `csv` (parameter `format` dicadangkan untuk format lain di masa mendatang).
