import { test } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SHOTS = path.join(process.cwd(), "screenshots");
const VIEWPORT = { width: 375, height: 812 };
const TIMEOUT = 15000;

// Read env vars for Supabase direct queries
function readEnv(key) {
  try {
    const envFile = fs.readFileSync("/home/haydar/Code/POS/app/.env.local", "utf-8");
    const match = envFile.match(new RegExp(`${key}=(.+)`));
    return match?.[1] || null;
  } catch {
    return null;
  }
}
const SERVICE_ROLE = readEnv("SERVICE_ROLE");
const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");

// ── helpers ───────────────────────────────────────────────────────────────────
async function shot(page, name, folder) {
  const dir = path.join(SHOTS, folder);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  const url = page.url();
  if (url.includes("/dashboard") || url.includes("/pos")) return;

  const usernameInput = page.locator("#identifier").first();
  const passwordInput = page.locator("#password").first();
  await usernameInput.fill(email);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard|\/pos/, { timeout: TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
}

async function tryClick(page, text) {
  const loc = page.locator(`button:has-text("${text}")`).first();
  if ((await loc.count()) > 0 && (await loc.isVisible())) {
    await loc.click();
    return true;
  }
  const aLoc = page.locator(`a:has-text("${text}")`).first();
  if ((await aLoc.count()) > 0 && (await aLoc.isVisible())) {
    await aLoc.click();
    return true;
  }
  return false;
}

async function safeScreenshot(page, name, folder) {
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, name, folder);
}

async function navigate(page, url, expectedPrefix) {
  await page.goto(`${BASE_URL}${url}`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
  await page.waitForTimeout(500);
  return page.url().includes(expectedPrefix);
}

async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// ── main test ─────────────────────────────────────────────────────────────────
test.describe("Responsive Screenshots (375×812)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
  });

  // ===========================================================================
  // PART 1: Login As Admin → Dashboard Pages
  // ===========================================================================
  test("part1-dashboard-screenshots", async ({ page }) => {
    console.log("── Login as Admin ──");
    await loginAs(page, "admin@sobatti.com", "admin123");

    // ── Dashboard Overview ──
    console.log("\n── /dashboard ──");
    if (await navigate(page, "/dashboard", "/dashboard")) {
      await safeScreenshot(page, "01-dashboard", "dashboard");
    }

    // ── Transactions List ──
    console.log("\n── /dashboard/transactions ──");
    if (await navigate(page, "/dashboard/transactions", "/dashboard/transactions")) {
      await safeScreenshot(page, "01-transactions", "dashboard/transactions");
    }

    // ── Customers ──
    console.log("\n── /dashboard/customers ──");
    if (await navigate(page, "/dashboard/customers", "/dashboard/customers")) {
      await safeScreenshot(page, "01-customers", "dashboard/customers");
    }

    // ── Suppliers ──
    console.log("\n── /dashboard/suppliers ──");
    if (await navigate(page, "/dashboard/suppliers", "/dashboard/suppliers")) {
      await safeScreenshot(page, "01-suppliers", "dashboard/suppliers");
    }

    // ── Inventory ──
    console.log("\n── /dashboard/inventory ──");
    if (await navigate(page, "/dashboard/inventory", "/dashboard/inventory")) {
      await safeScreenshot(page, "01-inventory", "dashboard/inventory");
    }

    // ── Stock In ──
    console.log("\n── /dashboard/inventory/stock-in ──");
    if (await navigate(page, "/dashboard/inventory/stock-in", "/dashboard/inventory/stock-in")) {
      await safeScreenshot(page, "01-stock-in", "dashboard/inventory/stock-in");
    }

    // ── Stock In History ──
    console.log("\n── /dashboard/inventory/stock-in/history ──");
    if (await navigate(page, "/dashboard/inventory/stock-in/history", "/dashboard/inventory/stock-in/history")) {
      await safeScreenshot(page, "01-history", "dashboard/inventory/stock-in-history");
    }

    // ── Stock Opname ──
    console.log("\n── /dashboard/inventory/stock-opname ──");
    if (await navigate(page, "/dashboard/inventory/stock-opname", "/dashboard/inventory/stock-opname")) {
      await safeScreenshot(page, "01-stock-opname", "dashboard/inventory/stock-opname");
    }

    // ── Stock Opname History ──
    console.log("\n── /dashboard/inventory/stock-opname/history ──");
    if (await navigate(page, "/dashboard/inventory/stock-opname/history", "/dashboard/inventory/stock-opname/history")) {
      await safeScreenshot(page, "01-history", "dashboard/inventory/stock-opname-history");
    }

    // ── Reports ──
    console.log("\n── /dashboard/reports ──");
    if (await navigate(page, "/dashboard/reports", "/dashboard/reports")) {
      await safeScreenshot(page, "01-reports", "dashboard/reports");
    }

    // ── Laba-Rugi ──
    console.log("\n── /dashboard/laporan/laba-rugi ──");
    if (await navigate(page, "/dashboard/laporan/laba-rugi", "/dashboard/laporan/laba-rugi")) {
      await safeScreenshot(page, "01-laba-rugi", "dashboard/laporan/laba-rugi");
    }

    // ── Neraca ──
    console.log("\n── /dashboard/laporan/neraca ──");
    if (await navigate(page, "/dashboard/laporan/neraca", "/dashboard/laporan/neraca")) {
      await safeScreenshot(page, "01-neraca", "dashboard/laporan/neraca");
    }

    // ── Tutup Kasir ──
    console.log("\n── /dashboard/tutup-kasir ──");
    if (await navigate(page, "/dashboard/tutup-kasir", "/dashboard/tutup-kasir")) {
      await safeScreenshot(page, "01-tutup-kasir", "dashboard/tutup-kasir");
    }

    // ── Laporan Kasir ──
    console.log("\n── /dashboard/laporan-kasir ──");
    if (await navigate(page, "/dashboard/laporan-kasir", "/dashboard/laporan-kasir")) {
      await safeScreenshot(page, "01-laporan-kasir", "dashboard/laporan-kasir");
    }

    // ── Attendance History ──
    console.log("\n── /dashboard/attendance/history ──");
    if (await navigate(page, "/dashboard/attendance/history", "/dashboard/attendance/history")) {
      await safeScreenshot(page, "01-history", "dashboard/attendance/history");
    }

    // ── Attendance Generate QR ──
    console.log("\n── /dashboard/attendance/generate-qr ──");
    if (await navigate(page, "/dashboard/attendance/generate-qr", "/dashboard/attendance/generate-qr")) {
      await safeScreenshot(page, "01-generate-qr", "dashboard/attendance/generate-qr");
    }

    // ── Attendance Report ──
    console.log("\n── /dashboard/attendance/report ──");
    if (await navigate(page, "/dashboard/attendance/report", "/dashboard/attendance/report")) {
      await safeScreenshot(page, "01-report", "dashboard/attendance/report");
    }

    // ── Settings ──
    console.log("\n── /dashboard/settings ──");
    if (await navigate(page, "/dashboard/settings", "/dashboard/settings")) {
      await safeScreenshot(page, "01-settings", "dashboard/settings");
    }

    // ── Settings / Users ──
    console.log("\n── /dashboard/settings/users ──");
    if (await navigate(page, "/dashboard/settings/users", "/dashboard/settings/users")) {
      await safeScreenshot(page, "01-users", "dashboard/settings/users");
    }

    // ── Settings / Reference Data ──
    console.log("\n── /dashboard/settings/reference-data ──");
    if (await navigate(page, "/dashboard/settings/reference-data", "/dashboard/settings/reference-data")) {
      await safeScreenshot(page, "01-ref-data", "dashboard/settings/reference-data");
    }

    // ── Settings / Keuangan ──
    console.log("\n── /dashboard/settings/keuangan ──");
    if (await navigate(page, "/dashboard/settings/keuangan", "/dashboard/settings/keuangan")) {
      await safeScreenshot(page, "01-keuangan", "dashboard/settings/keuangan");
    }

    // ── 404 ──
    console.log("\n── 404 ──");
    if (await navigate(page, "/this-page-does-not-exist", "this-page-does-not-exist")) {
      await safeScreenshot(page, "01-404", "not-found");
    }

    console.log("\n✓ PART 1 done — all dashboard screenshots captured");
  });

  // ===========================================================================
  // PART 2: Login As KASIR → POS + Invoice + Scanner Pages
  // ===========================================================================
  test("part2-pos-screenshots", async ({ page }) => {
    console.log("── Login as KASIR ──");
    await loginAs(page, "kasir1@sobats.com", "kasir123");

    // ── /pos (POS Kasir Page) ──
    console.log("\n── /pos ──");
    if (await navigate(page, "/pos", "/pos")) {
      await safeScreenshot(page, "01-pos", "pos");

      // Wait for products to load from API
      await page.waitForTimeout(2000);
      // Debug: screenshot current state
      await shot(page, "debug-before-search", "pos");
      // Check if products loaded by looking at total items
      const totalItem = page.locator("text=Total Item").first();
      console.log(`  total item visible: ${await totalItem.isVisible()}`);
      const searchInput = page.locator('input[placeholder*="Cari produk"]').first();
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("augerbits");
        await page.waitForTimeout(1500);
        // Debug: screenshot after typing
        await shot(page, "debug-after-search", "pos");
        // Count any buttons that appear as search results
        const allButtons = page.locator('[class*="rounded-xl"] button, .overflow-y-auto button');
        console.log(`  button count: ${await allButtons.count()}`);
        // Try to find any product button
        const productOption = page.locator("button").filter({ hasText: /AUGERBITS|OBENG/i });
        console.log(`  product matches: ${await productOption.count()}`);
        try {
          await productOption.first().waitFor({ state: "visible", timeout: 5000 });
        } catch {
          console.log("⚠ Product not found via hasText, trying all visible buttons...");
          // Try to click any product button in the search results
          const visibleBtns = page.locator(".overflow-y-auto button").first();
          console.log(`  visible dropdown btns: ${await visibleBtns.count()}`);
        }
        if ((await productOption.count()) > 0) {
          await productOption.first().click();
          await page.waitForTimeout(800);
          await safeScreenshot(page, "02-added-to-cart", "pos");

          // Select the cart item
          const cartRow = page.locator("table tbody tr").first();
          if ((await cartRow.count()) > 0) {
            await cartRow.click();
            await page.waitForTimeout(300);
            await safeScreenshot(page, "03-item-selected", "pos");
          }

          // Enter payment via numpad: type "100000"
          const numpadGrid = page.locator(".grid.grid-cols-3").first();
          const numOne = numpadGrid.locator('button:has-text("1")').first();
          if ((await numOne.count()) > 0) await numOne.click();
          await page.waitForTimeout(50);
          const numZero = numpadGrid.locator('button:has-text("0")').first();
          for (let i = 0; i < 5; i++) {
            if ((await numZero.count()) > 0) {
              await numZero.click();
              await page.waitForTimeout(30);
            }
          }
          await page.waitForTimeout(500);
          await safeScreenshot(page, "04-numpad-filled", "pos");
        } else {
          console.log("⚠ No product found in search results");
        }
      }

      // ── /pos/invoice/[id] via checkout ──
      // Try Bayar; if cart empty, skip
      const bayarBtn = page.locator('button:has-text("Bayar")').first();
      if ((await bayarBtn.count()) > 0 && (await bayarBtn.isEnabled())) {
        await bayarBtn.click();
        await page.waitForURL(/\/pos\/invoice\//, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1000);
        if (page.url().includes("/pos/invoice/")) {
          console.log(`✓ Checkout succeeded → ${page.url()}`);
          await safeScreenshot(page, "01-invoice", "pos/invoice");

          const fakturLink = page.locator('a:has-text("Faktur")').first();
          if ((await fakturLink.count()) > 0) {
            await fakturLink.click();
            await page.waitForTimeout(800);
            await safeScreenshot(page, "02-faktur", "pos/invoice");
          }
        } else {
          console.log("⚠ Checkout did not redirect to invoice");
        }
      } else {
        console.log("⚠ Cannot click Bayar - button disabled / not found");
      }
    } else {
      console.log("⚠ /pos not accessible - redirect");
    }

    // ── /attendance/scan ──
    console.log("\n── /attendance/scan ──");
    if (await navigate(page, "/attendance/scan", "/attendance/scan")) {
      await safeScreenshot(page, "01-scan", "attendance/scan");
    }

    // ── /scanner/[sessionId] ──
    console.log("\n── /scanner/[sessionId] ──");
    if (await navigate(page, "/scanner/test-session-123", "/scanner/test-session-123")) {
      await safeScreenshot(page, "01-scanner", "scanner");
    }

    // ── get existing tx id for detail page (if created above) ──
    let createdTxId = null;
    const invoiceMatch = page.url().match(/\/pos\/invoice\/(\d+)/);
    if (invoiceMatch) {
      createdTxId = invoiceMatch[1];
    } else if (SERVICE_ROLE && SUPABASE_URL) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transaksi_keluar?select=id&order=id.desc&limit=1`, {
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) createdTxId = data[0].id;
      } catch {}
    }

    // ── Transaction detail (via KASIR — might redirect) ──
    if (createdTxId) {
      console.log(`\n── /dashboard/transactions/${createdTxId} ──`);
      if (await navigate(page, `/dashboard/transactions/${createdTxId}`, `/dashboard/transactions/${createdTxId}`)) {
        await safeScreenshot(page, "01-detail", "dashboard/transaction-detail");
      } else {
        console.log("⚠ KASIR redirected from transaction detail (expected)");
      }
    }

    console.log("\n✓ PART 2 done — all POS screenshots captured");
  });

  // ===========================================================================
  // PART 3: Login As OWNER → Owner-only pages
  // ===========================================================================
  test("part3-owner-screenshots", async ({ page }) => {
    console.log("── Login as OWNER ──");
    await loginAs(page, "owner@sobats.com", "owner123");

    // ── Settings / Users ──
    console.log("\n── /dashboard/settings/users ──");
    if (await navigate(page, "/dashboard/settings/users", "/dashboard/settings/users")) {
      await safeScreenshot(page, "01-users", "dashboard/settings/users");
    }

    // ── Attendance Report (OWNER only) ──
    console.log("\n── /dashboard/attendance/report ──");
    if (await navigate(page, "/dashboard/attendance/report", "/dashboard/attendance/report")) {
      await safeScreenshot(page, "01-report", "dashboard/attendance/report");
    }

    console.log("\n✓ PART 3 done — owner-only screenshots captured");
  });

  // ===========================================================================
  // PART 4: Login As ADMIN → Transaction detail + Level 2 interactive elements
  // ===========================================================================
  test("part4-admin-level2-screenshots", async ({ page }) => {
    console.log("── Login as ADMIN ──");
    await loginAs(page, "admin@sobatti.com", "admin123");

    // Get latest transaction ID from Supabase
    let latestTxId = null;
    if (SERVICE_ROLE && SUPABASE_URL) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transaksi_keluar?select=id,no_transaksi&order=id.desc&limit=1`, {
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          latestTxId = data[0].id;
          console.log(`✓ Latest transaction: ID ${latestTxId}`);
        } else {
          console.log("⚠ No transactions found in DB");
        }
      } catch (e) {
        console.log("⚠ Could not fetch transactions:", e.message);
      }
    }

    // ── Transaction Detail ──
    if (latestTxId) {
      console.log(`\n── /dashboard/transactions/${latestTxId} ──`);
      if (await navigate(page, `/dashboard/transactions/${latestTxId}`, `/dashboard/transactions/${latestTxId}`)) {
        await safeScreenshot(page, "01-detail", "dashboard/transaction-detail");
      }
    }

    // ── Reports: date range toggles ──
    console.log("\n── /dashboard/reports (Level 2: date range toggle) ──");
    if (await navigate(page, "/dashboard/reports", "/dashboard/reports")) {
      const toggles = ["7 Hari", "30 Hari", "Semua"];
      for (const t of toggles) {
        const btn = page.locator(`button:has-text("${t}")`).first();
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(500);
          await safeScreenshot(page, `toggle-${t.toLowerCase().replace(/\s+/g, "-")}`, "dashboard/reports");
        }
      }
    }

    // ── Inventory: Tampilkan HPP ──
    console.log("\n── /dashboard/inventory (Level 2: HPP toggle) ──");
    if (await navigate(page, "/dashboard/inventory", "/dashboard/inventory")) {
      await page.waitForTimeout(1500);
      await safeScreenshot(page, "01-inventory", "dashboard/inventory");

      // Toggle HPP columns
      if (await tryClick(page, "Tampilkan HPP")) {
        await page.waitForTimeout(500);
        await safeScreenshot(page, "02-hpp-columns", "dashboard/inventory");
        await tryClick(page, "Sembunyikan HPP");
        await page.waitForTimeout(300);
      }

      // Click first product row → detail sheet
      const firstRow = page.locator("table tbody tr").first();
      if ((await firstRow.count()) > 0) {
        await firstRow.click();
        await page.waitForTimeout(800);
        await safeScreenshot(page, "03-detail-sheet", "dashboard/inventory");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }

      // Click "Tambah Produk" → Dialog form
      if (await tryClick(page, "Tambah Produk")) {
        await page.waitForTimeout(800);
        const dialogTitle = page.locator("text=Tambah Produk Baru").first();
        if ((await dialogTitle.count()) > 0) {
          await safeScreenshot(page, "04-add-product-dialog", "dashboard/inventory");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }
      }
    }

    // ── Reference Data: Tab switches ──
    console.log("\n── /dashboard/settings/reference-data (Level 2: tabs) ──");
    if (await navigate(page, "/dashboard/settings/reference-data", "/dashboard/settings/reference-data")) {
      await safeScreenshot(page, "01-ref-data", "dashboard/settings/reference-data");

      for (const tab of ["Satuan Barang", "Metode Pembayaran"]) {
        const tabBtn = page.locator(`button:has-text("${tab}")`).first();
        if ((await tabBtn.count()) > 0 && (await tabBtn.isVisible())) {
          await tabBtn.click();
          await page.waitForTimeout(500);
          await safeScreenshot(page, `tab-${tab.toLowerCase().replace(/\s+/g, "-")}`, "dashboard/settings/reference-data");
        }
      }

      // Back to kategori tab
      const firstTab = page.locator('button:has-text("Kategori Produk")').first();
      if ((await firstTab.count()) > 0) await firstTab.click();
      await page.waitForTimeout(300);
    }

    // ── Transactions: Void modal ──
    if (latestTxId) {
      console.log("\n── /dashboard/transactions (Level 2: void modal) ──");
      if (await navigate(page, "/dashboard/transactions", "/dashboard/transactions")) {
        await page.waitForTimeout(500);
        const trashBtns = page.locator('button[aria-label="Hapus transaksi"], button[aria-label="Void"]').first();
        if ((await trashBtns.count()) > 0 && (await trashBtns.isVisible())) {
          await trashBtns.click();
          await page.waitForTimeout(500);
          const voidModal = page.locator("text=Void Transaksi, text=Hapus Transaksi").first();
          if ((await voidModal.count()) > 0) {
            await safeScreenshot(page, "02-void-modal", "dashboard/transactions");
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
          } else {
            console.log("⚠ Void modal did not appear");
          }
        } else {
          console.log("⚠ No delete/void button visible");
        }
        await safeScreenshot(page, "01-transactions", "dashboard/transactions");
      }
    }

    // ── Pertumbuhan (123 days) / laba-rugi & neraca ──
    console.log("\n── /dashboard/laporan/laba-rugi (Level 2: show report) ──");
    if (await navigate(page, "/dashboard/laporan/laba-rugi", "/dashboard/laporan/laba-rugi")) {
      // Try clicking "Tampilkan Laporan"
      if (await tryClick(page, "Tampilkan Laporan")) {
        await page.waitForTimeout(1500);
        await safeScreenshot(page, "02-ditampilkan", "dashboard/laporan/laba-rugi");
      }
    }

    console.log("\n── /dashboard/laporan/neraca (Level 2: show report) ──");
    if (await navigate(page, "/dashboard/laporan/neraca", "/dashboard/laporan/neraca")) {
      if (await tryClick(page, "Tampilkan Laporan")) {
        await page.waitForTimeout(1500);
        await safeScreenshot(page, "02-ditampilkan", "dashboard/laporan/neraca");
      }
    }

    console.log("\n✓ PART 4 done — admin level-2 screenshots captured");
  });
});
