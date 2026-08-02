import { test } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SHOTS = path.join(process.cwd(), "screenshots");
const VIEWPORT = { width: 375, height: 812 };
const TIMEOUT = 15000;

// Read SERVICE_ROLE for supabase queries
function readEnv(key: string): string | null {
  try {
    const envFile = fs.readFileSync("/home/haydar/Code/POS/app/.env.local", "utf-8");
    const match = envFile.match(new RegExp(`${key}=(.+)`));
    return match?.[1] || null;
  } catch { return null; }
}
const SVC = readEnv("SERVICE_ROLE");
const SB_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");

// ── helpers ───────────────────────────────────────────────────────────────────
async function shot(page: any, name: string, folder: string) {
  const dir = path.join(SHOTS, folder);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  const url = page.url();
  if (url.includes("/dashboard") || url.includes("/pos")) return;
  await page.locator("#identifier").first().fill(email);
  await page.locator("#password").first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard|\/pos/, { timeout: TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  await page.waitForTimeout(500);
}

async function nav(page: any, path: string, expectPrefix: string): Promise<boolean> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  await page.waitForTimeout(500);
  return page.url().includes(expectPrefix);
}

async function click(page: any, text: string): Promise<boolean> {
  const btn = page.locator(`button:has-text("${text}")`).first();
  if ((await btn.count()) > 0 && (await btn.isVisible())) {
    await btn.click();
    return true;
  }
  const a = page.locator(`a:has-text("${text}")`).first();
  if ((await a.count()) > 0 && (await a.isVisible())) {
    await a.click();
    return true;
  }
  return false;
}

async function clickAria(page: any, aria: string): Promise<boolean> {
  const el = page.locator(`[aria-label="${aria}"]`).first();
  if ((await el.count()) > 0) { await el.click(); return true; }
  return false;
}

async function wait(page: any, ms: number) { await page.waitForTimeout(ms); }

async function safeShot(page: any, name: string, folder: string) {
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  await wait(page, 600);
  await shot(page, name, folder);
}

async function esc(page: any) { await page.keyboard.press("Escape"); await wait(page, 400); }

// Close custom POS modals (scanner, cek stok, member) by clicking backdrop overlay
async function closeBackdrop(page: any) {
  const overlay = page.locator('div.fixed.inset-0.z-50').first();
  if ((await overlay.count()) > 0) {
    await overlay.click({ position: { x: 5, y: 5 } });
    await wait(page, 400);
  }
}

// Close delete confirmation & restok modals by clicking "Batal" button in the top modal
async function closeBatal(page: any) {
  const batal = page.locator('div.fixed.inset-0.z-50 button:has-text("Batal")').last();
  if ((await batal.count()) > 0 && (await batal.isVisible())) {
    await batal.click();
    await wait(page, 400);
  }
}

// ─── CHECKLIST ──────────────────────────────────────────────────────────────
// 1. POS: scanner modal, cek stok modal, cari/daftar member modal
// 2. Transactions: void modal
// 3. Customers: inline edit, tambah, delete modal, import CSV
// 4. Suppliers: inline edit, tambah, delete modal, import CSV
// 5. Inventory: restok modal, import CSV
// 6. Stock-in: product combo, tambah baris
// 7. Stock-opname: product combo, tambah baris, import CSV
// 8. Tutup kasir: isi form
// 9. Laporan kasir: export/cetak
// 10. Settings/users: edit, tambah, delete, import CSV
// 11. Settings/reference-data: edit, tambah, delete, import CSV
// 12. Attendance/generate-qr: buat QR
// 13. Settings/profile: isi form
// 14. Settings/keuangan: isi form
// 15. laporan/laba-rugi: unduh CSV, cetak
// 16. laporan/neraca: unduh CSV, cetak
// ────────────────────────────────────────────────────────────────────────────

test.describe("Level 2 Complete — All Interactive Elements", () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize(VIEWPORT); });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART A: KASIR — POS modals (scanner, cek stok, cari member, daftar member)
  // ═══════════════════════════════════════════════════════════════════════════
  test("A-KASIR-POS-modals", async ({ page }) => {
    console.log("── A: Login KASIR → POS modals ──");
    await login(page, "kasir1@sobats.com", "kasir123");
    if (!(await nav(page, "/pos", "/pos"))) { console.log("⚠ /pos not accessible"); return; }
    await wait(page, 3000); // wait for products

    // ── A1. Scanner QR modal ──
    console.log("  A1: QR Scanner modal");
    // Mobile uses smartphone icon button, desktop uses #scanner-btn
    const scBtn = page.locator("button:has(svg.lucide-smartphone)").first();
    if ((await scBtn.count()) > 0 && (await scBtn.isVisible())) await scBtn.click();
    else await page.locator("#scanner-btn").first().click().catch(() => {});
    await wait(page, 1000);
    const scModal = page.locator("text=Scan dengan HP").first();
    if ((await scModal.count()) > 0) {
      await safeShot(page, "02-scanner-modal", "pos");
      await closeBackdrop(page);
    }

    // ── A2. Cek Stok modal ──
    console.log("  A2: Cek Stok modal");
    // On mobile, Cek Stok is icon-only with title attribute; on desktop it has text
    let cekClicked = await click(page, "Cek Stok");
    if (!cekClicked) {
      const cekBtn = page.locator('button[title="Cek Stok"]').first();
      if ((await cekBtn.count()) > 0 && (await cekBtn.isVisible())) { await cekBtn.click(); cekClicked = true; }
    }
    await wait(page, 500);
    const stockModal = page.locator("text=Cek Stok Produk").first();
    if ((await stockModal.count()) > 0) {
      await safeShot(page, "03-cek-stok", "pos");
      await closeBackdrop(page);
    }

    // ── A3. Cari Member modal (pake search icon button) ──
    console.log("  A3: Cari Member modal");
    // Click the "Cari Member" button (text hidden on mobile but DOM contains it)
    const cmBtn = page.locator('button:has-text("Cari Member")').first();
    if ((await cmBtn.count()) > 0) { await cmBtn.click(); await wait(page, 500); }
    const mm = page.locator("text=Cari Member").first();
    if ((await mm.count()) > 0) {
      // Fill phone number for search
      const phoneInput = page.locator('input[type="tel"], input[placeholder="Nomor HP"]').first();
      if ((await phoneInput.count()) > 0) {
        await phoneInput.fill("08123456789");
        await wait(page, 300);
        await safeShot(page, "04-member-search-form", "pos");
        // Click Cari (submit) — scope to modal to avoid matching other "Cari" buttons
        const cariSubmit = page.locator('div.fixed.inset-0.z-50 button[type="submit"]').last();
        if ((await cariSubmit.count()) > 0 && (await cariSubmit.isVisible())) {
          await cariSubmit.click();
          await wait(page, 2500); // wait for search API result
        }
        // Should show "not found" state → "Daftarkan Member Baru"
        const daftarBtn = page.locator('button:has-text("Daftarkan Member Baru")').first();
        if ((await daftarBtn.count()) > 0) {
          await safeShot(page, "05-member-notfound", "pos");
          await daftarBtn.click();
          await wait(page, 500);
          // Registration form
          const regForm = page.locator("text=Daftar Member Baru").first();
          if ((await regForm.count()) > 0) {
            await safeShot(page, "06-member-register", "pos");
          }
        }
      }
      await closeBackdrop(page);
    }

    // ── A4. Numpad - add product + checkout ──
    console.log("  A4: POS add product + numpad");
    const searchInput = page.locator('input[placeholder*="Cari produk"]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("AUGER");
      await wait(page, 1500);
      const prod = page.locator("button").filter({ hasText: /AUGERBITS/i }).first();
      if ((await prod.count()) > 0) {
        await prod.click();
        await wait(page, 500);
        // Set qty: select item → numpad
        const cartRow = page.locator("table tbody tr").first();
        if ((await cartRow.count()) > 0) {
          await cartRow.click();
          await wait(page, 300);
        }
        // Numpad "2" for qty 2
        const n2 = page.locator('.grid.grid-cols-3 button:has-text("2")').first();
        if ((await n2.count()) > 0) await n2.click();
        await wait(page, 100);
        await click(page, "Set Qty");
        await wait(page, 300);
        // Price type Grosir
        await click(page, "Grosir");
        await wait(page, 200);
        await safeShot(page, "07-qty-price-type", "pos");
      }
    }

    console.log("✓ A done — KASIR POS modals");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART B: OWNER — settings/users (all interactions)
  // ═══════════════════════════════════════════════════════════════════════════
  test("B-OWNER-users", async ({ page }) => {
    console.log("── B: Login OWNER → settings/users ──");
    await login(page, "owner@sobats.com", "owner123");

    if (!(await nav(page, "/dashboard/settings/users", "/dashboard/settings/users"))) {
      console.log("⚠ /settings/users not accessible"); return;
    }
    await wait(page, 1000);

    // ── B1. Pengguna Baru (inline edit) ──
    console.log("  B1: Pengguna Baru inline");
    await click(page, "Pengguna Baru");
    await wait(page, 600);
    await safeShot(page, "02-add-inline", "dashboard/settings/users");
    // Fill form
    const namaInput = page.locator('[aria-label="Nama"]').first();
    if ((await namaInput.count()) > 0) await namaInput.fill("Test Karyawan");
    await wait(page, 100);
    const userInput = page.locator('[aria-label="Username"]').first();
    if ((await userInput.count()) > 0) await userInput.fill("testkaryawan");
    await wait(page, 100);
    const pwInput = page.locator('[aria-label="Password"]').first();
    if ((await pwInput.count()) > 0) await pwInput.fill("test123");
    await wait(page, 100);
    await safeShot(page, "03-add-filled", "dashboard/settings/users");
    // Batal
    await clickAria(page, "Batal Edit");
    await wait(page, 500);

    // ── B2. Edit inline ──
    console.log("  B2: Edit inline");
    if (await clickAria(page, "Edit pengguna")) {
      await wait(page, 500);
      await safeShot(page, "04-edit-inline", "dashboard/settings/users");
      await clickAria(page, "Batal Edit");
      await wait(page, 400);
    }

    // ── B3. Delete modal ──
    console.log("  B3: Delete modal");
    if (await clickAria(page, "Hapus pengguna")) {
      await wait(page, 500);
      const delTitle = page.locator("text=Hapus Pengguna").first();
      if ((await delTitle.count()) > 0) {
        await safeShot(page, "05-delete-modal", "dashboard/settings/users");
        await closeBatal(page);
      }
    }

    // ── B4. Import CSV modal ──
    console.log("  B4: Import CSV modal");
    if (await click(page, "Import CSV")) {
      await wait(page, 600);
      const csvTitle = page.locator("text=Import").first();
      if ((await csvTitle.count()) > 0) {
        await safeShot(page, "06-import-csv", "dashboard/settings/users");
        await esc(page);
        await wait(page, 400);
      }
    }

    console.log("✓ B done — OWNER users");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART C: ADMIN — customers, suppliers, inventory restok, etc.
  // ═══════════════════════════════════════════════════════════════════════════
  test("C-ADMIN-level2", async ({ page }) => {
    console.log("── C: Login ADMIN → all remaining Level 2 ──");
    await login(page, "admin@sobatti.com", "admin123");

    // ── C1. Transactions: void modal ──
    console.log("  C1: Transactions void modal");
    if (await nav(page, "/dashboard/transactions", "/dashboard/transactions")) {
      await wait(page, 1000);
      // Try clicking the trash icon in any transaction row
      const trashBtn = page.locator('button[aria-label="Hapus transaksi"]').first();
      if ((await trashBtn.count()) > 0 && (await trashBtn.isVisible())) {
        // There's no aria-label "Hapus transaksi" based on our grep — it's just a Trash2 icon button
        // Let's try finding it differently
      }
      // The void modal is a custom overlay — try clicking any trash button
      // First check if there's a table with rows
      const txRows = page.locator("table tbody tr").first();
      if ((await txRows.count()) > 0) {
        // Look for any button with trash icon inside the first row
        const trash = txRows.locator("button").filter({ has: page.locator("svg") }).first();
        if ((await trash.count()) > 0) {
          await trash.click();
          await wait(page, 500);
          const vModal = page.locator("text=Hapus Transaksi, text=Void Transaksi").first();
          if ((await vModal.count()) > 0) {
            await safeShot(page, "02-void-modal", "dashboard/transactions");
            // Click Batal in void modal
            await click(page, "Batal");
            await wait(page, 300);
          }
        }
      }
      // Date range filter
      const dateInputs = page.locator('input[type="date"]');
      if ((await dateInputs.count()) > 0) {
        await safeShot(page, "03-date-filter", "dashboard/transactions");
      }
    }

    // ── C2. Customers: edit, tambah, delete, import CSV ──
    console.log("  C2: Customers");
    if (await nav(page, "/dashboard/customers", "/dashboard/customers")) {
      await wait(page, 1000);

      // Tambah Pelanggan
      if (await click(page, "Tambah Pelanggan")) {
        await wait(page, 500);
        await safeShot(page, "02-add-inline", "dashboard/customers");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      // Edit
      if (await clickAria(page, "Edit customer")) {
        await wait(page, 500);
        await safeShot(page, "03-edit-inline", "dashboard/customers");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      // Import CSV
      if (await click(page, "Import CSV")) {
        await wait(page, 600);
        await safeShot(page, "04-import-csv", "dashboard/customers");
        await esc(page);
        await wait(page, 400);
      }

      // Delete
      if (await clickAria(page, "Hapus customer")) {
        await wait(page, 500);
        await safeShot(page, "05-delete-modal", "dashboard/customers");
        await esc(page);
        await wait(page, 400);
      }
    }

    // ── C3. Suppliers: edit, tambah, delete, import CSV ──
    console.log("  C3: Suppliers");
    if (await nav(page, "/dashboard/suppliers", "/dashboard/suppliers")) {
      await wait(page, 1000);

      if (await click(page, "Tambah Supplier")) {
        await wait(page, 500);
        await safeShot(page, "02-add-inline", "dashboard/suppliers");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      if (await clickAria(page, "Edit supplier")) {
        await wait(page, 500);
        await safeShot(page, "03-edit-inline", "dashboard/suppliers");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      if (await click(page, "Import CSV")) {
        await wait(page, 600);
        await safeShot(page, "04-import-csv", "dashboard/suppliers");
        await esc(page);
        await wait(page, 400);
      }

      if (await clickAria(page, "Hapus supplier")) {
        await wait(page, 500);
        await safeShot(page, "05-delete-modal", "dashboard/suppliers");
        await esc(page);
        await wait(page, 400);
      }
    }

    // ── C4. Inventory: Restok Display modal + Import CSV ──
    console.log("  C4: Inventory restok + import");
    if (await nav(page, "/dashboard/inventory", "/dashboard/inventory")) {
      await wait(page, 1500);

      // Restok Display
      if (await clickAria(page, "Restok Display")) {
        await wait(page, 500);
        const restokTitle = page.locator("text=Restok Stok Display").first();
        if ((await restokTitle.count()) > 0) {
          await safeShot(page, "05-restok-modal", "dashboard/inventory");
          await closeBatal(page);
        }
      }

      // Import CSV
      if (await click(page, "Import CSV")) {
        await wait(page, 600);
        await safeShot(page, "06-import-csv", "dashboard/inventory");
        await esc(page);
        await wait(page, 400);
      }
    }

    // ── C5. Stock-In: product combo + tambah baris ──
    console.log("  C5: Stock-In form");
    if (await nav(page, "/dashboard/inventory/stock-in", "/dashboard/inventory/stock-in")) {
      await wait(page, 1000);

      // Tambah Baris
      if (await click(page, "Tambah Baris")) {
        await wait(page, 500);
        await safeShot(page, "02-add-row", "dashboard/inventory/stock-in");
      }

      // Product combo (search input)
      const prodInput = page.locator('input[placeholder*="Cari produk"]').first();
      if ((await prodInput.count()) > 0) {
        await prodInput.fill("AUGER");
        await wait(page, 800);
        await safeShot(page, "03-product-combo", "dashboard/inventory/stock-in");
        // Click result if visible
        const result = page.locator("button").filter({ hasText: /AUGERBITS/i }).first();
        if ((await result.count()) > 0) {
          await result.click();
          await wait(page, 300);
          await safeShot(page, "04-product-selected", "dashboard/inventory/stock-in");
        }
      }
    }

    // ── C6. Stock-Opname: product combo + tambah baris + import CSV ──
    console.log("  C6: Stock-Opname form");
    if (await nav(page, "/dashboard/inventory/stock-opname", "/dashboard/inventory/stock-opname")) {
      await wait(page, 1000);

      if (await click(page, "Tambah Baris")) {
        await wait(page, 500);
        await safeShot(page, "02-add-row", "dashboard/inventory/stock-opname");
      }

      if (await click(page, "Import CSV")) {
        await wait(page, 600);
        await safeShot(page, "03-import-csv", "dashboard/inventory/stock-opname");
        await esc(page);
        await wait(page, 400);
      }

      const prodInput2 = page.locator('input[placeholder*="Cari produk"]').first();
      if ((await prodInput2.count()) > 0) {
        await prodInput2.fill("AUGER");
        await wait(page, 800);
        await safeShot(page, "04-product-combo", "dashboard/inventory/stock-opname");
      }
    }

    // ── C7. Tutup Kasir: isi form ──
    console.log("  C7: Tutup Kasir form");
    if (await nav(page, "/dashboard/tutup-kasir", "/dashboard/tutup-kasir")) {
      await wait(page, 1000);
      // Fill date
      const dateInput = page.locator('input[type="date"]').first();
      if ((await dateInput.count()) > 0) {
        const today = new Date().toISOString().split("T")[0];
        await dateInput.fill(today);
        await wait(page, 200);
      }
      // Fill nominal
      const nominalInput = page.locator('input[type="number"]').first();
      if ((await nominalInput.count()) > 0) {
        await nominalInput.fill("5000000");
        await wait(page, 200);
      }
      await safeShot(page, "02-filled", "dashboard/tutup-kasir");
    }

    // ── C8. Laporan Kasir: export + cetak ──
    console.log("  C8: Laporan Kasir buttons");
    if (await nav(page, "/dashboard/laporan-kasir", "/dashboard/laporan-kasir")) {
      await wait(page, 1000);
      await safeShot(page, "01-page", "dashboard/laporan-kasir");
      // Just take screenshot showing the buttons (no actual click to avoid download)
      if (await click(page, "Export CSV")) {
        await wait(page, 1000);
        // Screenshot after click (might trigger download)
      }
      await nav(page, "/dashboard/laporan-kasir", "/dashboard/laporan-kasir");
      await wait(page, 500);
      if (await click(page, "Cetak")) {
        await wait(page, 500);
      }
    }

    // ── C9. Attendance Generate QR: Buat QR Baru ──
    console.log("  C9: Generate QR");
    if (await nav(page, "/dashboard/attendance/generate-qr", "/dashboard/attendance/generate-qr")) {
      await wait(page, 1000);
      await safeShot(page, "01-initial", "dashboard/attendance/generate-qr");
      // Click Buat QR Baru
      if (await click(page, "Buat QR Baru")) {
        await wait(page, 1500); // wait for QR generation API (may 403 for ADMIN)
        await safeShot(page, "02-qr-active", "dashboard/attendance/generate-qr");
      }
    }

    // ── C10. Settings: Profile form ──
    console.log("  C10: Settings profile form");
    if (await nav(page, "/dashboard/settings", "/dashboard/settings")) {
      await wait(page, 1500);
      // Scroll down to find and fill store form
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(page, 300);
      await safeShot(page, "02-profile-form", "dashboard/settings");
      // Find and scroll to store form section
      const storeSection = page.locator("text=Informasi Toko").first();
      if ((await storeSection.count()) > 0) {
        await storeSection.scrollIntoViewIfNeeded();
        await wait(page, 500);
        await safeShot(page, "03-store-form", "dashboard/settings");
      }
    }

    // ── C11. Settings/Reference-Data: edit, tambah, delete, import CSV ──
    console.log("  C11: Reference Data");
    if (await nav(page, "/dashboard/settings/reference-data", "/dashboard/settings/reference-data")) {
      await wait(page, 1000);

      // Tambah Data
      if (await click(page, "Tambah Data")) {
        await wait(page, 500);
        await safeShot(page, "02-add-inline", "dashboard/settings/reference-data");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      // Edit
      if (await clickAria(page, "Edit data")) {
        await wait(page, 500);
        await safeShot(page, "03-edit-inline", "dashboard/settings/reference-data");
        await clickAria(page, "Batal Edit");
        await wait(page, 400);
      }

      // Switch tab: Satuan Barang then repeat
      for (const tab of ["Satuan Barang", "Metode Pembayaran"]) {
        const t = page.locator(`button:has-text("${tab}")`).first();
        if ((await t.count()) > 0 && (await t.isVisible())) {
          await t.click();
          await wait(page, 500);
          // Try Tambah Data on this tab
          if (await click(page, "Tambah Data")) {
            await wait(page, 400);
            // Just screenshot the tab with add inline
            await safeShot(page, `tab-${tab.toLowerCase().replace(/\s+/g, "-")}`, "dashboard/settings/reference-data");
            await clickAria(page, "Batal Edit");
            await wait(page, 300);
          }
        }
      }

      // Back to Kategori tab
      const firstTab = page.locator('button:has-text("Kategori Produk")').first();
      if ((await firstTab.count()) > 0) { await firstTab.click(); await wait(page, 300); }

      // Delete
      if (await clickAria(page, "Hapus data")) {
        await wait(page, 500);
        await safeShot(page, "05-delete-modal", "dashboard/settings/reference-data");
        await closeBatal(page);
      }

      // Import CSV
      if (await click(page, "Import CSV")) {
        await wait(page, 600);
        await safeShot(page, "06-import-csv", "dashboard/settings/reference-data");
        await esc(page);
        await wait(page, 400);
      }
    }

    // ── C12. Settings/Keuangan: isi form ──
    console.log("  C12: Keuangan form");
    if (await nav(page, "/dashboard/settings/keuangan", "/dashboard/settings/keuangan")) {
      await wait(page, 1000);
      // Fill modal awal
      const modalInput = page.locator('input[type="number"]').first();
      if ((await modalInput.count()) > 0) {
        await modalInput.fill("10000000");
        await wait(page, 200);
      }
      await safeShot(page, "02-filled", "dashboard/settings/keuangan");
    }

    // ── C13. Laporan Laba-Rugi: unduh CSV + cetak ──
    console.log("  C13: Laba-Rugi actions");
    if (await nav(page, "/dashboard/laporan/laba-rugi", "/dashboard/laporan/laba-rugi")) {
      await wait(page, 1000);
      // Tampilkan Laporan first
      if (await click(page, "Tampilkan Laporan")) {
        await wait(page, 1500);
        await safeShot(page, "03-unduh-csv", "dashboard/laporan/laba-rugi");
      }
    }

    // ── C14. Laporan Neraca: unduh CSV + cetak ──
    console.log("  C14: Neraca actions");
    if (await nav(page, "/dashboard/laporan/neraca", "/dashboard/laporan/neraca")) {
      await wait(page, 1000);
      if (await click(page, "Tampilkan Laporan")) {
        await wait(page, 1500);
        await safeShot(page, "03-unduh-csv", "dashboard/laporan/neraca");
      }
    }

    console.log("✓ C done — ADMIN all remaining Level 2");
  });
});
