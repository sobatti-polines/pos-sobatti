# Plan: Responsive Screenshot Audit — POS Sobatti

## Tujuan

Mengambil screenshot seluruh halaman POS Sobatti di **viewport mobile (375×812px)** secara otomatis menggunakan Playwright, lalu menganalisanya untuk menemukan masalah responsive (overflow, elemen tabrakan, teks terpotong, touch target < 44px, layout pecah). Hasil analisa dicatat di `TODO-RESPONSIVE.md` untuk后续 diperbaiki menggunakan skill `impeccable`.

---

## Tahapan

### Phase 1: Buat Akun Test (via Supabase Auth)

Membuat satu akun pengguna test dengan level tertinggi (OWNER/ADMIN) agar bisa mengakses semua halaman.

- **Email:** `test@responsived.test`
- **Password:** `TestResponsive2024!`
- **Level:** ADMIN (atau OWNER jika ada)
- **Method:** Insert langsung ke tabel `pengguna` via Supabase admin client (`lib/supabase/admin.ts`), register via Supabase Auth API.

Output: akun aktif yang bisa dipakai Playwright untuk login.

---

### Phase 2: Eksplorasi Semua Halaman — Mapping Selector

Sebelum menulis test, baca setiap file `page.tsx` + komponen terkait untuk mapping elemen interaktif per halaman.

#### Yang dicari di setiap halaman:

| Elemen | Yang Dideteksi | Selector Playwright |
|--------|---------------|-------------------|
| **Modal/Dialog** | Import `dialog.tsx`, `trigger` button | Text tombol: "Tambah", "Edit", "Filter", "Hapus", "Detail" |
| **Sheet** | Import `sheet.tsx`, `trigger` button | Text / aria-label trigger |
| **Form** | `<form>` atau `react-hook-form` | Selector by role / label |
| **Dropdown/Select** | `Select` component atau `<select>` | Label + option |
| **Tabs** | `Tabs` component | Tab trigger text |
| **Mobile Nav** | `DashboardMobileNav` | Hamburger button / sidebar trigger |
| **Tombol Aksi** | Button dengan teks | Teks tombol |

#### Daftar Lengkap Route (34 halaman)

```
Root & Auth:
  1.  /                              → login
  2.  /not-found                      → 404

POS:
  3.  /pos                            → POS cashier
  4.  /pos/invoice/[id]               → invoice detail       (dynamic route)
  5.  /pos/invoice/[id]/receipt       → thermal receipt       (dynamic route)
  6.  /pos/test-barcode               → barcode test

Dashboard:
  7.  /dashboard                      → overview
  8.  /dashboard/transactions         → transaction history
  9.  /dashboard/customers            → customer management
  10. /dashboard/suppliers            → supplier management
  11. /dashboard/inventory            → product inventory
  12. /dashboard/inventory/stock-in   → stock in form
  13. /dashboard/inventory/stock-in/history  → stock in history
  14. /dashboard/inventory/stock-opname      → stock opname
  15. /dashboard/inventory/stock-opname/history  → stock opname history
  16. /dashboard/reports              → sales reports
  17. /dashboard/laporan/laba-rugi    → laba rugi report
  18. /dashboard/laporan/neraca       → neraca report
  19. /dashboard/tutup-kasir          → cash closing
  20. /dashboard/laporan-kasir        → cash report
  21. /dashboard/attendance/history   → attendance history
  22. /dashboard/attendance/generate-qr → generate QR
  23. /dashboard/attendance/report    → attendance report (admin)
  24. /dashboard/attendance/scan      → scan QR
  25. /dashboard/settings             → store settings
  26. /dashboard/settings/users       → user management
  27. /dashboard/settings/reference-data → reference data
  28. /dashboard/settings/keuangan    → financial settings
  29. /dashboard/label-generator      → label generator
  30. /dashboard/product-label        → product sticker label
  31. /dashboard/log-aktivitas        → activity log

Scanner:
  32. /scanner/[sessionId]            → barcode scanner      (dynamic route)

Standalone:
  33. /label-generator                → label generator (standalone)
  34. /demo-price-tag                 → demo price tag
```

**Catatan Dynamic Routes:**
- `/pos/invoice/[id]` — perlu ID invoice valid. Akan diambil dari database transaksi terbaru.
- `/pos/invoice/[id]/receipt` — sama, perlu ID invoice.
- `/scanner/[sessionId]` — perlu session ID. Akan dibuat via API `/api/attendance/generate-qr` atau langsung generate UUID.

**Catatan Auth:**
- Halaman `/`, `/not-found`, `/demo-price-tag`, `/pos/test-barcode` mungkin publik (tanpa auth).
- Semua halaman `/dashboard/*` dan `/pos/*` butuh login.
- `/scanner/[sessionId]` mungkin publik (untuk scan via HP).

#### Output Phase 2:

File `selectors.json` dengan struktur:
```json
{
  "/dashboard/inventory": {
    "modals": [
      { "trigger": "Tambah Produk", "type": "dialog", "screenshotName": "01-modal-tambah-produk" },
      { "trigger": "Edit", "type": "dialog", "screenshotName": "02-modal-edit-produk" }
    ],
    "sheets": [...],
    "tabs": [...],
    "mobileNav": true
  },
  ...
}
```

---

### Phase 3: Buat Playwright Test File

File: `tests/screenshot-responsive.spec.ts`

#### Struktur Test:

```typescript
import { test, expect } from '@playwright/test';

const TEST_ACCOUNT = {
  email: 'test@responsived.test',
  password: 'TestResponsive2024!',
};

const VIEWPORT = { width: 375, height: 812 };
const SCREENSHOT_ROOT = 'screenshots';

type ScreenshotPlan = {
  path: string;        // route path
  name: string;        // folder name (slug)
  interactions?: {     // Level 2 interactions
    trigger: string;   // selector / text
    type: 'dialog' | 'sheet' | 'form' | 'nav' | 'tabs';
    screenshotName: string;
    waitAfter?: number; // ms to wait after trigger
    closeSelector?: string; // how to close after screenshot
  }[];
  skip?: boolean;      // skip if dynamic route with no data
};
```

#### Alur Test:

1. **Setup:**
   - Set viewport ke 375×812
   - Buat folder `screenshots/` root

2. **Login:**
   - Buka `/`
   - Isi email & password
   - Submit → tunggu redirect ke `/dashboard`
   - Screenshot halaman login SEBELUM isi form
   - Screenshot halaman login DENGAN form terisi
   - Screenshot error validation (submit kosong)

3. **Untuk tiap route (setelah login):**
   - Navigasi ke route
   - Wait `networkidle` + timeout 3s (tunggu rendering)
   - Screenshot **full-page**: `screenshots/<module>/<page>/00-full-page.png`
   - Jika ada interaksi Level 2:
     - Klik trigger → wait modal/sheet muncul
     - Screenshot: `screenshots/<module>/<page>/01-<nama>.png`
     - Tutup modal/sheet
   - Jika ada tabs: klik tiap tab → screenshot
   - Jika ada mobile nav: buka sidebar → screenshot

4. **Untuk Dynamic Routes:**
   - `/pos/invoice/[id]`: query DB → ambil ID transaksi terakhir → screenshot
   - `/pos/invoice/[id]/receipt`: sama
   - `/scanner/[sessionId]`: generate UUID → screenshot

5. **Teardown:**
   - Logout (jika perlu)

#### Fitur Tambahan di Test:

- **Error handling**: jika suatu halaman error (500/404), screenshot tetap diambil + catat di log
- **Timeout per halaman**: maksimal 15 detik per halaman
- **Loading state**: screenshot juga tampilan loading (jika ada `loading.tsx`)
- **Empty state**: jika halaman kosong, tetap screenshot

---

### Phase 4: Jalankan Test

```bash
cd /home/haydar/Code/POS/app
npx playwright test tests/screenshot-responsive.spec.ts
```

#### Output Folder Structure:

```
screenshots/
├── login/
│   ├── 00-halaman-kosong.png
│   ├── 01-form-terisi.png
│   └── 02-error-validasi.png
│
├── pos/
│   ├── 00-full-page.png
│   ├── 01-modal-cari-produk.png
│   ├── 02-numpad-aktif.png
│   ├── 03-sidebar-kategori.png
│   └── 04-checkout-modal.png
│   └── invoice-[id]/
│       ├── 00-full-page.png
│       └── 01-modal-cetak.png
│   └── test-barcode/
│       └── 00-full-page.png
│
├── dashboard/
│   ├── 00-full-page.png
│   ├── 01-mobile-sidebar.png
│   ├── 02-modal-low-stock.png
│   │
│   ├── transactions/
│   │   ├── 00-full-page.png
│   │   ├── 01-filter-modal.png
│   │   └── 02-detail-transaksi-sheet.png
│   │
│   ├── customers/
│   │   ├── 00-full-page.png
│   │   ├── 01-modal-tambah-customer.png
│   │   └── 02-modal-edit-customer.png
│   │
│   ├── suppliers/
│   │   ├── 00-full-page.png
│   │   ├── 01-modal-tambah-supplier.png
│   │   └── 02-modal-edit-supplier.png
│   │
│   ├── inventory/
│   │   ├── 00-full-page.png
│   │   ├── 01-modal-tambah-produk.png
│   │   ├── 02-filter-kategori.png
│   │   └── 03-detail-produk-sheet.png
│   │   ├── stock-in/
│   │   │   ├── 00-full-page.png
│   │   │   ├── 01-pilih-supplier.png
│   │   │   └── 02-pilih-produk-modal.png
│   │   └── stock-opname/
│   │       ├── 00-full-page.png
│   │       └── 01-form-opname.png
│   │
│   ├── reports/
│   │   ├── 00-full-page.png
│   │   ├── 01-filter-tanggal.png
│   │   └── 02-export-modal.png
│   │
│   ├── laporan/
│   │   ├── laba-rugi/
│   │   │   ├── 00-full-page.png
│   │   │   └── 01-filter-periode.png
│   │   └── neraca/
│   │       ├── 00-full-page.png
│   │       └── 01-filter-periode.png
│   │
│   ├── tutup-kasir/
│   │   ├── 00-full-page.png
│   │   └── 01-konfirmasi-modal.png
│   │
│   ├── laporan-kasir/
│   │   ├── 00-full-page.png
│   │   └── 01-filter-tanggal.png
│   │
│   ├── attendance/
│   │   ├── history/
│   │   │   ├── 00-full-page.png
│   │   │   └── 01-filter-bulan.png
│   │   ├── generate-qr/
│   │   │   └── 00-full-page.png
│   │   └── report/
│   │       ├── 00-full-page.png
│   │       ├── 01-filter-pegawai.png
│   │       └── 02-export-modal.png
│   │
│   ├── settings/
│   │   ├── 00-full-page.png
│   │   └── 01-edit-modal.png
│   │   ├── users/
│   │   │   ├── 00-full-page.png
│   │   │   ├── 01-modal-tambah-user.png
│   │   │   └── 02-modal-edit-user.png
│   │   ├── reference-data/
│   │   │   ├── 00-full-page.png
│   │   │   ├── 01-tab-kategori.png
│   │   │   ├── 02-tab-satuan.png
│   │   │   ├── 03-tab-metode-bayar.png
│   │   │   └── 04-modal-tambah.png
│   │   └── keuangan/
│   │       ├── 00-full-page.png
│   │       ├── 01-edit-modal-awal.png
│   │       └── 02-edit-npwp.png
│   │
│   ├── label-generator/
│   │   ├── 00-full-page.png
│   │   └── 01-preview-label.png
│   │
│   ├── product-label/
│   │   ├── 00-full-page.png
│   │   └── 01-preview-sticker.png
│   │
│   └── log-aktivitas/
│       ├── 00-full-page.png
│       └── 01-filter-tanggal.png
│
├── scanner/
│   └── [sessionId]/
│       └── 00-full-page.png
│
├── label-generator/
│   ├── 00-full-page.png
│   └── 01-preview-label.png
│
├── demo-price-tag/
│   └── 00-full-page.png
│
├── not-found/
│   └── 00-full-page.png
│
└──test-barcode/
    └── 00-full-page.png
```

---

### Phase 5: Analisa Screenshot

Setelah semua screenshot tergenerate, analisa SATU PER SATU gambar di setiap folder.

#### Kriteria Masalah Responsive yang Dicek:

| # | Masalah | Cara Deteksi |
|---|---------|-------------|
| 1 | **Horizontal scroll** | Scrollbar muncul di bawah / konten kepotong di kanan |
| 2 | **Overflow/Element tabrakan** | Dua elemen saling tindih, teks kebaca sebagian |
| 3 | **Teks terpotong** | Kata/huruf terpotong di ujung container |
| 4 | **Tombol terlalu kecil** | Tombol < 44×44px (touch target) |
| 5 | **Layout pecah** | Grid/grid item tidak rapi, spacing tidak konsisten |
| 6 | **Form melebihi layar** | Form/input melampaui viewport |
| 7 | **Modal/sheet overflow** | Modal lebih besar dari layar, tidak bisa di-scroll |
| 8 | **Navigasi rusak** | Menu/hamburger tidak terbaca, item bertumpuk |
| 9 | **Tabel horizontal** | Tabel dengan banyak kolom menyempit, teks dempet |
| 10 | **Gap terlalu sempit** | Spacing antar elemen < 8px sehingga terlihat sesak |

#### Output Analisa:

Untuk setiap masalah yang ditemukan, catat:
```
- Halaman: /dashboard/inventory
- Gambar: screenshots/dashboard/inventory/00-full-page.png
- Masalah: Tabel produk overflow secara horizontal, scrollbar muncul
- Severitas: P1 (Major)
- Detail: Kolom "Harga Modal", "Harga Jual", "Stok" menyempit dan teks dempet
```

---

### Phase 6: Tulis TODO-RESPONSIVE.md

File `TODO-RESPONSIVE.md` dengan format:

```markdown
# TODO: Responsive Fixes

## Prioritas
- **P0 (Blocker)**: Halaman tidak bisa digunakan sama sekali di mobile
- **P1 (Major)**: Fitur utama terganggu, elemen bertumpuk
- **P2 (Minor)**: Mengganggu estetika tapi masih bisa dipakai
- **P3 (Polish)**: Sentuhan akhir

---

## 1. /dashboard/inventory
- **P1** — Tabel overflow horizontal (`screenshots/dashboard/inventory/00-full-page.png`)
  - Solusi: Stack kolom jadi card view di mobile, atau gunakan horizontal scroll tabel
- **P2** — Tombol "Tambah Produk" sedikit terpotong di 375px (`screenshots/dashboard/inventory/01-modal-tambah-produk.png`)
  - Solusi: Padding dikurangi jadi 8px 12px di mobile

## 2. /pos
- **P1** — Numpad melebihi layar di landscape (`screenshots/pos/02-numpad-aktif.png`)
  - Solusi: Gunakan `clamp()` untuk ukuran tombol numpad
...
```

---

### Phase 7: Handoff ke Impeccable

Setelah user review folder screenshot + TODO-RESPONSIVE.md, user akan prompt ulang dengan skill impeccable untuk melakukan perbaikan.

Contoh prompt user ke opencode nanti:
```
/impeccable adapt /dashboard/inventory
fix: tabel overflow horizontal, stack ke card view di mobile
lihat detail di TODO-RESPONSIVE.md
```

---

## Timeline Estimasi

| Phase | Deskripsi | Estimasi |
|-------|-----------|----------|
| 1 | Buat akun test | ~5 menit |
| 2 | Eksplor 34 halaman + mapping selector | ~30-45 menit |
| 3 | Buat Playwright test file | ~45-60 menit |
| 4 | Jalankan test | ~10-20 menit (tergantung jumlah interaksi) |
| 5 | Analisa ~80-120 screenshot | ~30-45 menit |
| 6 | Tulis TODO-RESPONSIVE.md | ~15-30 menit |
| | **Total** | **~2-3 jam** |

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Dynamic route `/pos/invoice/[id]` tidak ada data | Query DB, fallback: skip jika kosong |
| Halaman但uh data spesifik (misal ada transaksi) | Database sudah ada data test ✅ |
| Modal tidak bisa di-trigger karena kondisi tertentu | Coba alternatif selector, skip jika gagal |
| Playwright tidak bisa login (Supabase session) | Gunakan cookie session langsung via API |
| Screenshot terlalu banyak (100+) | Prioritaskan halaman utama, batch processing |
| Waktu render lama | Timeout 15s per halaman |

---

## Persetujuan

Silakan review rencana di atas. Jika ada yang kurang jelas / ingin diubah, kasih tahu. Jika setuju, saya mulai eksekusi **Phase 1** (buat akun test).
