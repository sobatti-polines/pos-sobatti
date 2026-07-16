# Incoming Inventory WAC Plan

**Session ID:** ses_0b4ef0b9fffeDFOupi5ZFpPKYl
**Created:** 7/10/2026, 3:07:10 PM
**Updated:** 7/10/2026, 3:26:52 PM

---

## User

# TASK: Implement Incoming Inventory (Barang Masuk) with Weighted Average Cost (WAC)

## Project Context
You are working on the POS Sobatti project. 
Stack: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL).
Strict Rule: Avoid browser-based calculations for critical business logic to prevent race conditions. All monetary values must be processed securely on the server/database layer.

## Feature Description
We need to implement the "Incoming Stock" (Barang Masuk) feature where admins record new inventory from vendors. 

## Critical Business Logic: Average Cost Calculation
When new stock arrives with a different purchase price, the system MUST recalculate the product's base cost using the **Weighted Average Cost (WAC)** method. 
DO NOT use a simple average (e.g., (Old Price + New Price) / 2). 

Use the following formula:
New Average Cost = ((Current Qty * Current Avg Cost) + (Incoming Qty * Incoming Purchase Price)) / (Current Qty + Incoming Qty)

## Technical Requirements
1. The `average_cost` column in the Supabase database must be of type `numeric` to maintain precision. Do not round numbers during database insertion; rounding should only occur on the UI level using `formatIDR()`.
2. Concurrency handling: The stock and average cost update MUST be atomic. Since a sale could happen at the exact same millisecond the stock is received, you must use a Supabase RPC (PostgreSQL function) or a strict database transaction to lock the row, calculate the new WAC, and update the stock safely.
3. UI Requirement: All forms and notifications must be in Bahasa Indonesia. 

## Execution Instructions
DO NOT write the code immediately. 
First, provide a detailed, step-by-step technical plan covering:
1. Necessary database migrations (if adjusting column types or creating the RPC).
2. The Server Action / API Route implementation.
3. The UI/Form component structure using React Hook Form and Zod.

Wait for my approval on the plan before writing any code. 

---

## Assistant (Plan · DeepSeek V4 Flash Free · 74.8s)

_Thinking:_

The user wants me to create a detailed technical plan for implementing "Incoming Inventory" (Barang Masuk) with Weighted Average Cost (WAC) calculation. I need to first explore the codebase to understand the existing structure before making a plan.

Let me start by exploring the relevant parts of the codebase to understand:
1. Database schema (migrations, tables)
2. Existing server actions / API routes
3. Existing components and patterns
4. POS store and state management

Since I'm in read-only mode (Plan Mode), I can only use read-only tools. Let me explore the codebase.

**Tool: task**

**Input:**
```json
{
  "description": "Explore codebase structure",
  "prompt": "Explore the POS Sobatti codebase at /home/haydar/Code/POS/app to understand the existing architecture for implementing an \"Incoming Inventory\" (Barang Masuk) feature. Specifically, I need you to find and return the contents/structure of:\n\n1. The Supabase migrations in `supabase/migrations/` - list all files and read the most recent ones to understand the schema (especially products table, transactions, any stock-related tables)\n2. The `stores/` directory - read any Zustand stores, especially `pos-store.ts`\n3. The `lib/` directory structure and read files like `formatIDR` helper, `terbilang.ts`\n4. The `components/` directory structure\n5. The `app/` directory structure (pages and routes)\n6. The `app/api/` or any server actions in `lib/actions` or similar\n7. Any existing RPC functions or SQL function definitions\n8. The products table schema (columns like average_cost, stock quantity, etc.)\n\nFor each file, extract the key content. Return a comprehensive summary of the existing architecture, focusing on:\n- How the product schema looks (especially stock and cost fields)\n- What tables exist for inventory/transactions\n- How server actions are structured (pattern used)\n- How forms are built (React Hook Form + Zod pattern)\n- The naming conventions used\n\nBe very thorough - read the full content of relevant migration files, store files, and action files.",
  "subagent_type": "explore"
}
```

**Output:**
```
<task id="ses_0b4eeee8dffek56jRrp3NvwQpB" state="completed">
<task_result>
Now I have all the information needed. Here is the comprehensive architecture summary:

---

# POS Sobatti Architecture Summary for "Barang Masuk" Feature

## 1. Database Schema (Supabase PostgreSQL)

### 1.1 Core Tables (from `database.MD` & migrations)

**`produk` (Products)** — The central inventory table:
| Column | Type | Notes |
|--------|------|-------|
| `id` | `int4 PK` | Serial primary key |
| `nama_produk` | `varchar` | Unique |
| `id_kategori` | `int4 FK` | References `kategori(id)` |
| `id_satuan` | `int4 FK` | References `satuan(id)` |
| `hitung_stok` | `bool` | Whether stock is tracked |
| `harga_modal` | `numeric` | Base/cost price |
| `harga_jual_satuan` | `numeric` | Retail price |
| `harga_jual_grosir` | `numeric` | Wholesale price |
| `harga_jual_promo` | `numeric` | Promo price (nullable) |
| `diskon` | `numeric` | Default per-item discount |
| `barcode` | `text` | Unique, nullable |
| `stok` | `numeric` | **Display stock** (deducted at checkout) |
| `stok_gudang` | `numeric` | **Warehouse stock** (added via barang_masuk) |
| `stok_minimum` | `int4` | Low-stock threshold |
| `harga_pokok_avco` | `numeric` | Moving average cost (AVCO) |
| `nilai_persediaan` | `numeric` | Total inventory value |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**`barang_masuk` (Incoming Inventory)** — The Barang Masuk table:
| Column | Type | Notes |
|--------|------|-------|
| `id` | `int4 PK` | Serial primary key |
| `tgl_masuk` | `date` | Date of receipt |
| `id_supplier` | `int4 FK` | References `supplier(id)`, nullable |
| `id_produk` | `int4 FK` | References `produk(id)` |
| `harga_beli` | `numeric` | Purchase price per unit |
| `jumlah` | `numeric` | Quantity received |
| `total` | `numeric` | = `harga_beli * jumlah` |
| `keterangan` | `text` | Optional notes |
| `created_at` | `timestamp` | |

**`riwayat_avco` (AVCO History)** — Tracks all stock mutations for AVCO:
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | `gen_random_uuid()` |
| `id_produk` | `int4 FK` | References `produk(id)` |
| `tanggal` | `timestamptz` | Default `now()` |
| `jenis_mutasi` | `text` | One of: `pembelian`, `penjualan`, `koreksi`, `retur_beli`, `retur_jual` |
| `id_referensi` | `int4` | FK to `barang_masuk(id)` or `transaksi_keluar(id)` |
| `qty_masuk` | `numeric(12,3)` | |
| `qty_keluar` | `numeric(12,3)` | |
| `harga_satuan_transaksi` | `numeric(15,2)` | Unit price at time of transaction |
| `stok_sebelum` | `numeric(12,3)` | |
| `avco_sebelum` | `numeric(15,2)` | |
| `stok_sesudah` | `numeric(12,3)` | |
| `avco_sesudah` | `numeric(15,2)` | |
| `nilai_persediaan_sesudah` | `numeric(15,2)` | |

**`supplier` (Suppliers):**
| Column | Type |
|--------|------|
| `id` | `int4 PK` |
| `nama_supplier` | `varchar` |
| `alamat` | `text` nullable |
| `telepon` | `varchar` nullable |
| `email` | `varchar` nullable |
| `keterangan` | `text` nullable |
| `created_at` | `timestamp` |

**`hutang_dagang` (Accounts Payable)** — Linked to `barang_masuk` via `id_barang_masuk`:
| Column | Type |
|--------|------|
| `id` | `uuid PK` |
| `id_barang_masuk` | `int4 FK` |
| `id_supplier` | `int4 FK` |
| `tanggal_hutang` | `date` |
| `tanggal_jatuh_tempo` | `date` nullable |
| `jumlah_awal` | `numeric` |
| `jumlah_terbayar` | `numeric` |
| `sisa_hutang` | `numeric` (GENERATED ALWAYS AS) |
| `status` | `text` CHECK (`belum_lunas`, `lunas`, `lewat_jatuh_tempo`) |

Other tables: `kategori`, `satuan`, `metode_bayar`, `pengguna` (users), `pelanggan` (customers), `transaksi_keluar` (outgoing transactions), `detail_transaksi_keluar`, `stok_opname`, `saldo_kas_harian`, `pengaturan_keuangan`, `pengaturan` (store settings).

### 1.2 RPC Functions

**`process_checkout()`** — The key atomic checkout function (latest version in `20260706_add_stok_gudang.sql`):
- Uses `pg_advisory_xact_lock(987654321)` for race-condition-free serialization
- Generates sequential `no_transaksi` with YYYYMM prefix (e.g., `2026070001`)
- Calculates AVCO-based HPP using `harga_pokok_avco`
- Deducts from `stok` (display stock), not `stok_gudang`
- Records AVCO history in `riwayat_avco` with `jenis_mutasi = 'penjualan'`
- Creates `piutang_dagang` if payment is incomplete

**`get_inventory_value_at_date(p_date)`** — Returns total inventory value at a given date from `riwayat_avco`.

### 1.3 AVCO Calculation Logic

The AVCO system is implemented in two places:
1. **Database level** (in `process_checkout`): Uses `harga_pokok_avco` column on `produk`, deducts stock and updates `nilai_persediaan`.
2. **Application level** (`lib/avco.ts`): The `recordAVCOMutation()` function handles AVCO updates for `pembelian` and other mutation types. For purchases:
   - Adds to `stok_gudang` (warehouse stock), NOT `stok` (display stock)
   - Calculates new AVCO as `(current_total_value + incoming_value) / (current_total_stock + incoming_qty)`
   - Updates `harga_pokok_avco`, `nilai_persediaan`, `stok_gudang` on `produk`
   - Inserts row into `riwayat_avco`
   - This function is called from `stock-in/actions.ts` after inserting into `barang_masuk`

## 2. File Structure & Naming Conventions

### 2.1 Route/Page Structure (`app/`)

```
app/
  layout.tsx                          # Root layout
  page.tsx                            # Login page
  globals.css
  manifest.ts
  pos/                                # POS module (cashier)
    layout.tsx
    page.tsx                          # Main POS page
    invoice/[id]/page.tsx             # Invoice/receipt page
    invoice/[id]/receipt/page.tsx     # Printable receipt
    test-barcode/page.tsx
  dashboard/                          # Dashboard module (admin/owner)
    layout.tsx                        # Auth guard + sidebar layout
    page.tsx                          # Dashboard home
    inventory/                        # Inventory module
      page.tsx                        # Product list page (server)
      inventory-client.tsx            # Product list client (CRUD)
      actions.ts                      # addProduct, updateProduct, deleteProduct, restockDisplay
      stock-in/                       # Barang Masuk feature
        page.tsx                      # Server page (fetches data)
        stock-in-client.tsx           # Client form component
        actions.ts                    # addStockIn server action
        history/
          page.tsx                    # History server page
          history-client.tsx          # History client with filters/sort/pagination
      stock-opname/                   # Stock opname feature
        page.tsx
        stock-opname-client.tsx
        actions.ts
        history/
          page.tsx
          history-client.tsx
    suppliers/                        # CRUD for suppliers
      page.tsx, suppliers-client.tsx, actions.ts
    customers/
    transactions/
    reports/
    laporan-kasir/
    laporan/laba-rugi/, neraca/
    hutang/, piutang/
    tutup-kasir/
    attendance/
    settings/
  api/                                # API routes (REST endpoints)
    pos/
      products/route.ts               # GET product list
      barcode/route.ts
      checkout/route.ts               # POST checkout (calls process_checkout RPC)
      payment-methods/route.ts
      customers/route.ts
    attendance/
    low-stock/route.ts
    scanner/
    network-ip/route.ts
    auth/login/route.ts
```

### 2.2 Naming Conventions

- **Tables**: Snake_case, Indonesian (e.g., `produk`, `barang_masuk`, `transaksi_keluar`, `hutang_dagang`)
- **Columns**: Snake_case, Indonesian (e.g., `nama_produk`, `harga_jual_satuan`, `stok_gudang`, `tgl_masuk`)
- **RPC Functions**: Snake_case (`process_checkout`, `get_inventory_value_at_date`)
- **Server action files**: `actions.ts` in each feature folder, export async functions
- **Client component files**: `*-client.tsx` (e.g., `stock-in-client.tsx`, `inventory-client.tsx`)
- **API routes**: Standard Next.js route handlers in `api/` directory
- **TypeScript interfaces**: PascalCase in the files where used
- **Variables/code**: camelCase

## 3. Server Action Pattern

Every dashboard feature follows this pattern:

### Server Component Page (`page.tsx`)
```typescript
// 1. Import server client
import { createClient } from "@/lib/supabase/server";
// 2. Fetch data from Supabase
const { data } = await supabase.from("table").select("...");
// 3. Pass to client component
return <ClientComponent data={data} />;
```

### Server Actions (`actions.ts`)
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function someAction(params: SomeType) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  
  // ... do DB work ...
  
  revalidatePath("/dashboard/some-page");
  return { success: true };
}
```

### Client Component (`*-client.tsx`)
- `"use client"` directive
- Uses `useState`, `useTransition`, `useMemo`, `useCallback`
- Calls server actions directly (NOT fetch API) — e.g., `const res = await addStockIn(payload)`
- Handles loading/error states locally

### API Routes (`app/api/.../route.ts`)
- Standard Next.js App Router route handlers
- Used for the POS checkout flow (called via `fetch()` from the Zustand store)
- Calls `supabase.rpc("process_checkout", {...})`

## 4. Existing Barang Masuk Implementation (Stock-In)

The stock-in feature already exists and is the model you should follow. Here is how it works:

### Flow:
1. **`page.tsx`** (server): Fetches products (`produk` where `hitung_stok = true`) and suppliers (`supplier`)
2. **`stock-in-client.tsx`** (client): Multi-row form with:
   - Product search combobox (with barcode support)
   - Quantity, purchase price, total display (readonly), notes fields
   - Header: Supplier dropdown, date, payment type (Tunai/Kredit), due date
   - Validation (product selected, quantity > 0, price > 0, supplier selected)
   - Submit calls `addStockIn()` server action
3. **`actions.ts`** (server action):
   - Inserts rows into `barang_masuk` table
   - For each row, calls `recordAVCOMutation()` from `lib/avco.ts` with `jenis_mutasi: "pembelian"`
   - If `paymentType === "Kredit"`, creates a `hutang_dagang` record via `lib/hutang.ts`
   - Revalidates `/dashboard/inventory`

### Key observation about the stock system:
- **`barang_masuk` adds to `stok_gudang`** (warehouse stock), not `stok` (display stock)
- **`process_checkout` deducts from `stok`** (display stock) only
- The **`restockDisplay`** action in `inventory/actions.ts` moves stock from `stok_gudang` to `stok` (display)
- So there is a two-tier stock system: warehouse stock received via `barang_masuk`, moved to display via `restockDisplay`, sold from display via checkout

## 5. UI Component Pattern (shadcn + Tailwind v4)

### Layout per page:
```tsx
<div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
  <header className="shrink-0">
    <h1 className="text-4xl font-light tracking-tighter text-foreground">Title</h1>
    <p className="text-muted-foreground mt-2">Description</p>
  </header>
  <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] ...">
    <!-- content -->
  </div>
</div>
```

### Buttons: Pill-shaped (`rounded-full`), with `bg-primary hover:bg-primary/90`
### Tables: Use `@/components/ui/table` wrappers
### Forms: Currently mostly custom (not using `react-hook-form` + `zod` despite being in deps)

## 6. Key Libraries & Helpers

| File | Purpose |
|------|---------|
| `lib/supabase/server.ts` | `createClient()` — server Supabase client |
| `lib/supabase/client.ts` | `createClient()` — browser Supabase client |
| `lib/supabase/admin.ts` | Admin client with service role key |
| `lib/utils.ts` | `cn()` — Tailwind class merge |
| `lib/terbilang.ts` | `terbilang()` / `terbilangRupiah()` — number to Indonesian words |
| `lib/avco.ts` | `calculateNewAVCO()` + `recordAVCOMutation()` — AVCO engine |
| `lib/hutang.ts` | `createHutang()`, `bayarHutang()`, `getHutangList()` |
| `lib/export-utils.ts` | `exportToCSV()`, `exportToPDF()` |
| `stores/pos-store.ts` | Zustand store for POS: products, cart, checkout |
| `formatIDR()` | Defined inline in each client component using `Intl.NumberFormat("id-ID", {style: "currency", currency: "IDR", ...})` |

## 7. Key Patterns for Building "Barang Masuk"

Based on the existing architecture, any new feature for Barang Masuk should follow these patterns:

1. **Server action pattern**: Create `app/dashboard/inventory/stock-in/actions.ts` (already exists with `addStockIn`)
2. **Client form**: `stock-in-client.tsx` (already exists) — multi-row editable table with product search combobox
3. **AVCO integration**: Call `recordAVCOMutation()` with `jenis_mutasi: 'pembelian'` after inserting into `barang_masuk`
4. **Hutang integration**: Optionally create `hutang_dagang` if payment is credit
5. **Validation**: Manual validation via `useMemo`, displayed as error list
6. **Success/error feedback**: Banner at top of form, auto-dismiss success after 4s
7. **Revalidation**: Call `revalidatePath()` after successful mutations
8. **Layout**: The standard 3-level layout (p-4/8/12, shrink-0 header, flex-1 content)
</task_result>
</task>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 4.7s)

_Thinking:_

The exploration reveals that the Barang Masuk feature already exists in the codebase with:
1. `app/dashboard/inventory/stock-in/page.tsx` - server page
2. `app/dashboard/inventory/stock-in/stock-in-client.tsx` - client form
3. `app/dashboard/inventory/stock-in/actions.ts` - server actions
4. `lib/avco.ts` - AVCO logic (already implements WAC)
5. `lib/hutang.ts` - accounts payable logic

However, the user is asking me to implement it. Let me read the existing files to understand what's already there and what might need to be improved/changed.

Let me read the actual file contents to understand the current implementation better before making a plan.

Good — the exploration confirms that a `barang_masuk` feature already exists. Let me read the actual implementation files to understand what's there and what needs to change.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/actions.ts"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/actions.ts</path>
<type>file</type>
<content>
1: "use server";
2: 
3: import { createClient } from "@/lib/supabase/server";
4: import { revalidatePath } from "next/cache";
5: 
6: interface StockInRow {
7:   id_produk: number;
8:   jumlah: number;
9:   harga_beli: number;
10:   total: number;
11:   tgl_masuk: string;
12:   id_supplier: number;
13:   keterangan: string;
14: }
15: 
16: export async function addStockIn(
17:   rows: StockInRow[],
18:   paymentType?: "Tunai" | "Kredit",
19:   tanggalJatuhTempo?: string | null
20: ) {
21:   const supabase = await createClient();
22: 
23:   const { data: { user } } = await supabase.auth.getUser();
24:   if (!user) {
25:     return { error: "Unauthorized" };
26:   }
27: 
28:   const { data: insertedRows, error } = await supabase.from("barang_masuk").insert(
29:     rows.map((r) => ({
30:       id_produk: r.id_produk,
31:       jumlah: r.jumlah,
32:       harga_beli: r.harga_beli,
33:       total: r.total,
34:       tgl_masuk: r.tgl_masuk,
35:       id_supplier: r.id_supplier,
36:       keterangan: r.keterangan || null,
37:     }))
38:   ).select("id, id_produk, jumlah, harga_beli");
39: 
40:   if (error) return { error: error.message };
41: 
42:   if (insertedRows && insertedRows.length > 0) {
43:     for (const row of insertedRows) {
44:       const { data: prod } = await supabase
45:         .from("produk")
46:         .select("hitung_stok")
47:         .eq("id", row.id_produk)
48:         .single();
49:       
50:       if (prod?.hitung_stok) {
51:         const { recordAVCOMutation } = await import("@/lib/avco");
52:         await recordAVCOMutation(supabase, {
53:           id_produk: row.id_produk,
54:           jenis_mutasi: "pembelian",
55:           id_referensi: row.id,
56:           qty_masuk: row.jumlah,
57:           harga_satuan_transaksi: row.harga_beli,
58:         });
59:       }
60:     }
61: 
62:     if (paymentType === "Kredit") {
63:       const { createHutang } = await import("@/lib/hutang");
64:       const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);
65:       const supplierId = rows[0].id_supplier;
66:       const tglMasuk = rows[0].tgl_masuk;
67: 
68:       try {
69:         await createHutang(supabase, {
70:           id_supplier: supplierId,
71:           id_barang_masuk: insertedRows[0].id,
72:           tanggal_hutang: tglMasuk,
73:           tanggal_jatuh_tempo: tanggalJatuhTempo || null,
74:           jumlah_awal: totalAmount,
75:           catatan: "Otomatis dari Barang Masuk",
76:         });
77:       } catch (err: any) {
78:         console.error("Failed to create hutang:", err);
79:         // Continue, as goods are already received
80:       }
81:     }
82:   }
83: 
84:   revalidatePath("/dashboard/inventory");
85:   return { success: true };
86: }

(End of file - total 86 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState, useRef, useEffect, useMemo, useCallback } from "react";
4: import { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2 } from "lucide-react";
5: import { Button } from "@/components/ui/button";
6: import { Input } from "@/components/ui/input";
7: import { addStockIn } from "./actions";
8: 
9: interface Product {
10:   id: number;
11:   nama_produk: string;
12:   barcode: string | null;
13:   satuan: { nama: string } | null;
14: }
15: 
16: interface Supplier {
17:   id: number;
18:   nama_supplier: string;
19: }
20: 
21: interface RowState {
22:   tempId: string;
23:   selectedProduct: Product | null;
24:   searchText: string;
25:   jumlah: number;
26:   hargaBeli: number;
27:   keterangan: string;
28: }
29: 
30: let rowCounter = 0;
31: function nextRowId() {
32:   rowCounter += 1;
33:   return `row-${rowCounter}`;
34: }
35: 
36: const inputBase = "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";
37: 
38: function formatIDR(n: number) {
39:   return new Intl.NumberFormat("id-ID", {
40:     style: "currency",
41:     currency: "IDR",
42:     minimumFractionDigits: 0,
43:     maximumFractionDigits: 0,
44:   }).format(n);
45: }
46: 
47: function ProductCombo({
48:   row,
49:   products,
50:   onChange,
51: }: {
52:   row: RowState;
53:   products: Product[];
54:   onChange: (updates: Partial<RowState>) => void;
55: }) {
56:   const [open, setOpen] = useState(false);
57:   const inputRef = useRef<HTMLInputElement>(null);
58:   const listRef = useRef<HTMLDivElement>(null);
59:   const [highlightIdx, setHighlightIdx] = useState(0);
60: 
61:   const filtered = useMemo(() => {
62:     if (!row.searchText.trim()) return products.slice(0, 50);
63:     const q = row.searchText.toLowerCase();
64:     return products.filter(
65:       (p) =>
66:         p.nama_produk.toLowerCase().includes(q) ||
67:         p.barcode?.toLowerCase().includes(q)
68:     ).slice(0, 80);
69:   }, [row.searchText, products]);
70: 
71:   useEffect(() => {
72:     if (!open) return;
73:     function handleClickOutside(e: MouseEvent) {
74:       if (
75:         inputRef.current &&
76:         !inputRef.current.contains(e.target as Node) &&
77:         listRef.current &&
78:         !listRef.current.contains(e.target as Node)
79:       ) {
80:         setOpen(false);
81:       }
82:     }
83:     document.addEventListener("mousedown", handleClickOutside);
84:     return () => document.removeEventListener("mousedown", handleClickOutside);
85:   }, [open]);
86: 
87:   const selectProduct = useCallback(
88:     (product: Product) => {
89:       onChange({
90:         selectedProduct: product,
91:         searchText: product.nama_produk,
92:       });
93:       setOpen(false);
94:     },
95:     [onChange]
96:   );
97: 
98:   const handleKeyDown = (e: React.KeyboardEvent) => {
99:     if (e.key === "Enter") {
100:       e.preventDefault();
101:       // Handle physical barcode scanner (which types fast and presses Enter)
102:       // We check raw input value because React state (row.searchText) might be stale
103:       const rawValue = inputRef.current?.value;
104:       if (rawValue) {
105:         const exactMatch = products.find(p => p.barcode === rawValue);
106:         if (exactMatch) {
107:           selectProduct(exactMatch);
108:           return;
109:         }
110:       }
111:       
112:       if (!open) {
113:         setOpen(true);
114:         return;
115:       }
116:       if (filtered[highlightIdx]) {
117:         selectProduct(filtered[highlightIdx]);
118:       }
119:       return;
120:     }
121: 
122:     if (!open) {
123:       if (e.key === "ArrowDown") {
124:         setOpen(true);
125:         e.preventDefault();
126:       }
127:       return;
128:     }
129: 
130:     switch (e.key) {
131:       case "ArrowDown":
132:         e.preventDefault();
133:         setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
134:         break;
135:       case "ArrowUp":
136:         e.preventDefault();
137:         setHighlightIdx((i) => Math.max(i - 1, 0));
138:         break;
139:       case "Escape":
140:         setOpen(false);
141:         break;
142:     }
143:   };
144: 
145:   const handleInputChange = (value: string) => {
146:     onChange({ searchText: value, selectedProduct: null });
147:     setHighlightIdx(0);
148:     setOpen(true);
149:   };
150: 
151:   return (
152:     <div className="relative min-w-[200px]">
153:       <input ref={inputRef}
154:         value={row.searchText}
155:         onChange={(e) => handleInputChange(e.target.value)}
156:         onFocus={() => setOpen(true)}
157:         onKeyDown={handleKeyDown}
158:         placeholder="Cari produk..."
159:         className={inputBase + " tabular-nums"}
160:         autoComplete="off"
161:       />
162:       {row.selectedProduct && (
163:         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest">
164:           {row.selectedProduct.satuan?.nama || "-"}
165:         </span>
166:       )}
167:       {open && filtered.length > 0 && (
168:         <div
169:           ref={listRef}
170:           className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-[0_8px_24px_rgba(0,55,112,0.08)] max-h-56 overflow-y-auto"
171:         >
172:           {filtered.map((p, i) => (
173:             <button
174:               type="button"
175:               key={p.id}
176:               className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
177:                 i === highlightIdx
178:                   ? "bg-primary/10 text-primary"
179:                   : "hover:bg-muted text-foreground"
180:               }`}
181:               onMouseDown={() => selectProduct(p)}
182:               onMouseEnter={() => setHighlightIdx(i)}
183:             >
184:               <span className="truncate">{p.nama_produk}</span>
185:               {p.barcode && (
186:                 <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
187:                   {p.barcode}
188:                 </span>
189:               )}
190:             </button>
191:           ))}
192:         </div>
193:       )}
194:       {open && filtered.length === 0 && (
195:         <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md p-3 text-sm text-muted-foreground">
196:           Tidak ada produk ditemukan
197:         </div>
198:       )}
199:     </div>
200:   );
201: }
202: 
203: export default function StockInClient({
204:   products,
205:   suppliers,
206: }: {
207:   products: Product[];
208:   suppliers: Supplier[];
209: }) {
210:   const today = new Date().toISOString().slice(0, 10);
211: 
212:   const [rows, setRows] = useState<RowState[]>([
213:     {
214:       tempId: nextRowId(),
215:       selectedProduct: null,
216:       searchText: "",
217:       jumlah: 1,
218:       hargaBeli: 0,
219:       keterangan: "",
220:     },
221:   ]);
222:   const [idSupplier, setIdSupplier] = useState<number | "">("");
223:   const [tglMasuk, setTglMasuk] = useState(today);
224:   const [paymentType, setPaymentType] = useState<"Tunai" | "Kredit">("Tunai");
225:   const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState(() => {
226:     const d = new Date();
227:     d.setDate(d.getDate() + 30);
228:     return d.toISOString().slice(0, 10);
229:   });
230:   const [loading, setLoading] = useState(false);
231:   const [error, setError] = useState("");
232:   const [success, setSuccess] = useState(false);
233: 
234:   const updateRow = useCallback(
235:     (tempId: string, updates: Partial<RowState>) => {
236:       setRows((prev) =>
237:         prev.map((r) => (r.tempId === tempId ? { ...r, ...updates } : r))
238:       );
239:     },
240:     []
241:   );
242: 
243:   const addRow = useCallback(() => {
244:     setRows((prev) => [
245:       ...prev,
246:       {
247:         tempId: nextRowId(),
248:         selectedProduct: null,
249:         searchText: "",
250:         jumlah: 1,
251:         hargaBeli: 0,
252:         keterangan: "",
253:       },
254:     ]);
255:   }, []);
256: 
257:   const removeRow = useCallback((tempId: string) => {
258:     setRows((prev) => prev.filter((r) => r.tempId !== tempId));
259:   }, []);
260: 
261:   const validationErrors = useMemo(() => {
262:     const errs: string[] = [];
263:     if (!idSupplier) errs.push("Pilih supplier");
264:     rows.forEach((r, i) => {
265:       if (!r.selectedProduct) errs.push(`Baris ${i + 1}: pilih produk`);
266:       if (r.jumlah <= 0) errs.push(`Baris ${i + 1}: jumlah harus > 0`);
267:       if (r.hargaBeli <= 0) errs.push(`Baris ${i + 1}: harga beli harus > 0`);
268:     });
269:     return errs;
270:   }, [idSupplier, rows]);
271: 
272:   const canSubmit = rows.length > 0 && validationErrors.length === 0 && !loading;
273: 
274:   const handleSubmit = async () => {
275:     if (!canSubmit || !idSupplier) return;
276:     setLoading(true);
277:     setError("");
278:     setSuccess(false);
279: 
280:     const payload = rows
281:       .filter((r) => r.selectedProduct && r.jumlah > 0 && r.hargaBeli > 0)
282:       .map((r) => ({
283:         id_produk: r.selectedProduct!.id,
284:         jumlah: r.jumlah,
285:         harga_beli: r.hargaBeli,
286:         total: r.jumlah * r.hargaBeli,
287:         tgl_masuk: tglMasuk,
288:         id_supplier: idSupplier,
289:         keterangan: r.keterangan,
290:       }));
291: 
292:     if (payload.length === 0) {
293:       setError("Tidak ada data valid untuk disimpan");
294:       setLoading(false);
295:       return;
296:     }
297: 
298:     const res = await addStockIn(payload, paymentType, paymentType === "Kredit" ? tanggalJatuhTempo : null);
299: 
300:     if (res?.error) {
301:       setError(res.error);
302:       setLoading(false);
303:       return;
304:     }
305: 
306:     setSuccess(true);
307:     setRows([
308:       {
309:         tempId: nextRowId(),
310:         selectedProduct: null,
311:         searchText: "",
312:         jumlah: 1,
313:         hargaBeli: 0,
314:         keterangan: "",
315:       },
316:     ]);
317:     setIdSupplier("");
318:     setTglMasuk(today);
319:     setLoading(false);
320: 
321:     setTimeout(() => setSuccess(false), 4000);
322:   };
323: 
324:   const totalSemua = useMemo(
325:     () => rows.reduce((s, r) => s + r.jumlah * r.hargaBeli, 0),
326:     [rows]
327:   );
328: 
329:   return (
330:     <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
331:       <header className="shrink-0">
332:         <h1 className="text-4xl font-light tracking-tighter text-foreground">
333:           Barang Masuk
334:         </h1>
335:         <p className="text-muted-foreground mt-2">
336:           Catat penerimaan stok baru dari supplier
337:         </p>
338:       </header>
339: 
340:       <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
341:         {error && (
342:           <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
343:             <AlertCircle className="w-4 h-4 shrink-0" />
344:             {error}
345:           </div>
346:         )}
347: 
348:         {success && (
349:           <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
350:             <Check className="w-4 h-4 shrink-0" />
351:             Barang masuk berhasil disimpan
352:           </div>
353:         )}
354: 
355:         <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent">
356:           <div className="flex flex-col gap-1.5 w-full md:w-auto">
357:             <label htmlFor="id_supplier" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
358:               Supplier
359:             </label>
360:             <select id="id_supplier" value={idSupplier}
361:               onChange={(e) => setIdSupplier(Number(e.target.value) || "")}
362:               className="h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
363:             >
364:               <option value="">Pilih supplier</option>
365:               {suppliers.map((s) => (
366:                 <option key={s.id} value={s.id}>
367:                   {s.nama_supplier}
368:                 </option>
369:               ))}
370:             </select>
371:           </div>
372: 
373:           <div className="flex flex-col gap-1.5 w-full md:w-auto">
374:             <label htmlFor="tgl_masuk" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
375:               Tanggal Masuk
376:             </label>
377:             <input id="tgl_masuk" type="date"
378:               value={tglMasuk}
379:               onChange={(e) => setTglMasuk(e.target.value)}
380:               className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
381:             />
382:           </div>
383: 
384:           <div className="flex flex-col gap-1.5 w-full md:w-auto">
385:             <label htmlFor="payment_type" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
386:               Metode Bayar
387:             </label>
388:             <select id="payment_type" value={paymentType}
389:               onChange={(e) => setPaymentType(e.target.value as "Tunai" | "Kredit")}
390:               className="h-9 w-full md:min-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
391:             >
392:               <option value="Tunai">Tunai</option>
393:               <option value="Kredit">Kredit / Tempo</option>
394:             </select>
395:           </div>
396: 
397:           {paymentType === "Kredit" && (
398:             <div className="flex flex-col gap-1.5 w-full md:w-auto">
399:               <label htmlFor="tgl_jatuh_tempo" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
400:                 Jatuh Tempo
401:               </label>
402:               <input id="tgl_jatuh_tempo" type="date"
403:                 value={tanggalJatuhTempo}
404:                 onChange={(e) => setTanggalJatuhTempo(e.target.value)}
405:                 className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
406:               />
407:             </div>
408:           )}
409:         </div>
410: 
411:         <div className="flex-1 overflow-y-auto min-h-0">
412:           <table className="w-full min-w-[800px]">
413:             <thead>
414:               <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
415:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">
416:                   #
417:                 </th>
418:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">
419:                   Produk
420:                 </th>
421:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[100px] px-2">
422:                   Jumlah
423:                 </th>
424:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2">
425:                   Harga Beli
426:                 </th>
427:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[140px] px-2">
428:                   Total
429:                 </th>
430:                 <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2">
431:                   Keterangan
432:                 </th>
433:                 <th className="w-10 px-2" />
434:               </tr>
435:             </thead>
436:             <tbody>
437:               {rows.map((row, i) => (
438:                 <tr
439:                   key={row.tempId}
440:                   className="border-b border-border/40 hover:bg-muted/20 transition-colors"
441:                 >
442:                   <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2">
443:                     {i + 1}
444:                   </td>
445:                   <td className="px-2 py-2">
446:                     <ProductCombo
447:                       row={row}
448:                       products={products}
449:                       onChange={(updates) => updateRow(row.tempId, updates)}
450:                     />
451:                   </td>
452:                   <td className="px-2 py-2">
453:                     <Input
454:                       type="number"
455:                       min={1}
456:                       value={row.jumlah || ""}
457:                       onChange={(e) =>
458:                         updateRow(row.tempId, {
459:                           jumlah: Math.max(0, Number(e.target.value)),
460:                         })
461:                       }
462:                       className="h-9 tabular-nums font-medium"
463:                     />
464:                   </td>
465:                   <td className="px-2 py-2">
466:                     <Input
467:                       type="number"
468:                       min={0}
469:                       value={row.hargaBeli || ""}
470:                       onChange={(e) =>
471:                         updateRow(row.tempId, {
472:                           hargaBeli: Math.max(0, Number(e.target.value)),
473:                         })
474:                       }
475:                       className="h-9 tabular-nums font-medium"
476:                     />
477:                   </td>
478:                   <td className="px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground">
479:                     {formatIDR(row.jumlah * row.hargaBeli)}
480:                   </td>
481:                   <td className="px-2 py-2">
482:                     <input value={row.keterangan}
483:                       onChange={(e) =>
484:                         updateRow(row.tempId, { keterangan: e.target.value })
485:                       }
486:                       placeholder="Catatan opsional"
487:                       className={inputBase}
488:                     />
489:                   </td>
490:                   <td className="px-2 py-2 text-center">
491:                     <button
492:                       type="button"
493:                       onClick={() => removeRow(row.tempId)}
494:                       disabled={rows.length === 1}
495:                       className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
496:                       title="Hapus baris"
497:                     >
498:                       <Trash2 className="w-4 h-4" />
499:                     </button>
500:                   </td>
501:                 </tr>
502:               ))}
503:             </tbody>
504:           </table>
505: 
506:           {rows.length === 0 && (
507:             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
508:               <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
509:               <p className="text-base font-medium text-foreground">
510:                 Belum ada item
511:               </p>
512:               <p className="text-sm mt-1">
513:                 Tambah item untuk mencatat penerimaan stok
514:               </p>
515:             </div>
516:           )}
517:         </div>
518: 
519:         <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap">
520:           <Button
521:             type="button"
522:             variant="ghost"
523:             className="rounded-full px-4 h-9 text-muted-foreground hover:text-foreground"
524:             onClick={addRow}
525:           >
526:             <Plus className="w-4 h-4 mr-1.5" />
527:             Tambah Baris
528:           </Button>
529: 
530:           <div className="flex items-center gap-4">
531:             <div className="text-right">
532:               <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
533:                 Total Semua
534:               </p>
535:               <p className="text-lg font-light tabular-nums text-foreground">
536:                 {formatIDR(totalSemua)}
537:               </p>
538:             </div>
539:             <Button
540:               type="button"
541:               onClick={handleSubmit}
542:               disabled={!canSubmit}
543:               className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
544:             >
545:               {loading ? (
546:                 <>
547:                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
548:                   Menyimpan...
549:                 </>
550:               ) : (
551:                 "Simpan Barang Masuk"
552:               )}
553:             </Button>
554:           </div>
555:         </div>
556:       </div>
557:     </div>
558:   );
559: }

(End of file - total 559 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/page.tsx"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/page.tsx</path>
<type>file</type>
<content>
1: import { createClient } from "@/lib/supabase/server";
2: import StockInClient from "./stock-in-client";
3: 
4: export default async function StockInPage() {
5:   const supabase = await createClient();
6: 
7:   const [productsRes, suppliersRes] = await Promise.all([
8:     supabase
9:       .from("produk")
10:       .select("id, nama_produk, barcode, satuan(id, nama)")
11:       .eq("hitung_stok", true)
12:       .order("nama_produk"),
13:     supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
14:   ]);
15: 
16:   interface RawStockInProduct {
17:     id: number;
18:     nama_produk: string;
19:     barcode: string | null;
20:     satuan: { id: number; nama: string } | { id: number; nama: string }[] | null;
21:   }
22: 
23:   const products = (productsRes.data ?? []).map((p: RawStockInProduct) => ({
24:     id: p.id,
25:     nama_produk: p.nama_produk,
26:     barcode: p.barcode,
27:     satuan: Array.isArray(p.satuan) ? p.satuan[0] ?? null : p.satuan ?? null,
28:   }));
29: 
30:   return (
31:     <StockInClient
32:       products={products}
33:       suppliers={suppliersRes.data ?? []}
34:     />
35:   );
36: }

(End of file - total 36 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/lib/avco.ts"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/lib/avco.ts</path>
<type>file</type>
<content>
1: import { SupabaseClient } from "@supabase/supabase-js";
2: 
3: export function calculateNewAVCO(
4:   currentQty: number,
5:   currentAvco: number,
6:   incomingQty: number,
7:   incomingPrice: number
8: ): { newAvco: number; newTotalValue: number; newQty: number } {
9:   const currentTotalValue = currentQty * currentAvco;
10:   const incomingTotalValue = incomingQty * incomingPrice;
11:   const newQty = currentQty + incomingQty;
12:   const newTotalValue = currentTotalValue + incomingTotalValue;
13:   const newAvco = newQty > 0 ? newTotalValue / newQty : 0;
14:   
15:   return { newAvco, newTotalValue, newQty };
16: }
17: 
18: export async function recordAVCOMutation(
19:   supabase: SupabaseClient,
20:   params: {
21:     id_produk: number;
22:     jenis_mutasi: 'pembelian' | 'penjualan' | 'koreksi' | 'retur_beli' | 'retur_jual';
23:     id_referensi?: number;
24:     qty_masuk?: number;
25:     qty_keluar?: number;
26:     harga_satuan_transaksi: number;
27:   }
28: ) {
29:   // Get current product stock, warehouse stock, and avco
30:   const { data: prod, error: prodErr } = await supabase
31:     .from("produk")
32:     .select("stok, stok_gudang, harga_pokok_avco, nilai_persediaan")
33:     .eq("id", params.id_produk)
34:     .single();
35: 
36:   if (prodErr || !prod) {
37:     throw new Error(`Product not found for AVCO mutation: ${params.id_produk}`);
38:   }
39: 
40:   const currentDisplayStok = prod.stok ?? 0;
41:   const currentGudangStok = prod.stok_gudang ?? 0;
42:   const currentTotalStok = currentDisplayStok + currentGudangStok;
43:   const currentAvco = prod.harga_pokok_avco ?? 0;
44: 
45:   let newGudangStok = currentGudangStok;
46:   let newDisplayStok = currentDisplayStok;
47:   let newAvco = currentAvco;
48:   let newNilaiPersediaan = prod.nilai_persediaan ?? (currentTotalStok * currentAvco);
49: 
50:   const qtyMasuk = params.qty_masuk ?? 0;
51:   const qtyKeluar = params.qty_keluar ?? 0;
52: 
53:   if (params.jenis_mutasi === 'pembelian' && qtyMasuk > 0) {
54:     // Pembelian adds to warehouse stock, AVCO calculated from total stock
55:     const calc = calculateNewAVCO(currentTotalStok, currentAvco, qtyMasuk, params.harga_satuan_transaksi);
56:     newGudangStok = currentGudangStok + qtyMasuk;
57:     newAvco = calc.newAvco;
58:     newNilaiPersediaan = calc.newTotalValue;
59:   } else if (params.jenis_mutasi === 'penjualan' && qtyKeluar > 0) {
60:     newDisplayStok = currentDisplayStok - qtyKeluar;
61:     newNilaiPersediaan = (newDisplayStok + currentGudangStok) * currentAvco;
62:   } else {
63:     const newTotal = currentTotalStok + qtyMasuk - qtyKeluar;
64:     if (qtyMasuk > 0) {
65:       newGudangStok += qtyMasuk;
66:       newNilaiPersediaan += qtyMasuk * params.harga_satuan_transaksi;
67:       newAvco = newTotal > 0 ? newNilaiPersediaan / newTotal : 0;
68:     } else if (qtyKeluar > 0) {
69:       newDisplayStok -= qtyKeluar;
70:       if (newDisplayStok < 0) {
71:         newGudangStok += newDisplayStok;
72:         newDisplayStok = 0;
73:       }
74:       newNilaiPersediaan -= qtyKeluar * currentAvco;
75:     }
76:   }
77: 
78:   const newTotalStok = newDisplayStok + newGudangStok;
79: 
80:   // Insert to riwayat_avco
81:   const { error: historyErr } = await supabase.from("riwayat_avco").insert({
82:     id_produk: params.id_produk,
83:     jenis_mutasi: params.jenis_mutasi,
84:     id_referensi: params.id_referensi,
85:     qty_masuk: qtyMasuk > 0 ? qtyMasuk : null,
86:     qty_keluar: qtyKeluar > 0 ? qtyKeluar : null,
87:     harga_satuan_transaksi: params.harga_satuan_transaksi,
88:     stok_sebelum: currentTotalStok,
89:     avco_sebelum: currentAvco,
90:     stok_sesudah: newTotalStok,
91:     avco_sesudah: newAvco,
92:     nilai_persediaan_sesudah: newNilaiPersediaan
93:   });
94: 
95:   if (historyErr) {
96:     throw new Error(`Failed to record AVCO history: ${historyErr.message}`);
97:   }
98: 
99:   // Update produk
100:   const { error: updateErr } = await supabase
101:     .from("produk")
102:     .update({
103:       stok: newDisplayStok,
104:       stok_gudang: newGudangStok,
105:       harga_pokok_avco: newAvco,
106:       nilai_persediaan: newNilaiPersediaan
107:     })
108:     .eq("id", params.id_produk);
109: 
110:   if (updateErr) {
111:     throw new Error(`Failed to update product AVCO: ${updateErr.message}`);
112:   }
113: }

(End of file - total 113 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/lib/hutang.ts"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/lib/hutang.ts</path>
<type>file</type>
<content>
1: import { SupabaseClient } from "@supabase/supabase-js";
2: 
3: export interface CreateHutangParams {
4:   id_supplier: number;
5:   id_barang_masuk?: number;
6:   tanggal_hutang: string;
7:   tanggal_jatuh_tempo?: string | null;
8:   jumlah_awal: number;
9:   catatan?: string;
10: }
11: 
12: export async function createHutang(supabase: SupabaseClient, params: CreateHutangParams) {
13:   const { data, error } = await supabase.from("hutang_dagang").insert({
14:     id_supplier: params.id_supplier,
15:     id_barang_masuk: params.id_barang_masuk || null,
16:     tanggal_hutang: params.tanggal_hutang,
17:     tanggal_jatuh_tempo: params.tanggal_jatuh_tempo || null,
18:     jumlah_awal: params.jumlah_awal,
19:     jumlah_terbayar: 0,
20:     status: "belum_lunas",
21:     catatan: params.catatan || null,
22:   }).select().single();
23: 
24:   if (error) {
25:     throw new Error(`Failed to create hutang: ${error.message}`);
26:   }
27:   return data;
28: }
29: 
30: export interface BayarHutangParams {
31:   id_hutang: string;
32:   id_pengguna: number;
33:   tanggal_bayar: string;
34:   jumlah_bayar: number;
35:   metode_bayar: string;
36:   bukti_bayar?: string;
37:   catatan?: string;
38: }
39: 
40: export async function bayarHutang(supabase: SupabaseClient, params: BayarHutangParams) {
41:   // 1. Get current hutang
42:   const { data: hutang, error: hutangErr } = await supabase
43:     .from("hutang_dagang")
44:     .select("jumlah_awal, jumlah_terbayar")
45:     .eq("id", params.id_hutang)
46:     .single();
47: 
48:   if (hutangErr || !hutang) {
49:     throw new Error(`Hutang not found: ${params.id_hutang}`);
50:   }
51: 
52:   // 2. Insert payment
53:   const { error: bayarErr } = await supabase.from("pembayaran_hutang").insert({
54:     id_hutang: params.id_hutang,
55:     tanggal_bayar: params.tanggal_bayar,
56:     jumlah_bayar: params.jumlah_bayar,
57:     metode_bayar: params.metode_bayar,
58:     bukti_bayar: params.bukti_bayar || null,
59:     id_pengguna: params.id_pengguna,
60:     catatan: params.catatan || null,
61:   });
62: 
63:   if (bayarErr) {
64:     throw new Error(`Failed to insert pembayaran: ${bayarErr.message}`);
65:   }
66: 
67:   // 3. Update hutang_dagang status and jumlah_terbayar
68:   const newTerbayar = Number(hutang.jumlah_terbayar) + Number(params.jumlah_bayar);
69:   const newStatus = newTerbayar >= Number(hutang.jumlah_awal) ? "lunas" : "belum_lunas";
70: 
71:   const { error: updateErr } = await supabase
72:     .from("hutang_dagang")
73:     .update({
74:       jumlah_terbayar: newTerbayar,
75:       status: newStatus,
76:       updated_at: new Date().toISOString(),
77:     })
78:     .eq("id", params.id_hutang);
79: 
80:   if (updateErr) {
81:     throw new Error(`Failed to update hutang: ${updateErr.message}`);
82:   }
83: 
84:   return { success: true };
85: }
86: 
87: export async function getHutangList(supabase: SupabaseClient) {
88:   const { data, error } = await supabase
89:     .from("hutang_dagang")
90:     .select(`
91:       *,
92:       supplier:id_supplier ( id, nama_supplier )
93:     `)
94:     .order("tanggal_hutang", { ascending: false });
95: 
96:   if (error) {
97:     throw new Error(`Failed to fetch hutang: ${error.message}`);
98:   }
99:   return data;
100: }

(End of file - total 100 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.0s)

_Thinking:_

Now let me also check the existing migration files and the latest migration to understand the schema thoroughly, and look at the `process_checkout` RPC for reference on how the atomic operations are done.

Good. Now let me look at the migration files and the `process_checkout` RPC, plus the Supabase configuration.

**Tool: glob**

**Input:**
```json
{
  "pattern": "supabase/migrations/*.sql"
}
```

**Output:**
```
/home/haydar/Code/POS/app/supabase/migrations/20260601000004_create_kas_dan_laporan.sql
/home/haydar/Code/POS/app/supabase/migrations/20260606000002_process_checkout_piutang.sql
/home/haydar/Code/POS/app/supabase/migrations/20260601000003_create_avco_tracking.sql
/home/haydar/Code/POS/app/supabase/migrations/20260606000003_add_neraca_rpc.sql
/home/haydar/Code/POS/app/supabase/migrations/20260706_add_stok_gudang.sql
/home/haydar/Code/POS/app/supabase/migrations/20260708_add_produk_realtime.sql
/home/haydar/Code/POS/app/supabase/migrations/20260707_add_rls_riwayat_avco.sql
/home/haydar/Code/POS/app/supabase/migrations/20260601000002_create_hutang_piutang.sql
/home/haydar/Code/POS/app/supabase/migrations/20260606000001_update_process_checkout.sql
/home/haydar/Code/POS/app/supabase/migrations/20260529114225_fix_checkout_race_condition.sql
/home/haydar/Code/POS/app/supabase/migrations/20260601000001_add_accounting_fields.sql
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase</path>
<type>directory</type>
<entries>
.temp/
migrations/

(2 entries)
</entries>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.1s)

_Thinking:_

Let me read the key migration files to understand the schema and the `process_checkout` RPC.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260706_add_stok_gudang.sql"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase/migrations/20260706_add_stok_gudang.sql</path>
<type>file</type>
<content>
1: -- Add warehouse stock column to produk
2: -- stok becomes display stock, stok_gudang = warehouse stock
3: ALTER TABLE produk ADD COLUMN stok_gudang numeric DEFAULT 0;
4: 
5: -- Update process_checkout to use total stock for nilai_persediaan calculation
6: CREATE OR REPLACE FUNCTION process_checkout(
7:   p_items jsonb,
8:   p_id_kasir integer,
9:   p_id_pelanggan integer DEFAULT NULL,
10:   p_id_metode_bayar integer DEFAULT NULL,
11:   p_diskon_persen numeric DEFAULT 0,
12:   p_bayar numeric DEFAULT 0,
13:   p_pajak_persen numeric DEFAULT 0,
14:   p_is_dp boolean DEFAULT false
15: )
16: RETURNS jsonb
17: LANGUAGE plpgsql
18: SECURITY DEFINER
19: AS $$
20: DECLARE
21:   v_prefix       text;
22:   v_last         bigint;
23:   v_seq          int;
24:   v_no_transaksi bigint;
25:   v_item         jsonb;
26:   v_subtotal     numeric := 0;
27:   v_jumlah       numeric;
28:   v_harga_jual   numeric;
29:   v_diskon_item  numeric;
30:   v_profit       numeric;
31:   v_diskon_nominal numeric;
32:   v_pajak_nominal  numeric;
33:   v_total        numeric;
34:   v_kembali      numeric;
35:   v_dp           numeric;
36:   v_sisa         numeric;
37:   v_tx_id        integer;
38:   v_details      jsonb[] := '{}';
39:   v_prod         record;
40:   v_type_harga   text;
41:   v_total_hpp          numeric := 0;
42:   v_laba_kotor         numeric := 0;
43:   v_harga_pokok_satuan numeric;
44:   v_total_harga_pokok  numeric;
45:   v_stok_total         numeric;
46: BEGIN
47:   -- Serialise concurrent calls with an advisory lock (released at end of txn)
48:   PERFORM pg_advisory_xact_lock(987654321);
49: 
50:   -- Build YYYYMM prefix in WIB timezone
51:   v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');
52: 
53:   -- Find the highest no_transaksi this month
54:   SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
55:   FROM transaksi_keluar
56:   WHERE no_transaksi::text LIKE v_prefix || '%';
57: 
58:   IF v_last = 0 THEN
59:     v_seq := 1;
60:   ELSE
61:     v_seq := (v_last % 10000)::int + 1;
62:   END IF;
63: 
64:   v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;
65: 
66:   -- Calculate subtotal from items
67:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
68:   LOOP
69:     SELECT id, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, hitung_stok, stok, stok_gudang, harga_pokok_avco, nilai_persediaan
70:     INTO v_prod
71:     FROM produk
72:     WHERE id = (v_item->>'id_produk')::integer;
73: 
74:     IF NOT FOUND THEN CONTINUE; END IF;
75: 
76:     v_type_harga  := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
77:     v_diskon_item := COALESCE((v_item->>'diskon_item')::numeric, 0);
78: 
79:     v_harga_jual := v_prod.harga_jual_satuan;
80:     IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_prod.harga_jual_grosir; END IF;
81:     IF v_type_harga = 'PROMO' AND v_prod.harga_jual_promo IS NOT NULL THEN
82:       v_harga_jual := v_prod.harga_jual_promo;
83:     END IF;
84: 
85:     v_jumlah  := (v_harga_jual - v_diskon_item) * (v_item->>'qty')::numeric;
86:     
87:     -- AVCO HPP calculation
88:     v_harga_pokok_satuan := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal);
89:     v_total_harga_pokok := v_harga_pokok_satuan * (v_item->>'qty')::numeric;
90:     
91:     v_total_hpp := v_total_hpp + v_total_harga_pokok;
92:     
93:     -- Profit based on AVCO
94:     v_profit  := v_jumlah - v_total_harga_pokok;
95:     v_laba_kotor := v_laba_kotor + v_profit;
96: 
97:     v_subtotal := v_subtotal + v_jumlah;
98: 
99:     v_details := v_details || jsonb_build_object(
100:       'id_produk',      v_prod.id,
101:       'type_harga_jual', v_type_harga,
102:       'harga_modal',    v_prod.harga_modal,
103:       'harga_jual',     v_harga_jual,
104:       'diskon_item',    v_diskon_item,
105:       'qty',            (v_item->>'qty')::numeric,
106:       'jumlah',         v_jumlah,
107:       'kas_masuk',      v_jumlah,
108:       'profit',         v_profit,
109:       'harga_pokok_satuan', v_harga_pokok_satuan,
110:       'total_harga_pokok', v_total_harga_pokok
111:     );
112:   END LOOP;
113: 
114:   v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
115:   v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
116:   v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
117:   v_kembali        := GREATEST(0, p_bayar - v_total);
118:   v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
119:   v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;
120: 
121:   -- Validate customer for credit/receivable
122:   IF v_sisa > 0 AND p_id_pelanggan IS NULL THEN
123:     RAISE EXCEPTION 'Pelanggan harus dipilih untuk transaksi kredit/DP';
124:   END IF;
125: 
126:   -- Insert header
127:   INSERT INTO transaksi_keluar (
128:     no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar,
129:     subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal,
130:     total, bayar, kembali, dp, sisa, total_hpp, laba_kotor
131:   ) VALUES (
132:     v_no_transaksi, now(), p_id_kasir, p_id_pelanggan, p_id_metode_bayar,
133:     v_subtotal, p_diskon_persen, v_diskon_nominal, p_pajak_persen, v_pajak_nominal,
134:     v_total, p_bayar, v_kembali, v_dp, v_sisa, v_total_hpp, v_laba_kotor
135:   )
136:   RETURNING id INTO v_tx_id;
137: 
138:   -- Create Piutang if there is a balance
139:   IF v_sisa > 0 THEN
140:     INSERT INTO piutang_dagang (
141:       id_transaksi_keluar, id_pelanggan, tanggal_piutang, jumlah_awal, status
142:     ) VALUES (
143:       v_tx_id, p_id_pelanggan, now(), v_sisa, 'belum_lunas'
144:     );
145:   END IF;
146: 
147:   -- Insert detail rows
148:   INSERT INTO detail_transaksi_keluar (
149:     id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
150:     diskon_item, qty, jumlah, kas_masuk, profit, harga_pokok_satuan, total_harga_pokok
151:   )
152:   SELECT
153:     v_tx_id,
154:     (d->>'id_produk')::integer,
155:     d->>'type_harga_jual',
156:     (d->>'harga_modal')::numeric,
157:     (d->>'harga_jual')::numeric,
158:     (d->>'diskon_item')::numeric,
159:     (d->>'qty')::numeric,
160:     (d->>'jumlah')::numeric,
161:     (d->>'kas_masuk')::numeric,
162:     (d->>'profit')::numeric,
163:     (d->>'harga_pokok_satuan')::numeric,
164:     (d->>'total_harga_pokok')::numeric
165:   FROM unnest(v_details) AS d;
166: 
167:   -- Deduct display stock where hitung_stok = true and record AVCO mutation
168:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
169:   LOOP
170:     SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
171:     INTO v_prod
172:     FROM produk
173:     WHERE id = (v_item->>'id_produk')::integer AND hitung_stok = true;
174: 
175:     IF FOUND THEN
176:       v_stok_total := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
177: 
178:       -- Record into riwayat_avco
179:       INSERT INTO riwayat_avco (
180:         id_produk, jenis_mutasi, id_referensi, qty_keluar,
181:         harga_satuan_transaksi, stok_sebelum, avco_sebelum,
182:         stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
183:       ) VALUES (
184:         (v_item->>'id_produk')::integer,
185:         'penjualan',
186:         v_tx_id,
187:         (v_item->>'qty')::numeric,
188:         v_prod.harga_pokok_avco,
189:         v_prod.stok,
190:         v_prod.harga_pokok_avco,
191:         v_prod.stok - (v_item->>'qty')::numeric,
192:         v_prod.harga_pokok_avco,
193:         (v_stok_total - (v_item->>'qty')::numeric) * v_prod.harga_pokok_avco
194:       );
195: 
196:       -- Update product display stock
197:       UPDATE produk
198:       SET stok = stok - (v_item->>'qty')::numeric,
199:           nilai_persediaan = (COALESCE(stok, 0) - (v_item->>'qty')::numeric + COALESCE(stok_gudang, 0)) * harga_pokok_avco
200:       WHERE id = (v_item->>'id_produk')::integer;
201:     END IF;
202:   END LOOP;
203: 
204:   RETURN jsonb_build_object(
205:     'success',       true,
206:     'id',            v_tx_id,
207:     'no_transaksi',  v_no_transaksi,
208:     'total',         v_total,
209:     'kembali',       v_kembali
210:   );
211: END;
212: $$;

(End of file - total 212 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260601000003_create_avco_tracking.sql"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase/migrations/20260601000003_create_avco_tracking.sql</path>
<type>file</type>
<content>
1: -- File: 20260601000003_create_avco_tracking.sql
2: 
3: CREATE TABLE riwayat_avco (
4:   id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
5:   id_produk                 INTEGER NOT NULL REFERENCES produk(id),
6:   tanggal                   TIMESTAMPTZ NOT NULL DEFAULT now(),
7:   jenis_mutasi              TEXT NOT NULL
8:                               CHECK (jenis_mutasi IN ('pembelian','penjualan','koreksi','retur_beli','retur_jual')),
9:   id_referensi              INTEGER,
10:   qty_masuk                 NUMERIC(12,3),
11:   qty_keluar                NUMERIC(12,3),
12:   harga_satuan_transaksi    NUMERIC(15,2),
13:   stok_sebelum              NUMERIC(12,3) NOT NULL,
14:   avco_sebelum              NUMERIC(15,2) NOT NULL,
15:   stok_sesudah              NUMERIC(12,3) NOT NULL,
16:   avco_sesudah              NUMERIC(15,2) NOT NULL,
17:   nilai_persediaan_sesudah  NUMERIC(15,2) NOT NULL
18: );
19: 
20: CREATE INDEX idx_riwayat_avco_produk ON riwayat_avco(id_produk, tanggal DESC);

(End of file - total 20 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260529114225_fix_checkout_race_condition.sql"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase/migrations/20260529114225_fix_checkout_race_condition.sql</path>
<type>file</type>
<content>
1: CREATE OR REPLACE FUNCTION process_checkout(
2:   p_items jsonb,
3:   p_id_kasir integer,
4:   p_id_pelanggan integer DEFAULT NULL,
5:   p_id_metode_bayar integer DEFAULT NULL,
6:   p_diskon_persen numeric DEFAULT 0,
7:   p_bayar numeric DEFAULT 0,
8:   p_pajak_persen numeric DEFAULT 0,
9:   p_is_dp boolean DEFAULT false
10: )
11: RETURNS jsonb
12: LANGUAGE plpgsql
13: SECURITY DEFINER
14: AS $$
15: DECLARE
16:   v_prefix       text;
17:   v_last         bigint;
18:   v_seq          int;
19:   v_no_transaksi bigint;
20:   v_item         jsonb;
21:   v_subtotal     numeric := 0;
22:   v_jumlah       numeric;
23:   v_harga_jual   numeric;
24:   v_diskon_item  numeric;
25:   v_profit       numeric;
26:   v_diskon_nominal numeric;
27:   v_pajak_nominal  numeric;
28:   v_total        numeric;
29:   v_kembali      numeric;
30:   v_dp           numeric;
31:   v_sisa         numeric;
32:   v_tx_id        integer;
33:   v_details      jsonb[] := '{}';
34:   v_prod         record;
35:   v_type_harga   text;
36: BEGIN
37:   -- Serialise concurrent calls with an advisory lock (released at end of txn)
38:   PERFORM pg_advisory_xact_lock(987654321);
39: 
40:   -- Build YYYYMM prefix in WIB timezone
41:   v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');
42: 
43:   -- Find the highest no_transaksi this month
44:   SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
45:   FROM transaksi_keluar
46:   WHERE no_transaksi::text LIKE v_prefix || '%';
47: 
48:   IF v_last = 0 THEN
49:     v_seq := 1;
50:   ELSE
51:     v_seq := (v_last % 10000)::int + 1;
52:   END IF;
53: 
54:   v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;
55: 
56:   -- Calculate subtotal from items
57:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
58:   LOOP
59:     SELECT id, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, hitung_stok, stok
60:     INTO v_prod
61:     FROM produk
62:     WHERE id = (v_item->>'id_produk')::integer;
63: 
64:     IF NOT FOUND THEN CONTINUE; END IF;
65: 
66:     v_type_harga  := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
67:     v_diskon_item := COALESCE((v_item->>'diskon_item')::numeric, 0);
68: 
69:     v_harga_jual := v_prod.harga_jual_satuan;
70:     IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_prod.harga_jual_grosir; END IF;
71:     IF v_type_harga = 'PROMO' AND v_prod.harga_jual_promo IS NOT NULL THEN
72:       v_harga_jual := v_prod.harga_jual_promo;
73:     END IF;
74: 
75:     v_jumlah  := (v_harga_jual - v_diskon_item) * (v_item->>'qty')::numeric;
76:     v_profit  := (v_harga_jual - v_prod.harga_modal) * (v_item->>'qty')::numeric
77:                  - v_diskon_item * (v_item->>'qty')::numeric;
78: 
79:     v_subtotal := v_subtotal + v_jumlah;
80: 
81:     v_details := v_details || jsonb_build_object(
82:       'id_produk',      v_prod.id,
83:       'type_harga_jual', v_type_harga,
84:       'harga_modal',    v_prod.harga_modal,
85:       'harga_jual',     v_harga_jual,
86:       'diskon_item',    v_diskon_item,
87:       'qty',            (v_item->>'qty')::numeric,
88:       'jumlah',         v_jumlah,
89:       'kas_masuk',      v_jumlah,
90:       'profit',         v_profit
91:     );
92:   END LOOP;
93: 
94:   v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
95:   v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
96:   v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
97:   v_kembali        := GREATEST(0, p_bayar - v_total);
98:   v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
99:   v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;
100: 
101:   -- Insert header
102:   INSERT INTO transaksi_keluar (
103:     no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar,
104:     subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal,
105:     total, bayar, kembali, dp, sisa
106:   ) VALUES (
107:     v_no_transaksi, now(), p_id_kasir, p_id_pelanggan, p_id_metode_bayar,
108:     v_subtotal, p_diskon_persen, v_diskon_nominal, p_pajak_persen, v_pajak_nominal,
109:     v_total, p_bayar, v_kembali, v_dp, v_sisa
110:   )
111:   RETURNING id INTO v_tx_id;
112: 
113:   -- Insert detail rows
114:   INSERT INTO detail_transaksi_keluar (
115:     id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
116:     diskon_item, qty, jumlah, kas_masuk, profit
117:   )
118:   SELECT
119:     v_tx_id,
120:     (d->>'id_produk')::integer,
121:     d->>'type_harga_jual',
122:     (d->>'harga_modal')::numeric,
123:     (d->>'harga_jual')::numeric,
124:     (d->>'diskon_item')::numeric,
125:     (d->>'qty')::numeric,
126:     (d->>'jumlah')::numeric,
127:     (d->>'kas_masuk')::numeric,
128:     (d->>'profit')::numeric
129:   FROM unnest(v_details) AS d;
130: 
131:   -- Deduct stock where hitung_stok = true
132:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
133:   LOOP
134:     UPDATE produk
135:     SET stok = stok - (v_item->>'qty')::numeric
136:     WHERE id = (v_item->>'id_produk')::integer
137:       AND hitung_stok = true;
138:   END LOOP;
139: 
140:   RETURN jsonb_build_object(
141:     'success',       true,
142:     'id',            v_tx_id,
143:     'no_transaksi',  v_no_transaksi,
144:     'total',         v_total,
145:     'kembali',       v_kembali
146:   );
147: END;
148: $$;
149: 
150: GRANT EXECUTE ON FUNCTION process_checkout(jsonb, integer, integer, integer, numeric, numeric, numeric, boolean) TO authenticated;

(End of file - total 150 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260606000001_update_process_checkout.sql"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase/migrations/20260606000001_update_process_checkout.sql</path>
<type>file</type>
<content>
1: -- File: 20260606000001_update_process_checkout.sql
2: 
3: CREATE OR REPLACE FUNCTION process_checkout(
4:   p_items jsonb,
5:   p_id_kasir integer,
6:   p_id_pelanggan integer DEFAULT NULL,
7:   p_id_metode_bayar integer DEFAULT NULL,
8:   p_diskon_persen numeric DEFAULT 0,
9:   p_bayar numeric DEFAULT 0,
10:   p_pajak_persen numeric DEFAULT 0,
11:   p_is_dp boolean DEFAULT false
12: )
13: RETURNS jsonb
14: LANGUAGE plpgsql
15: SECURITY DEFINER
16: AS $$
17: DECLARE
18:   v_prefix       text;
19:   v_last         bigint;
20:   v_seq          int;
21:   v_no_transaksi bigint;
22:   v_item         jsonb;
23:   v_subtotal     numeric := 0;
24:   v_jumlah       numeric;
25:   v_harga_jual   numeric;
26:   v_diskon_item  numeric;
27:   v_profit       numeric;
28:   v_diskon_nominal numeric;
29:   v_pajak_nominal  numeric;
30:   v_total        numeric;
31:   v_kembali      numeric;
32:   v_dp           numeric;
33:   v_sisa         numeric;
34:   v_tx_id        integer;
35:   v_details      jsonb[] := '{}';
36:   v_prod         record;
37:   v_type_harga   text;
38:   v_total_hpp          numeric := 0;
39:   v_laba_kotor         numeric := 0;
40:   v_harga_pokok_satuan numeric;
41:   v_total_harga_pokok  numeric;
42: BEGIN
43:   -- Serialise concurrent calls with an advisory lock (released at end of txn)
44:   PERFORM pg_advisory_xact_lock(987654321);
45: 
46:   -- Build YYYYMM prefix in WIB timezone
47:   v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');
48: 
49:   -- Find the highest no_transaksi this month
50:   SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
51:   FROM transaksi_keluar
52:   WHERE no_transaksi::text LIKE v_prefix || '%';
53: 
54:   IF v_last = 0 THEN
55:     v_seq := 1;
56:   ELSE
57:     v_seq := (v_last % 10000)::int + 1;
58:   END IF;
59: 
60:   v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;
61: 
62:   -- Calculate subtotal from items
63:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
64:   LOOP
65:     SELECT id, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, hitung_stok, stok, harga_pokok_avco, nilai_persediaan
66:     INTO v_prod
67:     FROM produk
68:     WHERE id = (v_item->>'id_produk')::integer;
69: 
70:     IF NOT FOUND THEN CONTINUE; END IF;
71: 
72:     v_type_harga  := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
73:     v_diskon_item := COALESCE((v_item->>'diskon_item')::numeric, 0);
74: 
75:     v_harga_jual := v_prod.harga_jual_satuan;
76:     IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_prod.harga_jual_grosir; END IF;
77:     IF v_type_harga = 'PROMO' AND v_prod.harga_jual_promo IS NOT NULL THEN
78:       v_harga_jual := v_prod.harga_jual_promo;
79:     END IF;
80: 
81:     v_jumlah  := (v_harga_jual - v_diskon_item) * (v_item->>'qty')::numeric;
82:     
83:     -- AVCO HPP calculation
84:     v_harga_pokok_satuan := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal);
85:     v_total_harga_pokok := v_harga_pokok_satuan * (v_item->>'qty')::numeric;
86:     
87:     v_total_hpp := v_total_hpp + v_total_harga_pokok;
88:     
89:     -- Profit based on AVCO
90:     v_profit  := v_jumlah - v_total_harga_pokok;
91:     v_laba_kotor := v_laba_kotor + v_profit;
92: 
93:     v_subtotal := v_subtotal + v_jumlah;
94: 
95:     v_details := v_details || jsonb_build_object(
96:       'id_produk',      v_prod.id,
97:       'type_harga_jual', v_type_harga,
98:       'harga_modal',    v_prod.harga_modal,
99:       'harga_jual',     v_harga_jual,
100:       'diskon_item',    v_diskon_item,
101:       'qty',            (v_item->>'qty')::numeric,
102:       'jumlah',         v_jumlah,
103:       'kas_masuk',      v_jumlah,
104:       'profit',         v_profit,
105:       'harga_pokok_satuan', v_harga_pokok_satuan,
106:       'total_harga_pokok', v_total_harga_pokok
107:     );
108:   END LOOP;
109: 
110:   v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
111:   v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
112:   v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
113:   v_kembali        := GREATEST(0, p_bayar - v_total);
114:   v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
115:   v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;
116: 
117:   -- Insert header
118:   INSERT INTO transaksi_keluar (
119:     no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar,
120:     subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal,
121:     total, bayar, kembali, dp, sisa, total_hpp, laba_kotor
122:   ) VALUES (
123:     v_no_transaksi, now(), p_id_kasir, p_id_pelanggan, p_id_metode_bayar,
124:     v_subtotal, p_diskon_persen, v_diskon_nominal, p_pajak_persen, v_pajak_nominal,
125:     v_total, p_bayar, v_kembali, v_dp, v_sisa, v_total_hpp, v_laba_kotor
126:   )
127:   RETURNING id INTO v_tx_id;
128: 
129:   -- Insert detail rows
130:   INSERT INTO detail_transaksi_keluar (
131:     id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
132:     diskon_item, qty, jumlah, kas_masuk, profit, harga_pokok_satuan, total_harga_pokok
133:   )
134:   SELECT
135:     v_tx_id,
136:     (d->>'id_produk')::integer,
137:     d->>'type_harga_jual',
138:     (d->>'harga_modal')::numeric,
139:     (d->>'harga_jual')::numeric,
140:     (d->>'diskon_item')::numeric,
141:     (d->>'qty')::numeric,
142:     (d->>'jumlah')::numeric,
143:     (d->>'kas_masuk')::numeric,
144:     (d->>'profit')::numeric,
145:     (d->>'harga_pokok_satuan')::numeric,
146:     (d->>'total_harga_pokok')::numeric
147:   FROM unnest(v_details) AS d;
148: 
149:   -- Deduct stock where hitung_stok = true and record AVCO mutation
150:   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
151:   LOOP
152:     SELECT stok, harga_pokok_avco, nilai_persediaan
153:     INTO v_prod
154:     FROM produk
155:     WHERE id = (v_item->>'id_produk')::integer AND hitung_stok = true;
156: 
157:     IF FOUND THEN
158:       -- Record into riwayat_avco
159:       INSERT INTO riwayat_avco (
160:         id_produk, jenis_mutasi, id_referensi, qty_keluar,
161:         harga_satuan_transaksi, stok_sebelum, avco_sebelum,
162:         stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
163:       ) VALUES (
164:         (v_item->>'id_produk')::integer,
165:         'penjualan',
166:         v_tx_id,
167:         (v_item->>'qty')::numeric,
168:         v_prod.harga_pokok_avco,
169:         v_prod.stok,
170:         v_prod.harga_pokok_avco,
171:         v_prod.stok - (v_item->>'qty')::numeric,
172:         v_prod.harga_pokok_avco,
173:         (v_prod.stok - (v_item->>'qty')::numeric) * v_prod.harga_pokok_avco
174:       );
175: 
176:       -- Update product stock and inventory value
177:       UPDATE produk
178:       SET stok = stok - (v_item->>'qty')::numeric,
179:           nilai_persediaan = (stok - (v_item->>'qty')::numeric) * harga_pokok_avco
180:       WHERE id = (v_item->>'id_produk')::integer;
181:     END IF;
182:   END LOOP;
183: 
184:   RETURN jsonb_build_object(
185:     'success',       true,
186:     'id',            v_tx_id,
187:     'no_transaksi',  v_no_transaksi,
188:     'total',         v_total,
189:     'kembali',       v_kembali
190:   );
191: END;
192: $$;
193: 
194: GRANT EXECUTE ON FUNCTION process_checkout(jsonb, integer, integer, integer, numeric, numeric, numeric, boolean) TO authenticated;

(End of file - total 194 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.5s)

_Thinking:_

Now let me also check if there's a Supabase config file that lists the functions (RPCs) and if there are any other relevant files I might want to examine.

Let me also check the config and existing `database.MD` for the schema overview.

**Tool: glob**

**Input:**
```json
{
  "pattern": "supabase/config.*"
}
```

**Output:**
```
No files found
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "**/database.MD"
}
```

**Output:**
```
/home/haydar/Code/POS/app/database.MD
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "supabase/migrations/20260601000001_add_accounting_fields.sql"
}
```

**Output:**
```
/home/haydar/Code/POS/app/supabase/migrations/20260601000001_add_accounting_fields.sql
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 2.4s)

_Thinking:_

Let me read the database.MD for schema details and the accounting fields migration.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/database.MD"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/database.MD</path>
<type>file</type>
<content>
1: ## Table `kategori`
2: 
3: ### Columns
4: 
5: | Name | Type | Constraints |
6: |------|------|-------------|
7: | `id` | `int4` | Primary |
8: | `nama` | `varchar` |  Unique |
9: 
10: ## Table `satuan`
11: 
12: ### Columns
13: 
14: | Name | Type | Constraints |
15: |------|------|-------------|
16: | `id` | `int4` | Primary |
17: | `nama` | `varchar` |  Unique |
18: 
19: ## Table `metode_bayar`
20: 
21: ### Columns
22: 
23: | Name | Type | Constraints |
24: |------|------|-------------|
25: | `id` | `int4` | Primary |
26: | `nama` | `varchar` |  Unique |
27: 
28: ## Table `pengguna`
29: 
30: ### Columns
31: 
32: | Name | Type | Constraints |
33: |------|------|-------------|
34: | `id` | `int4` | Primary |
35: | `username` | `varchar` |  Unique |
36: | `password` | `varchar` |  |
37: | `level` | `varchar` |  |
38: | `aktif` | `bool` |  |
39: | `created_at` | `timestamp` |  |
40: | `nama` | `text` |  Nullable |
41: 
42: ## Table `supplier`
43: 
44: ### Columns
45: 
46: | Name | Type | Constraints |
47: |------|------|-------------|
48: | `id` | `int4` | Primary |
49: | `nama_supplier` | `varchar` |  |
50: | `alamat` | `text` |  Nullable |
51: | `telepon` | `varchar` |  Nullable |
52: | `email` | `varchar` |  Nullable |
53: | `keterangan` | `text` |  Nullable |
54: | `created_at` | `timestamp` |  |
55: 
56: ## Table `pelanggan`
57: 
58: ### Columns
59: 
60: | Name | Type | Constraints |
61: |------|------|-------------|
62: | `id` | `int4` | Primary |
63: | `nama_pelanggan` | `varchar` |  |
64: | `alamat` | `text` |  Nullable |
65: | `no_hp` | `varchar` |  Nullable |
66: | `email` | `varchar` |  Nullable |
67: | `keterangan` | `text` |  Nullable |
68: | `created_at` | `timestamp` |  |
69: 
70: ## Table `produk`
71: 
72: ### Columns
73: 
74: | Name | Type | Constraints |
75: |------|------|-------------|
76: | `id` | `int4` | Primary |
77: | `nama_produk` | `varchar` |  Unique |
78: | `id_kategori` | `int4` |  Nullable |
79: | `id_satuan` | `int4` |  Nullable |
80: | `hitung_stok` | `bool` |  |
81: | `harga_modal` | `numeric` |  |
82: | `harga_jual_satuan` | `numeric` |  |
83: | `harga_jual_grosir` | `numeric` |  Nullable |
84: | `harga_jual_promo` | `numeric` |  Nullable |
85: | `diskon` | `numeric` |  |
86: | `created_at` | `timestamp` |  |
87: | `updated_at` | `timestamp` |  |
88: | `stok_minimum` | `int4` |  |
89: | `barcode` | `text` |  Nullable Unique |
90: | `stok` | `numeric` |  Nullable |
91: | `harga_pokok_avco` | `numeric` |  Nullable |
92: | `nilai_persediaan` | `numeric` |  Nullable |
93: 
94: ## Table `transaksi_keluar`
95: 
96: ### Columns
97: 
98: | Name | Type | Constraints |
99: |------|------|-------------|
100: | `id` | `int4` | Primary |
101: | `no_transaksi` | `int8` |  Unique |
102: | `tgl_transaksi` | `timestamp` |  |
103: | `id_kasir` | `int4` |  |
104: | `id_pelanggan` | `int4` |  Nullable |
105: | `id_metode_bayar` | `int4` |  Nullable |
106: | `subtotal` | `numeric` |  |
107: | `diskon_persen` | `numeric` |  |
108: | `diskon_nominal` | `numeric` |  |
109: | `pajak_persen` | `numeric` |  |
110: | `pajak_nominal` | `numeric` |  |
111: | `total` | `numeric` |  |
112: | `bayar` | `numeric` |  |
113: | `kembali` | `numeric` |  |
114: | `dp` | `numeric` |  |
115: | `sisa` | `numeric` |  |
116: | `created_at` | `timestamp` |  |
117: | `total_hpp` | `numeric` |  Nullable |
118: | `laba_kotor` | `numeric` |  Nullable |
119: 
120: ## Table `detail_transaksi_keluar`
121: 
122: ### Columns
123: 
124: | Name | Type | Constraints |
125: |------|------|-------------|
126: | `id` | `int4` | Primary |
127: | `id_transaksi` | `int4` |  |
128: | `id_produk` | `int4` |  |
129: | `type_harga_jual` | `varchar` |  Nullable |
130: | `harga_modal` | `numeric` |  |
131: | `harga_jual` | `numeric` |  |
132: | `diskon_item` | `numeric` |  |
133: | `qty` | `numeric` |  |
134: | `jumlah` | `numeric` |  |
135: | `kas_masuk` | `numeric` |  |
136: | `profit` | `numeric` |  |
137: | `harga_pokok_satuan` | `numeric` |  Nullable |
138: | `total_harga_pokok` | `numeric` |  Nullable |
139: 
140: ## Table `barang_masuk`
141: 
142: ### Columns
143: 
144: | Name | Type | Constraints |
145: |------|------|-------------|
146: | `id` | `int4` | Primary |
147: | `tgl_masuk` | `date` |  |
148: | `id_supplier` | `int4` |  Nullable |
149: | `id_produk` | `int4` |  |
150: | `harga_beli` | `numeric` |  |
151: | `jumlah` | `numeric` |  |
152: | `total` | `numeric` |  |
153: | `created_at` | `timestamp` |  |
154: | `keterangan` | `text` |  Nullable |
155: 
156: ## Table `stok_opname`
157: 
158: ### Columns
159: 
160: | Name | Type | Constraints |
161: |------|------|-------------|
162: | `id` | `int4` | Primary |
163: | `tgl_opname` | `date` |  |
164: | `id_produk` | `int4` |  |
165: | `stok_sistem` | `numeric` |  |
166: | `stok_fisik` | `numeric` |  |
167: | `selisih` | `numeric` |  |
168: | `keterangan` | `text` |  Nullable |
169: | `created_at` | `timestamp` |  |
170: 
171: ## Table `pengaturan`
172: 
173: ### Columns
174: 
175: | Name | Type | Constraints |
176: |------|------|-------------|
177: | `id` | `int4` | Primary |
178: | `nama_toko` | `varchar` |  Nullable |
179: | `alamat` | `text` |  Nullable |
180: | `telepon` | `varchar` |  Nullable |
181: | `email` | `varchar` |  Nullable |
182: | `nama_kasir_aktif` | `varchar` |  Nullable |
183: | `metode_diskon` | `varchar` |  Nullable |
184: | `bank1_nama` | `varchar` |  Nullable |
185: | `bank1_rekening` | `varchar` |  Nullable |
186: | `bank1_atas_nama` | `varchar` |  Nullable |
187: | `bank2_nama` | `varchar` |  Nullable |
188: | `bank2_rekening` | `varchar` |  Nullable |
189: | `bank2_atas_nama` | `varchar` |  Nullable |
190: | `footer_struk_1` | `varchar` |  Nullable |
191: | `footer_struk_2` | `varchar` |  Nullable |
192: | `footer_struk_3` | `varchar` |  Nullable |
193: | `footer_invoice_1` | `varchar` |  Nullable |
194: | `footer_invoice_2` | `varchar` |  Nullable |
195: | `footer_invoice_3` | `varchar` |  Nullable |
196: | `updated_at` | `timestamp` |  |
197: | `pajak_persen` | `numeric` |  Nullable |
198: | `jenis_nota` | `text` |  Nullable |
199: | `metode_cetak` | `text` |  Nullable |
200: | `logo_nota` | `bool` |  Nullable |
201: | `hormat_kami_nama` | `text` |  Nullable |
202: 
203: ## Table `absensi`
204: 
205: ### Columns
206: 
207: | Name | Type | Constraints |
208: |------|------|-------------|
209: | `id` | `int8` | Primary |
210: | `id_pengguna` | `int4` |  |
211: | `tanggal` | `date` |  |
212: | `jam_masuk` | `timestamp` |  Nullable |
213: | `jam_pulang` | `timestamp` |  Nullable |
214: | `status` | `varchar` |  |
215: | `telat_menit` | `int4` |  Nullable |
216: | `latitude` | `numeric` |  Nullable |
217: | `longitude` | `numeric` |  Nullable |
218: | `foto_masuk` | `text` |  Nullable |
219: | `foto_pulang` | `text` |  Nullable |
220: | `device_info` | `text` |  Nullable |
221: | `created_at` | `timestamp` |  Nullable |
222: 
223: ## Table `qr_session`
224: 
225: ### Columns
226: 
227: | Name | Type | Constraints |
228: |------|------|-------------|
229: | `id` | `int8` | Primary |
230: | `token` | `text` |  Unique |
231: | `expired_at` | `timestamptz` |  |
232: | `is_active` | `bool` |  Nullable |
233: | `created_by` | `int4` |  Nullable |
234: | `created_at` | `timestamp` |  Nullable |
235: 
236: ## Table `hutang_dagang`
237: 
238: ### Columns
239: 
240: | Name | Type | Constraints |
241: |------|------|-------------|
242: | `id` | `uuid` | Primary |
243: | `id_barang_masuk` | `int4` |  Nullable |
244: | `id_supplier` | `int4` |  |
245: | `tanggal_hutang` | `date` |  |
246: | `tanggal_jatuh_tempo` | `date` |  Nullable |
247: | `jumlah_awal` | `numeric` |  |
248: | `jumlah_terbayar` | `numeric` |  |
249: | `sisa_hutang` | `numeric` |  Nullable |
250: | `status` | `text` |  |
251: | `catatan` | `text` |  Nullable |
252: | `created_at` | `timestamptz` |  Nullable |
253: | `updated_at` | `timestamptz` |  Nullable |
254: 
255: ## Table `pembayaran_hutang`
256: 
257: ### Columns
258: 
259: | Name | Type | Constraints |
260: |------|------|-------------|
261: | `id` | `uuid` | Primary |
262: | `id_hutang` | `uuid` |  |
263: | `tanggal_bayar` | `date` |  |
264: | `jumlah_bayar` | `numeric` |  |
265: | `metode_bayar` | `text` |  |
266: | `bukti_bayar` | `text` |  Nullable |
267: | `id_pengguna` | `int4` |  |
268: | `catatan` | `text` |  Nullable |
269: | `created_at` | `timestamptz` |  Nullable |
270: 
271: ## Table `piutang_dagang`
272: 
273: ### Columns
274: 
275: | Name | Type | Constraints |
276: |------|------|-------------|
277: | `id` | `uuid` | Primary |
278: | `id_transaksi_keluar` | `int4` |  Nullable |
279: | `id_pelanggan` | `int4` |  |
280: | `tanggal_piutang` | `date` |  |
281: | `tanggal_jatuh_tempo` | `date` |  Nullable |
282: | `jumlah_awal` | `numeric` |  |
283: | `jumlah_terbayar` | `numeric` |  |
284: | `sisa_piutang` | `numeric` |  Nullable |
285: | `status` | `text` |  |
286: | `catatan` | `text` |  Nullable |
287: | `created_at` | `timestamptz` |  Nullable |
288: | `updated_at` | `timestamptz` |  Nullable |
289: 
290: ## Table `pembayaran_piutang`
291: 
292: ### Columns
293: 
294: | Name | Type | Constraints |
295: |------|------|-------------|
296: | `id` | `uuid` | Primary |
297: | `id_piutang` | `uuid` |  |
298: | `tanggal_bayar` | `date` |  |
299: | `jumlah_bayar` | `numeric` |  |
300: | `metode_bayar` | `text` |  |
301: | `id_pengguna` | `int4` |  |
302: | `catatan` | `text` |  Nullable |
303: | `created_at` | `timestamptz` |  Nullable |
304: 
305: ## Table `riwayat_avco`
306: 
307: ### Columns
308: 
309: | Name | Type | Constraints |
310: |------|------|-------------|
311: | `id` | `uuid` | Primary |
312: | `id_produk` | `int4` |  |
313: | `tanggal` | `timestamptz` |  |
314: | `jenis_mutasi` | `text` |  |
315: | `id_referensi` | `int4` |  Nullable |
316: | `qty_masuk` | `numeric` |  Nullable |
317: | `qty_keluar` | `numeric` |  Nullable |
318: | `harga_satuan_transaksi` | `numeric` |  Nullable |
319: | `stok_sebelum` | `numeric` |  |
320: | `avco_sebelum` | `numeric` |  |
321: | `stok_sesudah` | `numeric` |  |
322: | `avco_sesudah` | `numeric` |  |
323: | `nilai_persediaan_sesudah` | `numeric` |  |
324: 
325: ## Table `saldo_kas_harian`
326: 
327: ### Columns
328: 
329: | Name | Type | Constraints |
330: |------|------|-------------|
331: | `id` | `uuid` | Primary |
332: | `tanggal` | `date` |  Unique |
333: | `saldo_awal` | `numeric` |  |
334: | `total_masuk` | `numeric` |  |
335: | `total_keluar` | `numeric` |  |
336: | `saldo_akhir` | `numeric` |  Nullable |
337: | `uang_aktual` | `numeric` |  Nullable |
338: | `selisih` | `numeric` |  Nullable |
339: | `dikonfirmasi` | `bool` |  Nullable |
340: | `id_pengguna` | `int4` |  Nullable |
341: | `created_at` | `timestamptz` |  Nullable |
342: 
343: ## Table `pengaturan_keuangan`
344: 
345: ### Columns
346: 
347: | Name | Type | Constraints |
348: |------|------|-------------|
349: | `id` | `uuid` | Primary |
350: | `modal_awal` | `numeric` |  |
351: | `tanggal_mulai` | `date` |  |
352: | `nama_pemilik` | `text` |  Nullable |
353: | `npwp` | `text` |  Nullable |
354: | `updated_at` | `timestamptz` |  Nullable |
355: 

(End of file - total 355 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260601000001_add_accounting_fields.sql"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/supabase/migrations/20260601000001_add_accounting_fields.sql</path>
<type>file</type>
<content>
1: -- File: 20260601000001_add_accounting_fields.sql
2: 
3: -- Tambah kolom HPP ke detail transaksi yang sudah ada
4: ALTER TABLE detail_transaksi_keluar
5:   ADD COLUMN harga_pokok_satuan NUMERIC(15,2) DEFAULT 0,
6:   ADD COLUMN total_harga_pokok  NUMERIC(15,2) DEFAULT 0;
7: 
8: ALTER TABLE transaksi_keluar
9:   ADD COLUMN total_hpp    NUMERIC(15,2) DEFAULT 0,
10:   ADD COLUMN laba_kotor   NUMERIC(15,2) DEFAULT 0;
11: 
12: -- Tambah kolom AVCO ke tabel produk
13: ALTER TABLE produk
14:   ADD COLUMN harga_pokok_avco    NUMERIC(15,2) DEFAULT 0,
15:   ADD COLUMN nilai_persediaan    NUMERIC(15,2) DEFAULT 0;

(End of file - total 15 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 685.0s)

_Thinking:_

Now I have a comprehensive understanding of the existing architecture. Let me analyze what needs to be done:

## Current State
The Barang Masuk feature already exists with:
1. `barang_masuk` table (for recording incoming stock)
2. `riwayat_avco` table (AVCO history tracking)
3. `produk` table has `harga_pokok_avco`, `nilai_persediaan`, `stok_gudang` columns
4. `app/dashboard/inventory/stock-in/` - Complete UI with:
   - `page.tsx` (server component that fetches products/suppliers)
   - `stock-in-client.tsx` (client component with multi-row form)
   - `actions.ts` (server action with `addStockIn`)
5. `lib/avco.ts` - AVCO calculation engine:
   - `calculateNewAVCO()` - pure function for WAC calculation
   - `recordAVCOMutation()` - handles AVCO mutation with DB updates
6. `lib/hutang.ts` - Accounts payable handling

## What the user is asking
The user wants this feature to be implemented. They mention:
1. WAC calculation - Already handled in `lib/avco.ts`
2. Atomic/Concurrency handling via RPC - This is the KEY gap! The current `addStockIn` action does NOT use any locking mechanism. It's vulnerable to race conditions.
3. The column type for `average_cost` should be `numeric` - Already `numeric(15,2)` for `harga_pokok_avco`
4. React Hook Form + Zod - The current form uses manual state management, not RHF/Zod

## Key Issues to Address

### 1. Concurrency / Race Condition
The user specifically mentions:
> "Since a sale could happen at the exact same millisecond the stock is received, you must use a Supabase RPC (PostgreSQL function) or a strict database transaction to lock the row, calculate the new WAC, and update the stock safely."

The current implementation in `actions.ts` does:
1. Inserts into `barang_masuk`
2. For each row, calls `recordAVCOMutation()` which:
   - Reads current product data
   - Calculates new AVCO
   - Inserts `riwayat_avco`
   - Updates `produk`

This is 3 sequential JS-land operations per product. If a sale happens between these steps, we get a race condition. The solution is to create a Supabase RPC function similar to `process_checkout` that uses `pg_advisory_xact_lock` for atomicity.

### 2. Use React Hook Form + Zod
The current form uses custom state management with `useState`. The user asked for React Hook Form + Zod. However, the form has dynamic rows (add/remove) which makes RHF more complex.

Let me think about what the plan should cover:

---

## Plan

### 1. Database Migration - Create RPC Function
Create a new migration file that creates a `process_barang_masuk` RPC function that:
- Uses `pg_advisory_xact_lock` for concurrency control (or a per-product lock)
- Accepts all the data as a JSONB parameter
- Within a single transaction:
  1. Insert into `barang_masuk`
  2. For each item, calculate WAC and update `produk` (stock, avco, nilai_persediaan)
  3. Insert into `riwayat_avco`
- Returns the inserted rows with IDs
- Handles hutang_dagang creation if paymentType = Kredit

### 2. Update Server Action
Modify `actions.ts` to:
- Call the new `process_barang_masuk` RPC instead of doing manual sequential operations
- Handle hutang creation separately (or within the RPC)

### 3. Update UI/Form
The form actually looks fine. The user mentioned "React Hook Form and Zod" but the current form works well for multi-row dynamic data. I should consider:
- Should I refactor to use RHF + Zod? This would be complex with dynamic rows.
- Alternative: Add Zod validation schema on the server action for data validation.

Actually, re-reading the user's instruction more carefully:

> "UI Requirement: All forms and notifications must be in Bahasa Indonesia."

The current UI is already in Bahasa Indonesia. 

> "Provide a detailed, step-by-step technical plan covering:
> 1. Necessary database migrations (if adjusting column types or creating the RPC).
> 2. The Server Action / API Route implementation.
> 3. The UI/Form component structure using React Hook Form and Zod."

So they want RHF + Zod in the plan. But the current form is complex with dynamic rows... Let me think about this.

Actually, the existing implementation might be fine as-is for the basic functionality, but it's missing the atomicity/concurrency protection. The user's primary concerns are:
1. Atomic WAC calculation (use RPC, not JS)
2. Concurrency handling
3. RHF + Zod for form handling

Let me also check if the `harga_pokok_avco` column type is already `numeric` (it is - `numeric(15,2)`).

Now let me formulate a clear plan.

Actually, I also need to think about whether the user wants me to:
- Keep the existing files and just add what's missing
- Or rewrite entirely with a new approach

Given the brief says "DO NOT write the code immediately. First, provide a detailed, step-by-step technical plan... Wait for my approval on the plan before writing any code", I should present a comprehensive plan.

Let me think about what the right approach is:

### Key concern: Security/Concurrency
The user says:
> "All monetary values must be processed securely on the server/database layer."

The `recordAVCOMutation` function in `lib/avco.ts` is called from the server action which is server-side, but it does 3 separate DB round-trips:
1. SELECT from produk
2. INSERT into riwayat_avco
3. UPDATE produk

These are NOT atomic. If `process_checkout` (which also does SELECT + UPDATE on produk) runs between steps 1 and 3, we get a race condition.

The fix: Create a `process_barang_masuk` RPC similar to `process_checkout` that does everything in one transaction (implicit in PL/pgSQL function) with advisory locking.

### Plan Structure

Here's my plan outline:

#### Step 1: Database Migration (Create RPC)
- Create `supabase/migrations/20260710_process_barang_masuk.sql`
- Create `process_barang_masuk` function that:
  - Takes `p_items JSONB` (array of {id_produk, jumlah, harga_beli, total, keterangan, tgl_masuk, id_supplier})
  - Uses `pg_advisory_xact_lock(987654322)` (different lock ID from checkout)
  - In a single transaction:
    - For each item, lock the produk row
    - Calculate new WAC: `((stok + stok_gudang) * harga_pokok_avco + jumlah * harga_beli) / (stok + stok_gudang + jumlah)`
    - Update `stok_gudang`, `harga_pokok_avco`, `nilai_persediaan`
    - Insert into `riwayat_avco`
    - Collect inserted IDs
  - Returns JSONB with inserted barang_masuk IDs

#### Step 2: Update Server Action
- Modify `app/dashboard/inventory/stock-in/actions.ts`:
  - Instead of `supabase.from("barang_masuk").insert(...)` + loop calling `recordAVCOMutation()`, call `supabase.rpc("process_barang_masuk", { p_items: ..., p_payment_type: ..., p_tanggal_jatuh_tempo: ... })`
  - If paymentType is Kredit, still create hutang via RPC or via `lib/hutang.ts`

Actually, let me think more carefully. Should hutang creation be inside the RPC too? If we want full atomicity, yes. But the current approach does hutang separately, and it's acceptable since if hutang creation fails, the goods are already received (which is the existing behavior). For simplicity, we could keep hutang in JS land and only put the AVCO/stock update in the RPC.

#### Step 3: UI/Form with React Hook Form + Zod
- Refactor `stock-in-client.tsx` to use `react-hook-form` with `useFieldArray` for dynamic rows
- Create a Zod schema for validation
- Keep the same visual design but with RHF integration

Actually, the user said to wait for approval. Let me present the plan.

Let me also double-check: does the user want a complete rewrite or just the missing parts?

Looking at the task again:
- "We need to implement the 'Incoming Stock' (Barang Masuk) feature"
- "DO NOT write the code immediately"
- "First, provide a detailed, step-by-step technical plan"

The feature actually exists but is incomplete (missing atomicity/concurrency protection). The user wants me to assess, plan, and then implement with proper WAC handling.

Let me write a comprehensive plan now.

Now I have a thorough understanding of the codebase. Here is my detailed plan.

---

## Technical Plan: Barang Masuk (Incoming Inventory) with WAC

### Current State Assessment

The Barang Masuk feature exists but has **a critical race condition**:

| Aspect | Current | Issue |
|--------|---------|-------|
| `barang_masuk` table | ✅ Exists | — |
| `produk` columns (`harga_pokok_avco`, `stok_gudang`, `nilai_persediaan`) | ✅ Exists as `numeric` | — |
| `riwayat_avco` table | ✅ Exists | — |
| WAC formula (`lib/avco.ts`) | ✅ Correct | — |
| **Atomicity** | ❌ **3 round-trips** per product: `SELECT → INSERT riwayat → UPDATE produk` | **Race condition**: a `process_checkout` sale can interleave between these steps |
| Server action pattern | ❌ Sequential JS loops | Should use RPC |
| Form validation | ❌ `useState` + manual checks | Should use RHF + Zod |

---

### Step 1 — Database Migration: Create `process_barang_masuk` RPC

**File:** `supabase/migrations/20260710_process_barang_masuk.sql`

Create a `SECURITY DEFINER` PL/pgSQL function that atomically:
1. Acquires a `pg_advisory_xact_lock(987654322)` (separate lock from checkout's `987654321`)
2. Iterates over `p_items JSONB` and for each item:
   - Reads the current `produk` row (`stok`, `stok_gudang`, `harga_pokok_avco`, `nilai_persediaan`)
   - Computes: `total_stok = stok + stok_gudang`, `current_value = total_stok * avco`, `incoming_value = jumlah * harga_beli`, `new_avco = (current_value + incoming_value) / (total_stok + jumlah)`
   - Inserts into `barang_masuk` (returns `id` via `INSERT ... RETURNING id`)
   - Inserts into `riwayat_avco` with `stok_sebelum`, `avco_sebelum`, `stok_sesudah`, `avco_sesudah`, `nilai_persediaan_sesudah`
   - Updates `produk` (`stok_gudang += jumlah`, `harga_pokok_avco = new_avco`, `nilai_persediaan = new_value`)
3. Returns `JSONB` with array of `{barang_masuk_id, id_produk, jumlah, harga_beli}`

**Parameters:**
- `p_items JSONB` — the rows array
- `p_supplier_id INTEGER` (nullable)

**Why advisory lock?** Matches the pattern in `process_checkout`. Lock ID `987654322` is distinct so stock-in and checkout don't block each other — but stock-in and another stock-in for the same product are serialized.

---

### Step 2 — Migration (if needed): Fix `harga_pokok_avco` column type

The column is already `numeric(15,2)`. If you want unrounded precision in the DB (as the brief states: *"Do not round numbers during database insertion; rounding should only occur on the UI level"*), alter it:

```sql
ALTER TABLE produk ALTER COLUMN harga_pokok_avco TYPE numeric;
```

This removes the `(15,2)` scale constraint so the DB stores full precision.

Similarly for `nilai_persediaan` and `riwayat_avco` columns — change from `numeric(15,2)` to `numeric`.

---

### Step 3 — Update Server Action (`app/dashboard/inventory/stock-in/actions.ts`)

Replace the current implementation:

```
BEFORE:                    AFTER:
supabase                   supabase.rpc(
  .from("barang_masuk")      "process_barang_masuk",
  .insert(rows)              { p_items, p_supplier_id }
  .select()                )
  ↓                        ↓
for each row:              returns [{id, id_produk, jumlah, harga_beli}]
  recordAVCOMutation()     ↓
  ↓                        hutang creation (unchanged)
hutang creation
```

Key changes:
- **No more `lib/avco.ts` calls** — the DB handles the WAC atomically
- The function returns the inserted IDs so `createHutang` still has `id_barang_masuk`
- Add Zod validation for the input payload

---

### Step 4 — Rewrite UI with React Hook Form + Zod (`stock-in-client.tsx`)

Use `react-hook-form` + `useFieldArray` for dynamic rows:

**Zod Schema:**
```ts
const stockInRowSchema = z.object({
  id_produk: z.number({ required_error: "Produk harus dipilih" }),
  jumlah: z.number().positive("Jumlah harus > 0"),
  harga_beli: z.number().positive("Harga beli harus > 0"),
  keterangan: z.string().optional(),
});

const stockInFormSchema = z.object({
  id_supplier: z.number({ required_error: "Supplier harus dipilih" }),
  tgl_masuk: z.string(),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(stockInRowSchema).min(1, "Minimal 1 item"),
});
```

**Component structure:**
- Wrap in `<Form>` from shadcn/ui (based on RHF)
- Supplier/Date/Payment header fields with `<FormField>`
- Table body with `<FormField>` + `useFieldArray` for items
- ProductSearchCombobox extracted into its own controlled component
- Submit calls the updated `addStockIn` server action

---

### Step 5 — Files to Modify/Create

| File | Action | Reason |
|------|--------|--------|
| `supabase/migrations/20260710_process_barang_masuk.sql` | **Create** | New RPC function |
| (optional) additional migration to widen `numeric` columns | **Create** | If you want unrounded precision |
| `app/dashboard/inventory/stock-in/actions.ts` | **Rewrite** | Call RPC instead of sequential JS |
| `app/dashboard/inventory/stock-in/stock-in-client.tsx` | **Rewrite** | RHF + Zod + `useFieldArray` |
| `app/dashboard/inventory/stock-in/page.tsx` | **Minor update** | Add `harga_pokok_avco` to product select for display |

No changes needed to `lib/avco.ts` or `lib/hutang.ts` — they remain available for other mutation types (stock opname, corrections, etc.).

---

**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "question": "Does this plan look good to you? Any changes or clarifications before I proceed?",
      "header": "Plan Approval",
      "options": [
        {
          "label": "Approve — proceed with implementation",
          "description": "The plan looks correct, implement all 5 steps"
        },
        {
          "label": "Approve — skip RHF/Zod refactor",
          "description": "Keep the existing form UI as-is, only fix the atomicity/concurrency issue with the RPC"
        },
        {
          "label": "Approve — non-atomic approach",
          "description": "Skip the RPC; instead wrap the current JS logic in a Supabase transaction only (simpler but not as safe)"
        },
        {
          "label": "Need changes — discuss",
          "description": "I have specific changes or questions about the plan"
        }
      ]
    }
  ]
}
```

**Output:**
```
User has answered your questions: "Does this plan look good to you? Any changes or clarifications before I proceed?"="i will notify you when i finish read that plan". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 4.2s)

_Thinking:_

The user said "i will notify you when i finish read that plan" - meaning they need time to read the plan. I should acknowledge and wait.

Understood. Take your time reading the plan. I'll wait for your signal to proceed.

One thing worth noting: if you'd like me to also read the existing `stock-in/history/` files to factor them into the plan, let me know — otherwise the plan above is ready to execute once you give the green light.

---

## User

okay do that plan, do it carefully without error and inform me step by step to test it in the app

---

## Assistant (Build · DeepSeek V4 Flash Free · 5.6s)

_Thinking:_

The user has approved the plan. Let me now carefully implement it step by step.

Let me break this into concrete tasks and execute them:

1. Create the migration for `process_barang_masuk` RPC
2. Optionally create migration to widen numeric columns
3. Update `actions.ts` to use the RPC
4. Rewrite `stock-in-client.tsx` with RHF + Zod
5. Update `page.tsx` minimally

Let me start by creating a todo list and then executing step by step.

First, let me also check the existing stock-in history files and the existing Supabase config to understand if there's any relevant configuration.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "pending",
      "priority": "medium"
    },
    {
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Update server page (`page.tsx`) if needed",
      "status": "pending",
      "priority": "medium"
    },
    {
      "content": "Final review: verify all files compile and types are correct",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile and types are correct",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 57.2s)

_Thinking:_

Now let me start implementing. Let me begin with:

1. The migration file for the `process_barang_masuk` RPC
2. The migration file for widening numeric columns

Let me think carefully about the RPC function.

The RPC function needs to:
1. Accept `p_items JSONB` (array of items) and `p_supplier_id INTEGER`
2. Use advisory lock `pg_advisory_xact_lock(987654322)`
3. For each item:
   a. Insert into `barang_masuk` and get the ID
   b. Get current product data
   c. Calculate new WAC
   d. Insert into `riwayat_avco`
   e. Update `produk`
4. Return JSONB with the inserted rows

Let me write this carefully.

The items array looks like:
```json
[
  {
    "id_produk": 1,
    "jumlah": 10,
    "harga_beli": 5000,
    "total": 50000,
    "tgl_masuk": "2026-07-10",
    "id_supplier": 1,
    "keterangan": "optional note"
  }
]
```

The `id_supplier` is the same for all items in a batch, so it should be a parameter, but it could also be per-item. Looking at the current code, `id_supplier` is the same for all rows in one submission, so let's make it a function parameter.

Wait, but the current `addStockIn` accepts rows where each row has `id_supplier`. So it's potentially different per row. Let me keep it as per-item in the p_items.

Actually, looking at the UI code, it's always the same supplier per batch. Let me keep it as a function parameter for simplicity, but allow it in each item too for flexibility. Actually, let's just pass it in each item to be safe.

Let me look at the `barang_masuk` table schema again:
- `id` (int4 PK)
- `tgl_masuk` (date)
- `id_supplier` (int4, nullable)
- `id_produk` (int4)
- `harga_beli` (numeric)
- `jumlah` (numeric)
- `total` (numeric)
- `created_at` (timestamp)
- `keterangan` (text, nullable)

So `id_supplier` is nullable per-row. Let me keep it per-item.

Now for the RPC:

```sql
CREATE OR REPLACE FUNCTION process_barang_masuk(
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_barang_masuk_id INTEGER;
  v_prod RECORD;
  v_total_stok NUMERIC;
  v_nilai_sekarang NUMERIC;
  v_nilai_masuk NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_new_stok_gudang NUMERIC;
  v_results JSONB[] := '{}';
BEGIN
  -- Serialize concurrent calls
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 1. Insert into barang_masuk
    INSERT INTO barang_masuk (
      tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan
    ) VALUES (
      (v_item->>'tgl_masuk')::date,
      (v_item->>'id_supplier')::integer,
      (v_item->>'id_produk')::integer,
      (v_item->>'harga_beli')::numeric,
      (v_item->>'jumlah')::numeric,
      (v_item->>'total')::numeric,
      COALESCE(v_item->>'keterangan', NULL)
    )
    RETURNING id INTO v_barang_masuk_id;

    -- 2. Get current product data (lock the row for update)
    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- 3. Calculate WAC
    v_total_stok := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
    v_nilai_sekarang := v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0);
    v_nilai_masuk := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;
    v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;
    
    IF v_total_stok + (v_item->>'jumlah')::numeric > 0 THEN
      v_new_avco := (v_nilai_sekarang + v_nilai_masuk) / (v_total_stok + (v_item->>'jumlah')::numeric);
    ELSE
      v_new_avco := 0;
    END IF;
    
    v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;

    -- 4. Insert into riwayat_avco
    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi,
      qty_masuk, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      (v_item->>'id_produk')::integer,
      'pembelian',
      v_barang_masuk_id,
      (v_item->>'jumlah')::numeric,
      (v_item->>'harga_beli')::numeric,
      v_total_stok,
      COALESCE(v_prod.harga_pokok_avco, 0),
      v_total_stok + (v_item->>'jumlah')::numeric,
      v_new_avco,
      v_new_nilai_persediaan
    );

    -- 5. Update produk
    UPDATE produk
    SET
      stok_gudang = v_new_stok_gudang,
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai_persediaan
    WHERE id = (v_item->>'id_produk')::integer;

    -- 6. Collect result
    v_results := v_results || jsonb_build_object(
      'id', v_barang_masuk_id,
      'id_produk', (v_item->>'id_produk')::integer,
      'jumlah', (v_item->>'jumlah')::numeric,
      'harga_beli', (v_item->>'harga_beli')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', to_jsonb(v_results));
END;
$$;

GRANT EXECUTE ON FUNCTION process_barang_masuk(JSONB) TO authenticated;
```

Now for the second migration - widening numeric columns. Let me check which columns need to be widened:

1. `produk.harga_pokok_avco` - currently `numeric(15,2)` → `numeric`
2. `produk.nilai_persediaan` - currently `numeric(15,2)` → `numeric`
3. `riwayat_avco.harga_satuan_transaksi` - currently `numeric(15,2)` → `numeric`
4. `riwayat_avco.avco_sebelum` - currently `numeric(15,2)` → `numeric`
5. `riwayat_avco.avco_sesudah` - currently `numeric(15,2)` → `numeric`
6. `riwayat_avco.nilai_persediaan_sesudah` - currently `numeric(15,2)` → `numeric`
7. `barang_masuk.harga_beli` - currently `numeric` (no precision/scale) - already fine
8. `barang_masuk.total` - currently `numeric` - already fine

Wait, let me check the actual column types from the migrations. In `20260601000003_create_avco_tracking.sql`:
- `harga_satuan_transaksi NUMERIC(15,2)` → widen
- `avco_sebelum NUMERIC(15,2)` → widen
- `avco_sesudah NUMERIC(15,2)` → widen
- `nilai_persediaan_sesudah NUMERIC(15,2)` → widen

In `20260601000001_add_accounting_fields.sql`:
- `harga_pokok_avco NUMERIC(15,2)` → widen
- `nilai_persediaan NUMERIC(15,2)` → widen

In the initial schema, `barang_masuk.harga_beli` and `barang_masuk.total` are just `numeric` (no constraint) - already fine.

OK, so the migration would be:

```sql
ALTER TABLE produk ALTER COLUMN harga_pokok_avco TYPE numeric;
ALTER TABLE produk ALTER COLUMN nilai_persediaan TYPE numeric;

ALTER TABLE riwayat_avco ALTER COLUMN harga_satuan_transaksi TYPE numeric;
ALTER TABLE riwayat_avco ALTER COLUMN avco_sebelum TYPE numeric;
ALTER TABLE riwayat_avco ALTER COLUMN avco_sesudah TYPE numeric;
ALTER TABLE riwayat_avco ALTER COLUMN nilai_persediaan_sesudah TYPE numeric;
```

Now for the server action rewrite. Let me think about the new `actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stockInRowSchema = z.object({
  id_produk: z.number().int().positive(),
  jumlah: z.number().positive(),
  harga_beli: z.number().positive(),
  total: z.number().nonnegative(),
  tgl_masuk: z.string(),
  id_supplier: z.number().int().positive(),
  keterangan: z.string().optional(),
});

const stockInSchema = z.object({
  rows: z.array(stockInRowSchema).min(1),
  paymentType: z.enum(["Tunai", "Kredit"]).optional(),
  tanggalJatuhTempo: z.string().nullable().optional(),
});

export async function addStockIn(
  rows: z.infer<typeof stockInRowSchema>[],
  paymentType?: "Tunai" | "Kredit",
  tanggalJatuhTempo?: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Validate
  const parsed = stockInSchema.safeParse({ rows, paymentType, tanggalJatuhTempo });
  if (!parsed.success) {
    return { error: parsed.error.errors.map(e => e.message).join(", ") };
  }

  // Call RPC
  const { data: result, error } = await supabase.rpc("process_barang_masuk", {
    p_items: rows.map(r => ({
      id_produk: r.id_produk,
      jumlah: r.jumlah,
      harga_beli: r.harga_beli,
      total: r.total,
      tgl_masuk: r.tgl_masuk,
      id_supplier: r.id_supplier,
      keterangan: r.keterangan || null,
    })),
  });

  if (error) return { error: error.message };

  // Handle hutang creation
  const inserted = result?.inserted;
  if (inserted && inserted.length > 0 && paymentType === "Kredit") {
    const { createHutang } = await import("@/lib/hutang");
    const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);
    const supplierId = rows[0].id_supplier;
    const tglMasuk = rows[0].tgl_masuk;

    try {
      await createHutang(supabase, {
        id_supplier: supplierId,
        id_barang_masuk: inserted[0].id,
        tanggal_hutang: tglMasuk,
        tanggal_jatuh_tempo: tanggalJatuhTempo || null,
        jumlah_awal: totalAmount,
        catatan: "Otomatis dari Barang Masuk",
      });
    } catch (err: any) {
      console.error("Failed to create hutang:", err);
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}
```

Now for the UI rewrite with React Hook Form + Zod. This is the most complex part. I need to rewrite `stock-in-client.tsx`.

The form has:
1. Header fields (supplier, date, payment type, due date)
2. Dynamic table with rows containing product search, quantity, price, total, notes
3. Add row / remove row
4. Submit button

For RHF with dynamic rows, I'll use `useFieldArray`.

Let me think about the component structure:

```tsx
// Form values type
interface StockInFormValues {
  id_supplier: string;
  tgl_masuk: string;
  paymentType: "Tunai" | "Kredit";
  tanggalJatuhTempo: string;
  items: {
    id_produk: number | null;
    nama_produk: string;
    barcode: string;
    satuan?: string;
    jumlah: number;
    harga_beli: number;
    keterangan: string;
  }[];
}
```

Actually, the current form has a custom ProductCombo component that manages its own state (search text, open/close, highlighting). This is tricky to integrate with RHF because the combobox has internal state that's not a simple controlled input.

Let me think about how to approach this...

For the product combobox, the cleanest approach is to use a controlled component that:
- Uses `watch` and `setValue` from RHF
- Stores the selected product ID in the form state
- Stores the display text (search) in local component state

The search text and dropdown state are local to the combobox (not in the form state), while the selected product ID is managed by RHF.

Let me design this:

```tsx
function ProductCombo({
  control,
  index,
  products,
}: {
  control: Control<StockInFormValues>;
  index: number;
  products: Product[];
}) {
  const { watch, setValue } = useFormContext<StockInFormValues>();
  // The form stores: items[index].id_produk (the selected product ID)
  // Local state: searchText, open, highlightIdx
  
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  
  const selectedProductId = watch(`items.${index}.id_produk`);
  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [selectedProductId, products]
  );
  
  // Initialize search text from selected product
  useEffect(() => {
    if (selectedProduct && !searchText) {
      setSearchText(selectedProduct.nama_produk);
    }
  }, [selectedProduct]);
  
  // ... rest of the combobox logic
}
```

Wait, this is getting complex. Let me think about whether I should use a simple `<Controller>` wrapper or the `useFormContext` approach.

Actually, let me reconsider the architecture. The simplest approach that works well with RHF and `useFieldArray`:

1. Use `FormProvider` / `useFormContext` at the top level
2. Each row in the table gets values from `useFormContext().watch` and sets via `setValue`
3. The `ProductCombo` is a controlled component that updates the form value

Let me code this up now. I'll be careful about:
- TypeScript types
- Shadcn Form components
- The product combobox integration
- Proper validation feedback

Let me write the migration files first, then the action, then the client.

Actually, I want to double check one thing - the `satuan` relation. Looking at the page.tsx, it selects `satuan(id, nama)` which is a foreign key from `produk.id_satuan` to `satuan.id`. This is used to display the unit next to the product name in the combobox.

Now let me plan the actual file changes:

1. Create: `supabase/migrations/20260710_process_barang_masuk.sql`
2. Create: `supabase/migrations/20260710_widen_numeric_columns.sql`
3. Rewrite: `app/dashboard/inventory/stock-in/actions.ts`
4. Rewrite: `app/dashboard/inventory/stock-in/stock-in-client.tsx`
5. No changes needed for `page.tsx` - it already passes the necessary data

Let me start coding.

For the UI, I need to be very careful with the RHF + useFieldArray pattern. Here's my plan for the UI structure:

```tsx
"use client";

import { useForm, useFieldArray, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema
const stockInFormSchema = z.object({
  id_supplier: z.string().min(1, "Pilih supplier"),
  tgl_masuk: z.string().min(1, "Pilih tanggal"),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(z.object({
    id_produk: z.number({ required_error: "Pilih produk" }),
    jumlah: z.number().min(0.001, "Jumlah harus > 0"),
    harga_beli: z.number().min(1, "Harga beli harus > 0"),
    keterangan: z.string().optional(),
  })).min(1, "Minimal 1 item"),
});
```

Wait, I also need to store `nama_produk` for display in the form. The current combobox stores the product object in state. With RHF, I can store the product ID in the form and keep a `selectedProducts` map in a separate state for display. Or I can use a ref.

Actually, the cleanest approach: store the full product object in the form item's value, and only validate that `id_produk` is set. Since `nama_produk`, `barcode`, `satuan` are display-only, they don't need to be in the Zod schema.

```ts
const stockInFormSchema = z.object({
  id_supplier: z.string().min(1, "Pilih supplier"),
  tgl_masuk: z.string().min(1, "Pilih tanggal"),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(z.object({
    id_produk: z.number({ required_error: "Produk harus dipilih", invalid_type_error: "Produk harus dipilih" }),
    searchText: z.string().optional(), // display only
    jumlah: z.number().min(0.001, "Jumlah harus lebih dari 0"),
    harga_beli: z.number().min(1, "Harga beli harus lebih dari 0"),
    keterangan: z.string().optional(),
  })).min(1, "Minimal 1 item"),
});
```

Hmm, but `searchText` isn't really a form field. Let me think differently...

Actually, let me look at how `react-hook-form` `useFieldArray` works more carefully.

With `useFieldArray`, each item in the array is a form value. The `ProductCombo` component manages its own internal state (search text, dropdown open/close) but uses the form's `setValue` to update `items[index].id_produk` when a product is selected.

The `searchText` doesn't need to be a form field - it can be local state in `ProductCombo`. When a product is selected:
1. The dropdown closes
2. The product ID is written to `items[index].id_produk`
3. The search text is set to the product name (local state)

When the user types in the search box, it updates local state only. On submit, we only validate that `id_produk` is set.

But there's a problem: if the form re-renders or the field array changes, the local state in `ProductCombo` might be lost. To handle this, I should persist the search text or use `defaultValues`.

Wait, a better approach: use `Controller` with a custom render that combines the search state and the product ID.

Actually, the simplest approach that works well:

1. Add `searchText` and `satuan` to the item's form data (not validated by Zod, just passed through)
2. The `ProductCombo` reads/writes these through RHF
3. Submit uses only the validated fields

Let me try a different approach - use a separate React state (like a Map<string, selectedProduct>) to track which product is selected for each row:

```tsx
const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
```

Each row has a `tempId` (like the current implementation), and the `productMap` keeps the selected product for each `tempId`.

But with `useFieldArray`, rows don't have arbitrary IDs - they have indices. So I'd need to use indices as keys.

OK, let me simplify this. I'll keep the approach similar to the current one but integrate RHF:

```tsx
// Each item stores both the form values and the product display info
type FormValues = {
  id_supplier: string;
  tgl_masuk: string;
  paymentType: "Tunai" | "Kredit";
  tanggalJatuhTempo: string;
  items: {
    id_produk: number;
    jumlah: number;
    harga_beli: number;
    keterangan: string;
  }[];
};
```

And the `ProductCombo` component uses:
- `setValue` and `getValues` from `useFormContext` to read/write `items[index].id_produk`
- Local state for search text, dropdown open, highlight
- `useEffect` to sync: when `id_produk` changes via `setValue`, search text updates

Wait, actually there's a subtle issue. When the user first opens the form, there's no selected product. The `id_produk` is undefined/0. The user types in the search box, sees results, clicks one → sets `id_produk` in the form. If the form is reset, the local state is lost. But that's fine because form reset usually means clearing everything.

I think the cleanest approach is:

1. Each item in `items` array stores: `{ id_produk, searchText, nama_produk, satuan, jumlah, harga_beli, keterangan }`
2. `searchText` and `nama_produk` and `satuan` are display-only meta fields managed by the combobox
3. Zod only validates the business fields (`id_produk`, `jumlah`, `harga_beli`)
4. On submit, transform the data to only send what the server expects

But actually, storing `searchText` in the form state can cause issues with re-renders. Every keystroke would trigger form re-validation.

The better approach is definitely to keep `searchText` as local state in the `ProductCombo` component. Let me design it properly.

Let me just model the value to include the full product info, but use `z.unknown()` for the product field and validate after:

Actually no, let me reconsider. The current implementation works well. The main thing the user wants is:
1. RPC for atomicity (migration + action change)
2. RHF + Zod for form

For #2, I need to use RHF + Zod. Let me keep it simple and practical:

```tsx
const formSchema = z.object({
  id_supplier: z.string().min(1, "Supplier harus dipilih"),
  tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(z.object({
    id_produk: z.number({ required_error: "Produk harus dipilih" }).positive("Produk harus dipilih"),
    jumlah: z.number().positive("Jumlah harus > 0"),
    harga_beli: z.number().positive("Harga beli harus > 0"),
    keterangan: z.string().optional(),
  })).min(1, "Minimal 1 item"),
});
```

For the ProductCombo, I'll use `useFormContext` to `setValue` / `watch` the `id_produk`, and keep search state local.

Actually, let me think about one more thing. The current form computes `total` (row total) and `totalSemua` (grand total) as display. These are derived from `jumlah * harga_beli` and don't need to be stored in the form.

OK let me write the code now. I'll write clean, working code.

Let me think about the ProductCombo more carefully with RHF:

```tsx
interface ProductComboProps {
  index: number;
  products: Product[];
}

function ProductCombo({ index, products }: ProductComboProps) {
  const { watch, setValue, getFieldState } = useFormContext<FormValues>();
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const productId = watch(`items.${index}.id_produk`);
  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [productId, products]
  );
  
  // Sync search text when product is selected programmatically
  useEffect(() => {
    if (selectedProduct) {
      setSearchText(selectedProduct.nama_produk);
    }
  }, [productId]); // eslint-disable-line
  
  // The rest of the combobox logic...
}
```

There's a problem: when the user types in the search box and the text doesn't match a product, `productId` becomes stale (it's still the old one). We need to clear it when the user modifies the search text.

Let me handle this:

```tsx
const handleInputChange = (value: string) => {
  setSearchText(value);
  setOpen(true);
  setHighlightIdx(0);
  // Clear selected product when text changes
  if (value !== selectedProduct?.nama_produk) {
    setValue(`items.${index}.id_produk`, 0 as any, { shouldValidate: false });
  }
};
```

Wait, `id_produk` is `z.number().positive()` in the schema. Setting it to 0 would fail validation. Let's use `undefined` or `null`... but Zod `z.number()` doesn't accept null. Let me change the schema slightly.

Actually, let me use `z.number().nullable()` for `id_produk` and check:

```tsx
const formSchema = z.object({
  // ...
  items: z.array(z.object({
    id_produk: z.number().nullable().refine(v => v !== null && v > 0, "Produk harus dipilih"),
    // ...
  }))
});
```

Hmm, that's awkward. Let me just make it simpler. The field type can stay as `z.number()` and I'll set it to `0` when clearing, with a custom validation message.

Actually, `z.number().min(1, "Produk harus dipilih")` works perfectly. If `id_produk` is 0 (unset), it fails validation with "Produk harus dipilih".

```tsx
handleInputChange = (value) => {
  setSearchText(value);
  setOpen(true);
  if (value !== selectedProduct?.nama_produk) {
    setValue(`items.${index}.id_produk`, 0 as any); // This will fail validation
  }
};
```

But setting `0` would be a `number` type, and `z.number().min(1)` would reject it, showing "Produk harus dipilih". That's the desired behavior.

However, there's a problem: `z.number().min(1)` will show an error as soon as the form is rendered for empty items. The default value for `id_produk` should be `0` or `undefined`.

Let me use `z.union([z.number().positive("Produk harus dipilih"), z.literal(0)])`... no that's overcomplicating it.

Let me just use:
```ts
id_produk: z.number().min(1, "Produk harus dipilih")
```

With default value `0`. When a product is not selected, `id_produk = 0`, and validation fails. But we should only validate on submit or on blur, not on every keystroke. RHF's `mode` option can be set to `onSubmit`.

Let me set the form mode to `onSubmit` so errors only show after submit.

OK, I think I have a good enough plan. Let me also think about the `trigger` function to manually trigger validation for specific fields.

Actually, I'll use `mode: "onBlur"` to have a better UX - errors clear as the user fills in fields.

Let me finalize the approach and write the code now. Here's my approach:

1. **Form Schema**: Use Zod with `id_produk: z.number().min(1, "Produk harus dipilih")`, default to `0`
2. **Form Mode**: `onSubmit` (show errors only after submit attempt)
3. **ProductCombo**: Local state for search/open/highlight, RHF `setValue`/`watch` for `id_produk`
4. **Field validation errors**: Use RHF's `formState.errors` to display per-row errors
5. **Dynamic rows**: Use `useFieldArray` from RHF
6. **Submit**: Call the updated `addStockIn` server action

Let me write the code now, producing file by file.

For the `stock-in-client.tsx`, I'll use the shadcn Form components since they're already available. Let me check what form components exist...

Actually, the current form doesn't use shadcn Form components. Let me check what's available:

From the earlier exploration, `components/ui/` has shadcn components. Let me check for Form components specifically. But actually, I know from the tech stack that shadcn/ui is used, so `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` should be available.

Let me look at how other forms in the project use shadcn components.

Actually, looking at the current code more carefully, the project doesn't seem to use shadcn Form components much - it mostly uses raw `<input>`, `<select>`, `<Button>`, and `<Input>`. The form validation is manual.

Since the user explicitly requested RHF + Zod, I should use the proper integration. Let me use the shadcn Form field components if they exist, or fall back to bare RHF.

Let me check if the project has the form components.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "priority": "high",
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "in_progress"
    },
    {
      "priority": "medium",
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "pending"
    },
    {
      "priority": "medium",
      "content": "Update server page (`page.tsx`) if needed",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Final review: verify all files compile and types are correct",
      "status": "pending"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile and types are correct",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.2s)

_Thinking:_

Let me check what shadcn form components are available and also check the package.json for react-hook-form and zod.

Let me check available packages and form components before writing.

**Tool: glob**

**Input:**
```json
{
  "pattern": "components/ui/form*.tsx"
}
```

**Output:**
```
No files found
```

**Tool: grep**

**Input:**
```json
{
  "pattern": "react-hook-form|@hookform/resolvers|@radix-ui/react-form",
  "include": "package.json"
}
```

**Output:**
```
Found 1 matches
/home/haydar/Code/POS/app/package.json:
  Line 32:     "react-hook-form": "^7.76.1",

```

**Tool: grep**

**Input:**
```json
{
  "pattern": "useForm|useFieldArray|FormProvider|Controller",
  "include": "*.tsx",
  "path": "/home/haydar/Code/POS/app/components/ui"
}
```

**Output:**
```
No files found
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.5s)

_Thinking:_

So `react-hook-form` is in the dependencies but:
- No shadcn Form component (`components/ui/form.tsx`)
- No `@hookform/resolvers` package
- No usage of RHF anywhere in the codebase

So I need to either:
1. Create a minimal form wrapper myself
2. Use bare RHF without shadcn form wrappers
3. Install `@hookform/resolvers`

Let me check if `zod` is in the dependencies:

**Tool: grep**

**Input:**
```json
{
  "include": "package.json",
  "pattern": "zod|hookform"
}
```

**Output:**
```
Found 1 matches
/home/haydar/Code/POS/app/package.json:
  Line 36:     "zod": "^4.4.3",

```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/package.json"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/package.json</path>
<type>file</type>
<content>
1: {
2:   "name": "app",
3:   "version": "0.1.0",
4:   "private": true,
5:   "scripts": {
6:     "dev": "next dev",
7:     "dev:https": "next dev --experimental-https --experimental-https-key certificates/localhost-key.pem --experimental-https-cert certificates/localhost.pem --hostname 0.0.0.0",
8:     "build": "next build --webpack",
9:     "start": "next start",
10:     "lint": "eslint"
11:   },
12:   "dependencies": {
13:     "@ducanh2912/next-pwa": "^10.2.9",
14:     "@supabase/ssr": "^0.10.3",
15:     "@supabase/supabase-js": "^2.105.4",
16:     "@tanstack/react-table": "^8.21.3",
17:     "@zxing/browser": "^0.2.0",
18:     "@zxing/library": "^0.22.0",
19:     "class-variance-authority": "^0.7.1",
20:     "clsx": "^2.1.1",
21:     "date-fns": "^4.4.0",
22:     "jsbarcode": "^3.12.3",
23:     "jspdf": "^4.2.1",
24:     "jspdf-autotable": "^5.0.8",
25:     "lucide-react": "^1.16.0",
26:     "next": "16.2.6",
27:     "papaparse": "^5.5.3",
28:     "qrcode": "^1.5.4",
29:     "radix-ui": "^1.4.3",
30:     "react": "19.2.4",
31:     "react-dom": "19.2.4",
32:     "react-hook-form": "^7.76.1",
33:     "shadcn": "^4.7.0",
34:     "tailwind-merge": "^3.6.0",
35:     "tw-animate-css": "^1.4.0",
36:     "zod": "^4.4.3",
37:     "zustand": "^5.0.13"
38:   },
39:   "devDependencies": {
40:     "@tailwindcss/postcss": "^4",
41:     "@types/jsbarcode": "^3.11.4",
42:     "@types/node": "^20",
43:     "@types/papaparse": "^5.5.2",
44:     "@types/qrcode": "^1.5.6",
45:     "@types/react": "^19",
46:     "@types/react-dom": "^19",
47:     "eslint": "^9",
48:     "eslint-config-next": "16.2.6",
49:     "supabase": "^2.98.2",
50:     "tailwindcss": "^4",
51:     "typescript": "^5"
52:   }
53: }

(End of file - total 53 lines)
</content>
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 63.6s)

_Thinking:_

Important findings:
1. `react-hook-form` v7 is present
2. `zod` v4 is present (NOT v3 - this is important because Zod v4 has some API differences)
3. `@hookform/resolvers` is NOT installed - I need to install it for the `zodResolver` integration
4. No shadcn Form component exists - I'll use bare RHF

Key considerations:
- **Zod v4**: API changes from v3. In v4, `z.number().positive()` etc. should still work. But I should check if `@hookform/resolvers/zod` works with Zod v4 or if I need a different resolver approach.

Let me think about this. Since `@hookform/resolvers` is not installed and the project uses Zod v4, I should either:
1. Install `@hookform/resolvers` (which should work with Zod v4)
2. Use manual validation

Let me install `@hookform/resolvers` first.

Actually wait - `zod@^4.4.3` means it's Zod v4. `@hookform/resolvers` may not support Zod v4 yet. Let me check what version of `@hookform/resolvers` supports Zod v4.

In Zod v4, some things changed:
- `z.object()` still works
- `z.string().min()` etc. still work
- The error format changed - errors are now `ZodIssue[]` with slightly different structure
- `z.infer` still works

The `@hookform/resolvers/zod` adapter should still work as long as it uses the standard `safeParse` / `parse` interface. Let me check... Actually, `@hookform/resolvers` 3.x and 4.x should handle Zod v4 since Zod v4 maintains backward compatibility for the most part.

Let me install `@hookform/resolvers` and proceed.

Actually, let me think about whether I even need `@hookform/resolvers`. I can just use RHF's native resolver:

```tsx
const form = useForm({
  resolver: (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    // Convert Zod errors to RHF format
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      errors[path] = { type: "validation", message: issue.message };
    }
    return { values: {}, errors };
  },
});
```

This is simpler than installing a new package. But it's error-prone.

Alternatively, I can just install `@hookform/resolvers`. Let me do that.

Wait, actually I should be careful. Zod v4 has a different error structure than Zod v3. In Zod v4:
- `ZodError` has `issues` (same)
- Each issue has `path`, `message`, `code` (same)
- But the `code` values might be different

The `@hookform/resolvers` package's `zodResolver` should handle this. Let me just install it.

Actually, one more thing - Zod v4 error format. The `zodResolver` should be fine since the core API is the same. Let me proceed.

Actually, let me reconsider. I don't want to add new dependencies if I can avoid it. Let me write a simple custom resolver:

```tsx
import { z } from "zod";

function zodResolver<T extends z.ZodType>(schema: T) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} as Record<string, { type?: string; message?: string }> };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}
```

This is clean and doesn't require an extra dependency. Let me use this approach.

Now, for the Zod v4 API - let me write the schema carefully. Zod v4 has some changes:

1. `z.enum(["a", "b"])` still works
2. `z.number().positive()` should work
3. `z.string().min(1)` should work
4. The `.safeParse()` method still returns `{ success: true, data }` or `{ success: false, error }`

Let me now write all the files.

## File 1: Migration - `process_barang_masuk` RPC

```sql
-- Migration: 20260710_process_barang_masuk.sql
-- Creates atomic RPC for incoming inventory with WAC calculation

CREATE OR REPLACE FUNCTION process_barang_masuk(
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_barang_masuk_id INTEGER;
  v_prod RECORD;
  v_total_stok NUMERIC;
  v_nilai_sekarang NUMERIC;
  v_nilai_masuk NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_new_stok_gudang NUMERIC;
  v_results JSONB[] := '{}';
BEGIN
  -- Serialise concurrent calls with an advisory lock (released at end of txn)
  -- Uses a different lock ID (987654322) from process_checkout (987654321)
  -- so stock-in and checkout do NOT block each other.
  -- However, concurrent stock-in calls ARE serialised.
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 1. Insert row into barang_masuk
    INSERT INTO barang_masuk (
      tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan
    ) VALUES (
      (v_item->>'tgl_masuk')::date,
      (v_item->>'id_supplier')::integer,
      (v_item->>'id_produk')::integer,
      (v_item->>'harga_beli')::numeric,
      (v_item->>'jumlah')::numeric,
      (v_item->>'total')::numeric,
      NULLIF(v_item->>'keterangan', '')
    )
    RETURNING id INTO v_barang_masuk_id;

    -- 2. Lock and read current product row
    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- 3. Weighted Average Cost calculation
    v_total_stok   := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
    v_nilai_sekarang := v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0);
    v_nilai_masuk  := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;
    v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;

    IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN
      v_new_avco := (v_nilai_sekarang + v_nilai_masuk) / (v_total_stok + (v_item->>'jumlah')::numeric);
    ELSE
      v_new_avco := 0;
    END IF;

    v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;

    -- 4. Insert AVCO history
    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi,
      qty_masuk, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      (v_item->>'id_produk')::integer,
      'pembelian',
      v_barang_masuk_id,
      (v_item->>'jumlah')::numeric,
      (v_item->>'harga_beli')::numeric,
      v_total_stok,
      COALESCE(v_prod.harga_pokok_avco, 0),
      v_total_stok + (v_item->>'jumlah')::numeric,
      v_new_avco,
      v_new_nilai_persediaan
    );

    -- 5. Update product
    UPDATE produk
    SET
      stok_gudang       = v_new_stok_gudang,
      harga_pokok_avco  = v_new_avco,
      nilai_persediaan  = v_new_nilai_persediaan,
      updated_at        = now()
    WHERE id = (v_item->>'id_produk')::integer;

    -- 6. Collect result
    v_results := v_results || jsonb_build_object(
      'id',         v_barang_masuk_id,
      'id_produk',  (v_item->>'id_produk')::integer,
      'jumlah',     (v_item->>'jumlah')::numeric,
      'harga_beli', (v_item->>'harga_beli')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_barang_masuk(JSONB) TO authenticated;
```

## File 2: Migration - widen numeric columns

```sql
-- Migration: 20260710_widen_numeric_columns.sql
-- Remove scale/precision constraints so DB stores full-precision values
-- Rounding only happens at the UI level (formatIDR helper)

ALTER TABLE produk
  ALTER COLUMN harga_pokok_avco   TYPE numeric,
  ALTER COLUMN nilai_persediaan   TYPE numeric;

ALTER TABLE riwayat_avco
  ALTER COLUMN harga_satuan_transaksi   TYPE numeric,
  ALTER COLUMN avco_sebelum             TYPE numeric,
  ALTER COLUMN avco_sesudah             TYPE numeric,
  ALTER COLUMN nilai_persediaan_sesudah TYPE numeric;
```

## File 3: Updated server action

For the server action, I need to handle the Zod v4 API. In Zod v4, `.safeParse()` returns either `{ success: true, data: T }` or `{ success: false, error: ZodError }`. The `ZodError` has `issues` array.

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stockInRowSchema = z.object({
  id_produk: z.number().int().positive(),
  jumlah: z.number().positive(),
  harga_beli: z.number().positive(),
  total: z.number().nonnegative(),
  tgl_masuk: z.string().min(1),
  id_supplier: z.number().int().positive(),
  keterangan: z.string().optional(),
});

export async function addStockIn(
  rows: z.infer<typeof stockInRowSchema>[],
  paymentType?: "Tunai" | "Kredit",
  tanggalJatuhTempo?: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Validate rows
  for (let i = 0; i < rows.length; i++) {
    const result = stockInRowSchema.safeParse(rows[i]);
    if (!result.success) {
      const msgs = result.error.issues.map(issue => `Baris ${i + 1}: ${issue.message}`);
      return { error: msgs.join(". ") };
    }
  }

  if (rows.length === 0) {
    return { error: "Minimal 1 item" };
  }

  // Call atomic RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc("process_barang_masuk", {
    p_items: rows.map(r => ({
      id_produk: r.id_produk,
      jumlah: r.jumlah,
      harga_beli: r.harga_beli,
      total: r.total,
      tgl_masuk: r.tgl_masuk,
      id_supplier: r.id_supplier,
      keterangan: r.keterangan || null,
    })),
  });

  if (rpcError) {
    console.error("RPC error:", rpcError);
    return { error: rpcError.message };
  }

  const inserted = rpcResult?.inserted as Array<{ id: number }> | undefined;

  // Handle hutang creation (soft-fail: goods already received)
  if (inserted && inserted.length > 0 && paymentType === "Kredit") {
    const { createHutang } = await import("@/lib/hutang");
    const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);

    try {
      await createHutang(supabase, {
        id_supplier: rows[0].id_supplier,
        id_barang_masuk: inserted[0].id,
        tanggal_hutang: rows[0].tgl_masuk,
        tanggal_jatuh_tempo: tanggalJatuhTempo || null,
        jumlah_awal: totalAmount,
        catatan: "Otomatis dari Barang Masuk",
      });
    } catch (err: any) {
      // Goods are already received; hutang can be created manually
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true, data: rpcResult };
}
```

Wait, I should check if `z.infer` works the same in Zod v4... It should. Let me verify by looking at the Zod v4 API.

Actually, in Zod v4, `z.infer<typeof schema>` still works. Good.

Now for the tricky part - the UI client. Let me write it carefully.

The key challenge: integrating the ProductCombo component with RHF's useFieldArray.

Here's my plan:
- Use `useForm` with mode: "onSubmit"
- Use `useFieldArray` for the dynamic items
- The ProductCombo component will use `useFormContext` to read/write `id_produk`
- Local state in ProductCombo for search text, dropdown open/highlight

One issue: with `useFieldArray`, when I call `remove(index)`, the array shifts. The product combo needs to use the correct index. Since `useFieldArray` handles this correctly via the `fields` array, this should work fine.

Let me write the client component now.

For the form error display, since there's no shadcn Form component, I'll display errors inline using RHF's `formState.errors`.

Actually, let me think about this more carefully. The current form has a list of validation errors at the top (banner style). With RHF, errors are per-field. I can either:
1. Show per-field errors inline (better UX)
2. Collect all errors at the top (current behavior)

I think per-field errors are better. Let me show:
- Error border on invalid fields
- Error text below invalid fields

But since the form is table-based, showing error text below each cell might be clunky. Let me think...

Actually, let me re-examine what the current form does:
- It has a banner at the top listing all validation errors
- Each row doesn't have individual error indicators

I'll keep a similar approach: show a top banner with validation errors on submit, and also highlight invalid fields with a red border.

For the banner, I can derive from `formState.errors`:

```tsx
const validationErrors = useMemo(() => {
  const errs: string[] = [];
  const { items, id_supplier } = formState.errors;
  if (id_supplier) errs.push(String(id_supplier.message));
  if (items) {
    items.forEach((item: any, i: number) => {
      if (item?.id_produk) errs.push(`Baris ${i + 1}: ${item.id_produk.message}`);
      if (item?.jumlah) errs.push(`Baris ${i + 1}: ${item.jumlah.message}`);
      if (item?.harga_beli) errs.push(`Baris ${i + 1}: ${item.harga_beli.message}`);
    });
  }
  return errs;
}, [formState.errors]);
```

This is a bit messy with the RHF error structure. Let me write a helper.

Actually, in RHF v7, `formState.errors` is typed as `DeepMap<FieldValues, FieldError>`. The structure for a field array item is:

```ts
errors.items?.[index]?.id_produk?.message
```

Let me handle this cleanly.

OK, I think I've planned enough. Let me write the actual code now. I'll focus on getting it right, handling all edge cases.

One more thing - I need to handle the Zod v4 import correctly. The project uses `zod@^4.4.3`, so I should test that my Zod schema syntax is valid for v4.

In Zod v4:
- `.positive()` - still works for numbers
- `.min(1)` - still works for strings and numbers
- `.nonnegative()` - still works 
- `.int()` - still works
- `.safeParse()` - still returns `{ success, data }` or `{ success, error: ZodError }`
- `z.infer` - still works
- `z.enum` - still works
- `z.union` - still works (or use `.or()`)

Good, the basic API is the same. Let me write the code now.

For the custom zodResolver function in the client, I'll handle the ZodError format:

```tsx
function zodResolver<T extends z.ZodType>(schema: T) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} as Record<string, { type?: string; message?: string }> };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}
```

Now let me write everything out.

Actually, let me reconsider the scope of changes. The user said "do that plan, do it carefully without error and inform me step by step to test it in the app". So they want to test each step.

Let me organize the implementation in steps they can test:

Step 1: Create migration file for the RPC (no testing yet, just file creation)
Step 2: Create migration file for widening columns (file creation)
Step 3: Apply migrations to Supabase (need to run)
Step 4: Update server action (file change)
Step 5: Update UI client (file change)
Step 6: Test

Actually, since this is a Next.js app with Supabase, they'll need to apply migrations via the Supabase CLI. Let me write the files and then inform them about how to test.

For now, let me focus on writing correct code. Let me start with the files.

Actually, I realize I should be more careful about one thing in the UI: the ProductCombo integration with RHF `useFieldArray`. 

In `useFieldArray`, each field has an `id` (auto-generated) and `index`. The actual data for each item is in `fields[index]`. When I do `setValue`, I use the path like `items.${index}.id_produk`.

But there's a subtlety: `useFieldArray` returns `fields` which contains both the data and metadata. If I use `watch` to get the current values, I get the actual data.

Let me write the code step by step.

For the product combobox, here's how I'll handle it:

```tsx
function ProductCombo({ index, products }: { index: number; products: Product[] }) {
  const { watch, setValue, formState } = useFormContext<StockInFormValues>();
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Watch the current product ID for this row
  const productId = watch(`items.${index}.id_produk`);
  
  // Find the selected product
  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [productId, products]
  );
  
  // Sync search text when product selection changes from outside
  useEffect(() => {
    if (selectedProduct) {
      setSearchText(selectedProduct.nama_produk);
    }
  }, [productId]);
  
  // Filter products based on search text
  const filtered = useMemo(() => {
    if (!searchText.trim()) return products.slice(0, 50);
    const q = searchText.toLowerCase();
    return products.filter(
      p => p.nama_produk.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [searchText, products]);
  
  // Select a product
  const selectProduct = (product: Product) => {
    setValue(`items.${index}.id_produk`, product.id, { shouldValidate: true });
    setSearchText(product.nama_produk);
    setOpen(false);
  };
  
  // Handle input change
  const handleInputChange = (value: string) => {
    setSearchText(value);
    setHighlightIdx(0);
    setOpen(true);
    // Clear product selection if text doesn't match
    if (!selectedProduct || value !== selectedProduct.nama_produk) {
      setValue(`items.${index}.id_produk`, 0 as any, { shouldValidate: false });
    }
  };
  
  // ... rest of the combobox (keyboard nav, click outside, etc.)
}
```

Wait, there's a problem with setting `id_produk` to `0`. In RHF, if I set it to `0` when `shouldValidate: false`, and the schema requires `min(1)`, then validation won't fire. So on submit, the field will have value `0` and will fail validation, giving the user an error message "Produk harus dipilih". That's fine.

But actually, let me use a nullable pattern instead. I'll set `id_produk: z.number().nullable().refine(...)` in the schema. Or better yet, use `z.number().min(1, "Produk harus dipilih")` with default `0`.

Let me check if Zod v4 `z.number().min(1)` works with `0`... yes, `0 < 1` so it will fail validation. Good.

But wait, RHF `defaultValues` for the items need `id_produk` to be initially `0` (invalid). This will cause the field to show as "invalid" immediately if we validate on mount. Since I'm using `mode: "onSubmit"`, this shouldn't be an issue.

Let me write the full implementation now.

Actually, thinking more carefully about the form, I think I should keep the form relatively simple. Since the current form works well, I should focus on:
1. Adding RHF + Zod validation on submit
2. Making the server action call the RPC
3. Keeping the existing UX pattern

Let me use a hybrid approach: keep the form state management but add RHF for validation only. Actually no, the user explicitly asked for RHF. Let me go all-in on RHF.

OK here's my final approach for the client component:

1. Use `useForm` with `zodResolver` (custom implementation)
2. Use `useFieldArray` for items
3. Each item stores: `id_produk`, `jumlah`, `harga_beli`, `keterangan`
4. The `ProductCombo` is a custom controlled component using `useFormContext`
5. Display validation errors in a banner at the top
6. Submit transforms form data and calls `addStockIn`

Let me write it now.

For the form schema, I need to handle the fact that `id_produk: 0` means "not selected":

```typescript
const itemSchema = z.object({
  id_produk: z.number().min(1, "Produk harus dipilih"),
  jumlah: z.number().min(0.001, "Jumlah harus lebih dari 0"),
  harga_beli: z.number().min(1, "Harga beli harus lebih dari 0"),
  keterangan: z.string().optional(),
});

const formSchema = z.object({
  id_supplier: z.string().min(1, "Supplier harus dipilih"),
  tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});
```

The `id_supplier` is a string because the `<select>` element works with string values and the `value` prop is a string.

Wait, actually in the current form, `idSupplier` is `number | ""`. The `<select>` value is always a string. In RHF, I can use `<FormField>` with an `<select>` that converts.

Let me simplify: use `id_supplier: z.string().min(1)` and convert to number in the submit handler.

OK, let me write the full client component. I'll be very careful with the code.

Actually, one more issue: in the `useFieldArray`, when I call `remove(index)`, the row indices change. The ProductCombo for each row uses `index` from the `fields.map((field, index) => ...)` iteration, which should be correct since React re-renders each component with the new index.

But there could be a stale closure issue. If an event handler captures an old `index` value... Actually, since we're inside the render function and each ProductCombo receives `index` as a prop, it should always have the current index.

OK wait, there's actually a known issue with `useFieldArray` where indexes can become stale in callbacks. The recommended approach is to use `useCallback` and pass the index from the map iteration.

Let me look at how I'll structure this:

```tsx
{fields.map((field, index) => (
  <tr key={field.id}>
    <td>{index + 1}</td>
    <td>
      <ProductCombo index={index} products={products} />
    </td>
    <td>
      <Controller
        control={control}
        name={`items.${index}.jumlah`}
        render={({ field: { value, onChange, ...rest } }) => (
          <Input 
            type="number"
            value={value || ""}
            onChange={e => onChange(Math.max(0, Number(e.target.value)))}
            {...rest}
          />
        )}
      />
    </td>
    ...
  </tr>
))}
```

Wait, using `Controller` for each field in the table would be verbose. Let me use `useFormContext` or direct `register` instead.

Actually, `register` is the simplest for basic inputs:

```tsx
<input {...register(`items.${index}.jumlah`, { valueAsNumber: true })} />
```

But `register` doesn't easily support custom onChange like `Math.max(0, ...)`. Let me use `Controller` for inputs that need transformation, and `register` for simpler ones.

Actually, I can handle the clamp in the schema or in the submit handler. Let me just use `register` for most fields and only use `Controller` for the ProductCombo (which needs custom input).

Wait, for `<Input type="number">`, the value is `""` when empty and a number string otherwise. RHF's `register` with `valueAsNumber: true` converts it to a number. The `min={0}` prop on the HTML element prevents negative values in the browser, but it's not guaranteed. I should handle this in the schema with `z.number().nonnegative()`.

OK, let me just write the code. I'll use `register` for simple fields and manual `setValue`/`watch` for the product combobox.

Actually, for simplicity and correctness, let me use `useFormContext` throughout. I'll write helper functions for field registration that match the table cell needs.

Let me finalize the structure and write it now.

Here's my plan for the form:

```tsx
export default function StockInClient({ products, suppliers }) {
  const form = useForm<StockInFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    defaultValues: {
      id_supplier: "",
      tgl_masuk: new Date().toISOString().slice(0, 10),
      paymentType: "Tunai",
      tanggalJatuhTempo: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })(),
      items: [{ id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: "" }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
  // etc.
}
```

The `id_produk: 0` as default will fail validation. That's fine - it shows "Produk harus dipilih" when the user submits without selecting a product.

Let me now think about the conversion from form values to the action payload:

Form values:
```typescript
{
  id_supplier: "1", // string from select
  tgl_masuk: "2026-07-10",
  paymentType: "Tunai",
  tanggalJatuhTempo: "2026-08-09",
  items: [
    { id_produk: 3, jumlah: 10, harga_beli: 5000, keterangan: "" },
  ]
}
```

Action payload:
```typescript
rows = [
  {
    id_produk: 3,
    jumlah: 10,
    harga_beli: 5000,
    total: 50000,
    tgl_masuk: "2026-07-10",
    id_supplier: 1, // number
    keterangan: "",
  }
]
```

So I need to:
1. Convert `id_supplier` from string to number
2. Compute `total = jumlah * harga_beli`
3. Filter out items where `id_produk === 0`

And `tanggalJatuhTempo` should only be sent when paymentType === "Kredit".

OK, I'll write all the code now. Let me be precise and careful.

Good — `react-hook-form` and `zod` v4 are in deps, but no shadcn Form component or `@hookform/resolvers` exists. I'll use bare RHF + a custom `zodResolver`. Let me now implement step by step.

**Step 1: Migration — `process_barang_masuk` RPC**

**Tool: write**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260710_process_barang_masuk.sql",
  "content": "CREATE OR REPLACE FUNCTION process_barang_masuk(\n  p_items JSONB\n)\nRETURNS JSONB\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nDECLARE\n  v_item JSONB;\n  v_barang_masuk_id INTEGER;\n  v_prod RECORD;\n  v_total_stok NUMERIC;\n  v_nilai_sekarang NUMERIC;\n  v_nilai_masuk NUMERIC;\n  v_new_avco NUMERIC;\n  v_new_nilai_persediaan NUMERIC;\n  v_new_stok_gudang NUMERIC;\n  v_results JSONB[] := '{}';\nBEGIN\n  -- Serialise concurrent stock-in calls (lock ID differs from process_checkout's 987654321)\n  PERFORM pg_advisory_xact_lock(987654322);\n\n  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)\n  LOOP\n    -- 1. Insert into barang_masuk\n    INSERT INTO barang_masuk (\n      tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan\n    ) VALUES (\n      (v_item->>'tgl_masuk')::date,\n      (v_item->>'id_supplier')::integer,\n      (v_item->>'id_produk')::integer,\n      (v_item->>'harga_beli')::numeric,\n      (v_item->>'jumlah')::numeric,\n      (v_item->>'total')::numeric,\n      NULLIF(v_item->>'keterangan', '')\n    )\n    RETURNING id INTO v_barang_masuk_id;\n\n    -- 2. Lock and read current product row\n    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan\n    INTO v_prod\n    FROM produk\n    WHERE id = (v_item->>'id_produk')::integer\n    FOR UPDATE;\n\n    IF NOT FOUND THEN\n      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;\n    END IF;\n\n    -- 3. Weighted Average Cost calculation\n    v_total_stok     := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);\n    v_nilai_sekarang := v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0);\n    v_nilai_masuk    := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;\n    v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;\n\n    IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN\n      v_new_avco := (v_nilai_sekarang + v_nilai_masuk) / (v_total_stok + (v_item->>'jumlah')::numeric);\n    ELSE\n      v_new_avco := 0;\n    END IF;\n\n    v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;\n\n    -- 4. Insert AVCO history\n    INSERT INTO riwayat_avco (\n      id_produk, jenis_mutasi, id_referensi,\n      qty_masuk, harga_satuan_transaksi,\n      stok_sebelum, avco_sebelum,\n      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah\n    ) VALUES (\n      (v_item->>'id_produk')::integer,\n      'pembelian',\n      v_barang_masuk_id,\n      (v_item->>'jumlah')::numeric,\n      (v_item->>'harga_beli')::numeric,\n      v_total_stok,\n      COALESCE(v_prod.harga_pokok_avco, 0),\n      v_total_stok + (v_item->>'jumlah')::numeric,\n      v_new_avco,\n      v_new_nilai_persediaan\n    );\n\n    -- 5. Update product\n    UPDATE produk\n    SET\n      stok_gudang      = v_new_stok_gudang,\n      harga_pokok_avco = v_new_avco,\n      nilai_persediaan = v_new_nilai_persediaan,\n      updated_at       = now()\n    WHERE id = (v_item->>'id_produk')::integer;\n\n    -- 6. Collect result\n    v_results := v_results || jsonb_build_object(\n      'id',         v_barang_masuk_id,\n      'id_produk',  (v_item->>'id_produk')::integer,\n      'jumlah',     (v_item->>'jumlah')::numeric,\n      'harga_beli', (v_item->>'harga_beli')::numeric\n    );\n  END LOOP;\n\n  RETURN jsonb_build_object(\n    'success',  true,\n    'inserted', to_jsonb(v_results)\n  );\nEND;\n$$;\n\nGRANT EXECUTE ON FUNCTION process_barang_masuk(JSONB) TO authenticated;\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.4s)

_Thinking:_

Good, the RPC migration is created. Now let me create the second migration for widening numeric columns.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "priority": "high",
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "in_progress"
    },
    {
      "priority": "high",
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "pending"
    },
    {
      "priority": "medium",
      "content": "Update server page (`page.tsx`) if needed",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Final review: verify all files compile and types are correct",
      "status": "pending"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "in_progress",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile and types are correct",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.4s)

_Thinking:_

Now create the second migration for widening numeric columns.

**Step 2: Migration — widen numeric columns for unrounded precision**

**Tool: write**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/supabase/migrations/20260710_widen_numeric_columns.sql",
  "content": "ALTER TABLE produk\n  ALTER COLUMN harga_pokok_avco  TYPE numeric,\n  ALTER COLUMN nilai_persediaan  TYPE numeric;\n\nALTER TABLE riwayat_avco\n  ALTER COLUMN harga_satuan_transaksi   TYPE numeric,\n  ALTER COLUMN avco_sebelum             TYPE numeric,\n  ALTER COLUMN avco_sesudah             TYPE numeric,\n  ALTER COLUMN nilai_persediaan_sesudah TYPE numeric;\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.5s)

_Thinking:_

Migration files are done. Now let me move on to the server action rewrite.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "priority": "high",
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "in_progress"
    },
    {
      "priority": "high",
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "pending"
    },
    {
      "priority": "medium",
      "content": "Update server page (`page.tsx`) if needed",
      "status": "pending"
    },
    {
      "priority": "high",
      "content": "Final review: verify all files compile and types are correct",
      "status": "pending"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "completed",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile and types are correct",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 7.1s)

_Thinking:_

Now rewrite the server action to call the RPC instead of doing sequential operations.

**Step 3: Rewrite server action to call the RPC**

**Tool: write**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/actions.ts",
  "content": "\"use server\";\n\nimport { createClient } from \"@/lib/supabase/server\";\nimport { revalidatePath } from \"next/cache\";\nimport { z } from \"zod\";\n\nconst stockInRowSchema = z.object({\n  id_produk: z.number().int().positive(\"ID produk tidak valid\"),\n  jumlah: z.number().positive(\"Jumlah harus lebih dari 0\"),\n  harga_beli: z.number().positive(\"Harga beli harus lebih dari 0\"),\n  total: z.number().nonnegative(),\n  tgl_masuk: z.string().min(1, \"Tanggal harus diisi\"),\n  id_supplier: z.number().int().positive(\"Supplier harus dipilih\"),\n  keterangan: z.string().optional(),\n});\n\nexport async function addStockIn(\n  rows: z.infer<typeof stockInRowSchema>[],\n  paymentType?: \"Tunai\" | \"Kredit\",\n  tanggalJatuhTempo?: string | null\n) {\n  const supabase = await createClient();\n\n  const { data: { user } } = await supabase.auth.getUser();\n  if (!user) {\n    return { error: \"Unauthorized\" };\n  }\n\n  // Validate every row\n  for (let i = 0; i < rows.length; i++) {\n    const parsed = stockInRowSchema.safeParse(rows[i]);\n    if (!parsed.success) {\n      const messages = parsed.error.issues\n        .map((issue) => `Baris ${i + 1}: ${issue.message}`);\n      return { error: messages.join(\". \") };\n    }\n  }\n\n  if (rows.length === 0) {\n    return { error: \"Minimal 1 item harus diisi\" };\n  }\n\n  // Call the atomic RPC — all inserts, AVCO calculation, and stock update\n  // happen in a single advisory-locked transaction\n  const { data: rpcResult, error: rpcError } = await supabase.rpc(\n    \"process_barang_masuk\",\n    {\n      p_items: rows.map((r) => ({\n        id_produk: r.id_produk,\n        jumlah: r.jumlah,\n        harga_beli: r.harga_beli,\n        total: r.total,\n        tgl_masuk: r.tgl_masuk,\n        id_supplier: r.id_supplier,\n        keterangan: r.keterangan || null,\n      })),\n    }\n  );\n\n  if (rpcError) {\n    return { error: rpcError.message };\n  }\n\n  const inserted = (rpcResult as any)?.inserted as\n    | Array<{ id: number }>\n    | undefined;\n\n  // Handle hutang creation — soft-fail so the goods receipt is never rolled back\n  if (inserted && inserted.length > 0 && paymentType === \"Kredit\") {\n    const { createHutang } = await import(\"@/lib/hutang\");\n    const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);\n\n    try {\n      await createHutang(supabase, {\n        id_supplier: rows[0].id_supplier,\n        id_barang_masuk: inserted[0].id,\n        tanggal_hutang: rows[0].tgl_masuk,\n        tanggal_jatuh_tempo: tanggalJatuhTempo || null,\n        jumlah_awal: totalAmount,\n        catatan: \"Otomatis dari Barang Masuk\",\n      });\n    } catch {\n      // Goods already received; hutang can be created manually if needed\n    }\n  }\n\n  revalidatePath(\"/dashboard/inventory\");\n  return { success: true };\n}\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 33.6s)

_Thinking:_

Server action is done. Now the big one — the UI client rewrite with RHF + Zod + useFieldArray. This is the most complex part. Let me write it carefully.

Key design decisions:
1. Use `useForm` with custom `zodResolver` (since @hookform/resolvers isn't installed)
2. Use `useFieldArray` for dynamic rows
3. ProductCombo uses `useFormContext` for reading/writing `id_produk` while maintaining local state for search/dropdown
4. Footer with Add Row button and Submit button
5. Top banner for errors
6. Table layout matching existing design

Let me write the complete component.

**Step 4: Rewrite UI with React Hook Form + Zod + useFieldArray**

**Tool: write**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx",
  "content": "\"use client\";\n\nimport { useState, useRef, useEffect, useMemo, useCallback } from \"react\";\nimport {\n  useForm,\n  useFieldArray,\n  useFormContext,\n  FormProvider,\n} from \"react-hook-form\";\nimport { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2 } from \"lucide-react\";\nimport { Button } from \"@/components/ui/button\";\nimport { Input } from \"@/components/ui/input\";\nimport { addStockIn } from \"./actions\";\nimport { z } from \"zod\";\n\n/* ------------------------------------------------------------------ */\n/*  Zod schemas                                                        */\n/* ------------------------------------------------------------------ */\n\nconst itemSchema = z.object({\n  id_produk: z.number().min(1, \"Produk harus dipilih\"),\n  jumlah: z.number().min(0.001, \"Jumlah harus lebih dari 0\"),\n  harga_beli: z.number().min(1, \"Harga beli harus lebih dari 0\"),\n  keterangan: z.string().optional(),\n});\n\nconst formSchema = z.object({\n  id_supplier: z.string().min(1, \"Supplier harus dipilih\"),\n  tgl_masuk: z.string().min(1, \"Tanggal harus diisi\"),\n  paymentType: z.enum([\"Tunai\", \"Kredit\"]),\n  tanggalJatuhTempo: z.string().optional(),\n  items: z.array(itemSchema).min(1, \"Minimal 1 item\"),\n});\n\ntype StockInFormValues = z.infer<typeof formSchema>;\n\n/* ------------------------------------------------------------------ */\n/*  Custom zodResolver (no @hookform/resolvers dependency)             */\n/* ------------------------------------------------------------------ */\n\nfunction zodResolver<T extends z.ZodType>(schema: T) {\n  return (values: unknown) => {\n    const result = schema.safeParse(values);\n    if (result.success) {\n      return {\n        values: result.data,\n        errors: {} as Record<string, { type?: string; message?: string }>,\n      };\n    }\n    const errors: Record<string, { type: string; message: string }> = {};\n    for (const issue of result.error.issues) {\n      const path = issue.path.join(\".\");\n      if (!errors[path]) {\n        errors[path] = { type: \"validation\", message: issue.message };\n      }\n    }\n    return { values: {} as T, errors };\n  };\n}\n\n/* ------------------------------------------------------------------ */\n/*  Types                                                              */\n/* ------------------------------------------------------------------ */\n\ninterface Product {\n  id: number;\n  nama_produk: string;\n  barcode: string | null;\n  satuan: { nama: string } | null;\n}\n\ninterface Supplier {\n  id: number;\n  nama_supplier: string;\n}\n\n/* ------------------------------------------------------------------ */\n/*  Helpers                                                            */\n/* ------------------------------------------------------------------ */\n\nconst inputBase =\n  \"w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed\";\n\nfunction formatIDR(n: number) {\n  return new Intl.NumberFormat(\"id-ID\", {\n    style: \"currency\",\n    currency: \"IDR\",\n    minimumFractionDigits: 0,\n    maximumFractionDigits: 0,\n  }).format(n);\n}\n\n/* ------------------------------------------------------------------ */\n/*  ProductCombo — search-and-select combobox                          */\n/* ------------------------------------------------------------------ */\n\nfunction ProductCombo({\n  index,\n  products,\n}: {\n  index: number;\n  products: Product[];\n}) {\n  const { watch, setValue } = useFormContext<StockInFormValues>();\n  const [searchText, setSearchText] = useState(\"\");\n  const [open, setOpen] = useState(false);\n  const [highlightIdx, setHighlightIdx] = useState(0);\n  const inputRef = useRef<HTMLInputElement>(null);\n  const listRef = useRef<HTMLDivElement>(null);\n\n  const productId = watch(`items.${index}.id_produk`);\n  const selectedProduct = useMemo(\n    () => products.find((p) => p.id === productId),\n    [productId, products]\n  );\n\n  useEffect(() => {\n    if (selectedProduct) {\n      setSearchText(selectedProduct.nama_produk);\n    }\n    // Only sync on productId change (when programmatically cleared)\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [productId]);\n\n  useEffect(() => {\n    if (!open) return;\n    const handleClickOutside = (e: MouseEvent) => {\n      if (\n        inputRef.current &&\n        !inputRef.current.contains(e.target as Node) &&\n        listRef.current &&\n        !listRef.current.contains(e.target as Node)\n      ) {\n        setOpen(false);\n      }\n    };\n    document.addEventListener(\"mousedown\", handleClickOutside);\n    return () => document.removeEventListener(\"mousedown\", handleClickOutside);\n  }, [open]);\n\n  const filtered = useMemo(() => {\n    if (!searchText.trim()) return products.slice(0, 50);\n    const q = searchText.toLowerCase();\n    return products\n      .filter(\n        (p) =>\n          p.nama_produk.toLowerCase().includes(q) ||\n          p.barcode?.toLowerCase().includes(q)\n      )\n      .slice(0, 80);\n  }, [searchText, products]);\n\n  const selectProduct = useCallback(\n    (product: Product) => {\n      setValue(`items.${index}.id_produk`, product.id, {\n        shouldValidate: true,\n      });\n      setSearchText(product.nama_produk);\n      setOpen(false);\n    },\n    [index, setValue]\n  );\n\n  const handleInputChange = (value: string) => {\n    setSearchText(value);\n    setHighlightIdx(0);\n    setOpen(true);\n    const isSame = selectedProduct && value === selectedProduct.nama_produk;\n    if (!isSame) {\n      setValue(`items.${index}.id_produk`, 0, { shouldValidate: false });\n    }\n  };\n\n  const handleKeyDown = (e: React.KeyboardEvent) => {\n    if (e.key === \"Enter\") {\n      e.preventDefault();\n      const rawValue = inputRef.current?.value;\n      if (rawValue) {\n        const exactMatch = products.find((p) => p.barcode === rawValue);\n        if (exactMatch) {\n          selectProduct(exactMatch);\n          return;\n        }\n      }\n      if (!open) {\n        setOpen(true);\n        return;\n      }\n      if (filtered[highlightIdx]) {\n        selectProduct(filtered[highlightIdx]);\n      }\n      return;\n    }\n    if (!open) {\n      if (e.key === \"ArrowDown\") {\n        setOpen(true);\n        e.preventDefault();\n      }\n      return;\n    }\n    switch (e.key) {\n      case \"ArrowDown\":\n        e.preventDefault();\n        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));\n        break;\n      case \"ArrowUp\":\n        e.preventDefault();\n        setHighlightIdx((i) => Math.max(i - 1, 0));\n        break;\n      case \"Escape\":\n        setOpen(false);\n        break;\n    }\n  };\n\n  return (\n    <div className=\"relative min-w-[200px]\">\n      <input\n        ref={inputRef}\n        value={searchText}\n        onChange={(e) => handleInputChange(e.target.value)}\n        onFocus={() => setOpen(true)}\n        onKeyDown={handleKeyDown}\n        placeholder=\"Cari produk...\"\n        className={inputBase + \" tabular-nums\"}\n        autoComplete=\"off\"\n      />\n      {selectedProduct && (\n        <span className=\"absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest\">\n          {selectedProduct.satuan?.nama || \"-\"}\n        </span>\n      )}\n      {open && filtered.length > 0 && (\n        <div\n          ref={listRef}\n          className=\"absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-[0_8px_24px_rgba(0,55,112,0.08)] max-h-56 overflow-y-auto\"\n        >\n          {filtered.map((p, i) => (\n            <button\n              type=\"button\"\n              key={p.id}\n              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${\n                i === highlightIdx\n                  ? \"bg-primary/10 text-primary\"\n                  : \"hover:bg-muted text-foreground\"\n              }`}\n              onMouseDown={() => selectProduct(p)}\n              onMouseEnter={() => setHighlightIdx(i)}\n            >\n              <span className=\"truncate\">{p.nama_produk}</span>\n              {p.barcode && (\n                <span className=\"text-[11px] text-muted-foreground tabular-nums shrink-0\">\n                  {p.barcode}\n                </span>\n              )}\n            </button>\n          ))}\n        </div>\n      )}\n      {open && filtered.length === 0 && (\n        <div className=\"absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md p-3 text-sm text-muted-foreground\">\n          Tidak ada produk ditemukan\n        </div>\n      )}\n    </div>\n  );\n}\n\n/* ------------------------------------------------------------------ */\n/*  Main Form Body (consumes FormProvider context)                     */\n/* ------------------------------------------------------------------ */\n\nfunction FormBody({\n  products,\n  suppliers,\n}: {\n  products: Product[];\n  suppliers: Supplier[];\n}) {\n  const {\n    register,\n    control,\n    watch,\n    setValue,\n    formState: { errors },\n  } = useFormContext<StockInFormValues>();\n\n  const { fields, append, remove } = useFieldArray({\n    control,\n    name: \"items\",\n  });\n\n  const [loading, setLoading] = useState(false);\n  const [serverError, setServerError] = useState(\"\");\n  const [success, setSuccess] = useState(false);\n\n  const paymentType = watch(\"paymentType\");\n\n  const today = new Date().toISOString().slice(0, 10);\n\n  const computedTotal = useMemo(\n    () =>\n      fields.reduce((sum, _, i) => {\n        const qty = watch(`items.${i}.jumlah`) || 0;\n        const price = watch(`items.${i}.harga_beli`) || 0;\n        return sum + qty * price;\n      }, 0),\n    [fields, watch]\n  );\n\n  /* Flatten RHF field-array errors into user-friendly strings */\n  const validationErrors = useMemo(() => {\n    const list: string[] = [];\n    if (errors.id_supplier?.message)\n      list.push(errors.id_supplier.message as string);\n    if (errors.items) {\n      for (let i = 0; i < (errors.items?.length ?? 0); i++) {\n        const item = errors.items[i];\n        if (!item) continue;\n        if ((item as any)?.id_produk?.message)\n          list.push(`Baris ${i + 1}: ${(item as any).id_produk.message}`);\n        if ((item as any)?.jumlah?.message)\n          list.push(`Baris ${i + 1}: ${(item as any).jumlah.message}`);\n        if ((item as any)?.harga_beli?.message)\n          list.push(`Baris ${i + 1}: ${(item as any).harga_beli.message}`);\n      }\n    }\n    return list;\n  }, [errors]);\n\n  const canSubmit =\n    fields.length > 0 && validationErrors.length === 0 && !loading;\n\n  const handleSubmit = async () => {\n    if (!canSubmit) return;\n    setLoading(true);\n    setServerError(\"\");\n    setSuccess(false);\n\n    const formValues = (control as any)._formValues as StockInFormValues;\n\n    /* Build payload — filter out rows where no product selected */\n    const payload = formValues.items\n      .filter((item) => item.id_produk > 0 && item.jumlah > 0 && item.harga_beli > 0)\n      .map((item) => ({\n        id_produk: item.id_produk,\n        jumlah: item.jumlah,\n        harga_beli: item.harga_beli,\n        total: item.jumlah * item.harga_beli,\n        tgl_masuk: formValues.tgl_masuk,\n        id_supplier: Number(formValues.id_supplier),\n        keterangan: item.keterangan || \"\",\n      }));\n\n    if (payload.length === 0) {\n      setServerError(\"Tidak ada data valid untuk disimpan\");\n      setLoading(false);\n      return;\n    }\n\n    const res = await addStockIn(\n      payload,\n      formValues.paymentType,\n      formValues.paymentType === \"Kredit\" ? formValues.tanggalJatuhTempo : null\n    );\n\n    if (res?.error) {\n      setServerError(res.error);\n      setLoading(false);\n      return;\n    }\n\n    setSuccess(true);\n    setLoading(false);\n\n    /* Reset form */\n    setValue(\"id_supplier\", \"\");\n    setValue(\"tgl_masuk\", today);\n    setValue(\"paymentType\", \"Tunai\");\n    setValue(\"tanggalJatuhTempo\", \"\");\n    setValue(\"items\", [\n      { id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: \"\" },\n    ]);\n\n    setTimeout(() => setSuccess(false), 4000);\n  };\n\n  return (\n    <>\n      {/* Error / Success banners */}\n      {serverError && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border\">\n          <AlertCircle className=\"w-4 h-4 shrink-0\" />\n          {serverError}\n        </div>\n      )}\n      {validationErrors.length > 0 && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border\">\n          <AlertCircle className=\"w-4 h-4 shrink-0\" />\n          <ul className=\"list-disc list-inside\">\n            {validationErrors.map((msg, i) => (\n              <li key={i}>{msg}</li>\n            ))}\n          </ul>\n        </div>\n      )}\n      {success && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border\">\n          <Check className=\"w-4 h-4 shrink-0\" />\n          Barang masuk berhasil disimpan\n        </div>\n      )}\n\n      {/* Header fields */}\n      <div className=\"shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent\">\n        {/* Supplier */}\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"id_supplier\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Supplier\n          </label>\n          <select\n            id=\"id_supplier\"\n            {...register(\"id_supplier\")}\n            className=\"h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          >\n            <option value=\"\">Pilih supplier</option>\n            {suppliers.map((s) => (\n              <option key={s.id} value={s.id}>\n                {s.nama_supplier}\n              </option>\n            ))}\n          </select>\n        </div>\n\n        {/* Date */}\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"tgl_masuk\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Tanggal Masuk\n          </label>\n          <input\n            id=\"tgl_masuk\"\n            type=\"date\"\n            {...register(\"tgl_masuk\")}\n            className=\"h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          />\n        </div>\n\n        {/* Payment type */}\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"payment_type\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Metode Bayar\n          </label>\n          <select\n            id=\"payment_type\"\n            {...register(\"paymentType\")}\n            className=\"h-9 w-full md:min-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          >\n            <option value=\"Tunai\">Tunai</option>\n            <option value=\"Kredit\">Kredit / Tempo</option>\n          </select>\n        </div>\n\n        {/* Due date (only when Kredit) */}\n        {paymentType === \"Kredit\" && (\n          <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n            <label\n              htmlFor=\"tgl_jatuh_tempo\"\n              className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n            >\n              Jatuh Tempo\n            </label>\n            <input\n              id=\"tgl_jatuh_tempo\"\n              type=\"date\"\n              {...register(\"tanggalJatuhTempo\")}\n              className=\"h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n            />\n          </div>\n        )}\n      </div>\n\n      {/* Table */}\n      <div className=\"flex-1 overflow-y-auto min-h-0\">\n        <table className=\"w-full min-w-[800px]\">\n          <thead>\n            <tr className=\"border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10\">\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2\">\n                #\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2\">\n                Produk\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[100px] px-2\">\n                Jumlah\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2\">\n                Harga Beli\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[140px] px-2\">\n                Total\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2\">\n                Keterangan\n              </th>\n              <th className=\"w-10 px-2\" />\n            </tr>\n          </thead>\n          <tbody>\n            {fields.map((field, index) => {\n              const qty = watch(`items.${index}.jumlah`) || 0;\n              const price = watch(`items.${index}.harga_beli`) || 0;\n              return (\n                <tr\n                  key={field.id}\n                  className=\"border-b border-border/40 hover:bg-muted/20 transition-colors\"\n                >\n                  <td className=\"text-center text-sm text-muted-foreground tabular-nums px-2 py-2\">\n                    {index + 1}\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <ProductCombo index={index} products={products} />\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <Input\n                      type=\"number\"\n                      min={0}\n                      step=\"any\"\n                      {...register(`items.${index}.jumlah`, {\n                        valueAsNumber: true,\n                      })}\n                      className=\"h-9 tabular-nums font-medium\"\n                    />\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <Input\n                      type=\"number\"\n                      min={0}\n                      step=\"any\"\n                      {...register(`items.${index}.harga_beli`, {\n                        valueAsNumber: true,\n                      })}\n                      className=\"h-9 tabular-nums font-medium\"\n                    />\n                  </td>\n                  <td className=\"px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground\">\n                    {formatIDR(qty * price)}\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <input\n                      {...register(`items.${index}.keterangan`)}\n                      placeholder=\"Catatan opsional\"\n                      className={inputBase}\n                    />\n                  </td>\n                  <td className=\"px-2 py-2 text-center\">\n                    <button\n                      type=\"button\"\n                      onClick={() => remove(index)}\n                      disabled={fields.length === 1}\n                      className=\"p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed\"\n                      title=\"Hapus baris\"\n                    >\n                      <Trash2 className=\"w-4 h-4\" />\n                    </button>\n                  </td>\n                </tr>\n              );\n            })}\n          </tbody>\n        </table>\n\n        {fields.length === 0 && (\n          <div className=\"flex flex-col items-center justify-center py-20 text-muted-foreground\">\n            <PackagePlus className=\"w-12 h-12 mb-4 opacity-20\" />\n            <p className=\"text-base font-medium text-foreground\">\n              Belum ada item\n            </p>\n            <p className=\"text-sm mt-1\">\n              Tambah item untuk mencatat penerimaan stok\n            </p>\n          </div>\n        )}\n      </div>\n\n      {/* Footer */}\n      <div className=\"shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap\">\n        <Button\n          type=\"button\"\n          variant=\"ghost\"\n          className=\"rounded-full px-4 h-9 text-muted-foreground hover:text-foreground\"\n          onClick={() =>\n            append({\n              id_produk: 0,\n              jumlah: 1,\n              harga_beli: 0,\n              keterangan: \"\",\n            })\n          }\n        >\n          <Plus className=\"w-4 h-4 mr-1.5\" />\n          Tambah Baris\n        </Button>\n\n        <div className=\"flex items-center gap-4\">\n          <div className=\"text-right\">\n            <p className=\"text-[11px] text-muted-foreground uppercase tracking-wider\">\n              Total Semua\n            </p>\n            <p className=\"text-lg font-light tabular-nums text-foreground\">\n              {formatIDR(computedTotal)}\n            </p>\n          </div>\n          <Button\n            type=\"button\"\n            onClick={handleSubmit}\n            disabled={!canSubmit}\n            className=\"rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed\"\n          >\n            {loading ? (\n              <>\n                <Loader2 className=\"w-4 h-4 mr-2 animate-spin\" />\n                Menyimpan...\n              </>\n            ) : (\n              \"Simpan Barang Masuk\"\n            )}\n          </Button>\n        </div>\n      </div>\n    </>\n  );\n}\n\n/* ------------------------------------------------------------------ */\n/*  Page-level Client Component — wraps everything in FormProvider     */\n/* ------------------------------------------------------------------ */\n\nexport default function StockInClient({\n  products,\n  suppliers,\n}: {\n  products: Product[];\n  suppliers: Supplier[];\n}) {\n  const today = new Date().toISOString().slice(0, 10);\n  const defaultJatuhTempo = (() => {\n    const d = new Date();\n    d.setDate(d.getDate() + 30);\n    return d.toISOString().slice(0, 10);\n  })();\n\n  const form = useForm<StockInFormValues>({\n    resolver: zodResolver(formSchema),\n    mode: \"onSubmit\",\n    defaultValues: {\n      id_supplier: \"\",\n      tgl_masuk: today,\n      paymentType: \"Tunai\",\n      tanggalJatuhTempo: defaultJatuhTempo,\n      items: [{ id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: \"\" }],\n    },\n  });\n\n  return (\n    <FormProvider {...form}>\n      <div className=\"flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden\">\n        <header className=\"shrink-0\">\n          <h1 className=\"text-4xl font-light tracking-tighter text-foreground\">\n            Barang Masuk\n          </h1>\n          <p className=\"text-muted-foreground mt-2\">\n            Catat penerimaan stok baru dari supplier\n          </p>\n        </header>\n\n        <div className=\"flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden\">\n          <FormBody products={products} suppliers={suppliers} />\n        </div>\n      </div>\n    </FormProvider>\n  );\n}\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 66.6s)

_Thinking:_

Now I need to check some important things:

1. The `page.tsx` - does it need any changes? It looks fine as-is - it fetches products and suppliers and passes them to the client component.

2. Let me review the code I just wrote for potential issues:

Issue 1: In the `handleSubmit` function, I'm accessing `(control as any)._formValues`. This is a private API and might not work in all cases. Let me use `getValues()` instead.

Actually, wait - `useFormContext` gives access to `getValues`. But I'm inside `FormBody` which has `useFormContext`. Let me use `getValues()` instead:

```typescript
const { register, control, watch, setValue, getValues, formState: { errors } } = useFormContext<StockInFormValues>();
```
Then:
```typescript
const formValues = getValues();
```

Issue 2: The `handleSubmit` is triggered by clicking the button (`<Button type="button" onClick={handleSubmit}>`), but it's NOT calling `form.handleSubmit()`. This means RHF won't run its validation before the submit. I need to either:
a. Call `form.handleSubmit(handleSubmit)` from RHF
b. Or trigger validation manually

Let me use RHF's `handleSubmit` wrapper properly. The issue is that `handleSubmit` from RHF takes a callback and returns a function. I should use it as:

```typescript
<form onSubmit={handleSubmit(onValid)}>
```

But I don't have a `<form>` tag... Let me add one, or use `handleSubmit` programmatically.

Actually, the cleanest approach: make the button's onClick trigger form submission via RHF. I can do:

```tsx
const onValid = async (data: StockInFormValues) => {
  // ... submit logic
};

// In JSX:
<Button onClick={form.handleSubmit(onValid)}>
```

This works because `handleSubmit` returns a function that when called, runs validation and if valid, calls the callback.

But wait, the issue is that `form.handleSubmit` is available via `useFormContext`. Let me use it:

```typescript
const { register, control, watch, setValue, getValues, handleSubmit, formState: { errors } } = useFormContext<StockInFormValues>();
```

Then:
```typescript
<Button onClick={handleSubmit(onValid)}>
```

This is the correct RHF pattern. Let me update the code.

Issue 3: The `handleSubmit` function converts form values to the payload. If I use RHF's handleSubmit wrapper, the `data` parameter will already be validated. So I can use `data.items` directly. But wait - the RHF handleSubmit gives me the form values after validation transforms. I need to make sure the values are correct.

Issue 4: The `validationErrors` derivation - in RHF, `formState.errors` is a nested object. The field array errors structure is:
```typescript
errors.items?.[index]?.id_produk?.message
```

But my current code uses `(item as any)?.id_produk?.message`. Let me check if this is correct... 

Actually, in RHF v7, `FieldErrors` for a field array field item would be something like:
```typescript
{
  items?: {
    [index: number]: {
      id_produk?: { type: string; message?: string };
      jumlah?: { type: string; message?: string };
      harga_beli?: { type: string; message?: string };
    };
  };
}
```

So `errors.items?.[i]` would be the error object for that item. And `errors.items?.[i]?.id_produk` would be the error for the `id_produk` field. But TypeScript might complain because it doesn't know the structure.

Let me check: `errors.items` has type `FieldError[] | undefined` in RHF v7. And `FieldError` has `message`, `type`, etc. But for field arrays with nested fields, the type is more complex.

Actually, in RHF v7, `FieldErrors` for a nested field array like `items.0.id_produk` would look like:
```typescript
errors: {
  items?: {
    0?: {
      id_produk?: { message?: string; type?: string };
      jumlah?: { message?: string; type?: string };
    };
  };
}
```

But TypeScript types this more broadly. My approach of using `(item as any)?.id_produk?.message` should work at runtime.

Actually, let me just simplify. Instead of deriving validation errors from `formState.errors`, I'll:
1. Not show the banner at all (fields errors can be shown inline)
2. OR just derive them simply

Let me keep the banner approach but simplify it:

```typescript
const validationErrors = useMemo(() => {
  const list: string[] = [];
  if (errors.id_supplier?.message)
    list.push(errors.id_supplier.message as string);
  if (errors.items) {
    const items = errors.items as any;
    if (typeof items === 'object') {
      Object.keys(items).forEach((key) => {
        const item = items[key];
        if (!item || typeof item !== 'object') return;
        const idx = Number(key);
        if (isNaN(idx)) return;
        if (item.id_produk?.message) list.push(`Baris ${idx + 1}: ${item.id_produk.message}`);
        if (item.jumlah?.message) list.push(`Baris ${idx + 1}: ${item.jumlah.message}`);
        if (item.harga_beli?.message) list.push(`Baris ${idx + 1}: ${item.harga_beli.message}`);
      });
    }
  }
  return list;
}, [errors]);
```

This is more robust. With RHF field arrays, `errors.items` might not be an array but an object with numeric keys. Let me handle both cases.

Actually, in RHF v7, `errors.items` is typed as `FieldError[] | undefined` when using useFieldArray. But the type might not be exactly right - at runtime, it's actually an object with numeric keys because of how RHF tracks errors. Let me just use the `as any` approach for maximum compatibility.

Let me also double-check the `canSubmit` logic. Currently:
```typescript
const canSubmit = fields.length > 0 && validationErrors.length === 0 && !loading;
```

This only checks `validationErrors.length`. But validation errors only show AFTER a submit attempt (because of `mode: "onSubmit"`). So on first render, `canSubmit` will be `true` even if no supplier is selected. This is the same behavior as the current implementation, so it's fine.

But wait - if the user hasn't submitted yet, `formState.errors` will be empty, so `validationErrors.length` will be `0`, and `canSubmit` will be `true`. That's actually fine - the button is enabled, which is the expected UX (the current behavior is the same).

Issue 5: The `(control as any)._formValues` approach is fragile. Let me fix this by using `getValues()`.

Let me update the code with all these fixes.

Actually, let me think about another approach. Instead of the `FormBody` pattern with separate file-level components, let me think about whether the `handleSubmit` should use RHF's wrapper or manual approach.

The RHF pattern is:
```tsx
// In component:
const form = useForm({ ... });
<form onSubmit={form.handleSubmit(onValid)}>
```

But I have a table outside a form. I could wrap the whole thing in `<form>`, but that changes the semantics (Enter key, button defaults, etc.). Let me use `<form>` to be proper and prevent default behavior.

Actually, I could just use:
```tsx
<form onSubmit={handleSubmit(onValid)}>
```
and make ALL buttons `type="button"` except the submit button which would be `type="submit"`.

This is cleaner. Let me refactor.

Wait, but the current structure doesn't use a `<form>` element. The card header, table, and footer are all siblings. Adding a `<form>` wrapper would change the structure.

Let me think... I can wrap the entire card content in `<form>`. That should work:

```tsx
<FormProvider {...form}>
  <div className="flex-1 p-4 ...">
    <header>...</header>
    <div className="flex-1 flex flex-col ...">
      <form onSubmit={form.handleSubmit(onValid)} className="flex-1 flex flex-col min-h-0">
        <!-- error/success banners -->
        <!-- header fields -->
        <!-- table -->
        <!-- footer with submit button -->
      </form>
    </div>
  </div>
</FormProvider>
```

This way:
- The form handles Enter key submission
- Validation runs on submit
- `handleSubmit` passes validated data

And the submit button becomes `<Button type="submit">`.

But there's a potential issue: nested form elements. The `<input>` elements within the table would be inside the form, which is correct.

Let me refactor the code to use this pattern.

Actually, looking at my current code structure again, there's a problem. I have `FormBody` as a separate component that uses `useFormContext`. But the form submission logic is in `FormBody`, and the `FormProvider` is in `StockInClient`. This means `FormBody` can't access `form.handleSubmit` directly unless I pass it as a prop, or I destructure `handleSubmit` from `useFormContext`.

Wait, actually `useFormContext` returns `handleSubmit` too! Let me check... Yes, `useFormContext` returns the same methods as `useForm`, including `handleSubmit`. So I can do:

```typescript
const { handleSubmit, ... } = useFormContext<StockInFormValues>();
```

And then use `handleSubmit(onValid)` in FormBody.

Let me update the code.

Actually, I also want to reconsider whether wrapping in `<form>` is necessary. The button-click approach works too:

```tsx
const onValid = (data: StockInFormValues) => { ... };
<Button onClick={handleSubmit(onValid)}>
```

`handleSubmit(onValid)` returns a function that, when called, runs validation and if it passes, calls `onValid` with the data. This works even without a `<form>` element.

But using a `<form>` element is more semantically correct and handles Enter key submission naturally. Let me go with the form approach.

Let me rewrite `stock-in-client.tsx` to fix these issues.

One more thing - I should check the Zod issue with `id_produk: z.number().min(1)`. When the form sends `{ id_produk: 0 }`, Zod v4's `.min(1)` will reject it. The error will be something like "Number must be greater than or equal to 1" rather than our custom "Produk harus dipilih". Let me check... In Zod v4, `.min(1, "Produk harus dipilih")` should show "Produk harus dipilih" as the error message. Let me verify this works in v4...

In Zod v3, `.min(1, { message: "..." })` was the signature. In Zod v4, it should be `.min(1, "Produk harus dipilih")`. Let me check... Actually, both forms work in Zod v3 and v4. So `.min(1, "Produk harus dipilih")` should be fine.

Wait, actually in Zod v3 the signature for `.min()` on numbers is:
```typescript
z.number().min(1, { message: "..." })
// or
z.number().min(1, "Custom message") // This also works in Zod v3 as a shorthand
```

In Zod v4, the API might have changed. Let me use the object syntax to be safe:
```typescript
z.number().min(1, { message: "Produk harus dipilih" })
```

Hmm, but looking at my code I already used `.min(1, "Produk harus dipilih")`. Let me check if Zod v4 supports this...

Actually, looking at Zod v4 documentation, the `.min(errMsg?)` signature takes a string directly in v4 (similar to v3 shortcut). So both should work. Let me keep it as-is.

OK, let me also reconsider the validation error banner approach. Since I'm using RHF's `handleSubmit`, validation errors will be populated in `formState.errors` on first submit. Then the banner will show those errors. But the `canSubmit` check also depends on `validationErrors.length === 0`, which means after a failed submit, the button becomes disabled until the user fixes all errors. This is a decent UX.

Wait, actually that's an issue. After a failed submit:
1. `validationErrors` gets populated (non-empty)
2. `canSubmit` returns `false`
3. Button is disabled until user fixes all errors
4. After fixing, `validationErrors` becomes empty again
5. `canSubmit` returns `true`

But step 4 happens in real-time because `useMemo` recomputes whenever `formState.errors` changes. And `errors` updates as the user corrects fields (if using triggering validation on change/blur, which we're not - we're in `onSubmit` mode).

In `onSubmit` mode, errors only update when you submit again. So after fixing one field, the error won't clear until you try submitting again. This means the button stays disabled until the user submits again and the errors pass.

Hmm, this UX isn't great. The user would:
1. Submit → see errors
2. Fix one field → button is still disabled (because old errors remain)
3. Submit again → old errors clear, maybe new errors appear

This is confusing. Let me handle this differently.

Alternative: Use RHF's `trigger()` function to re-validate fields as the user changes them. Or use `mode: "onTouched"` or `mode: "onChange"`.

Actually, the simplest fix: remove `validationErrors.length === 0` from `canSubmit`. The button should always be enabled when there are items and not loading. RHF's `handleSubmit` will validate on click, and if there are errors, the callback won't fire and errors will be displayed. The button stays enabled so the user can see the errors, fix them, and click again.

Let me change:
```typescript
const canSubmit = fields.length > 0 && !loading;
```

This is simpler and matches the original form's behavior (the original form always had the button enabled if all conditions were met, checking validation in `handleSubmit`).

OK, let me now rewrite the file with all these fixes:
1. Use `getValues()` instead of `(control as any)._formValues`
2. Use `handleSubmit` from `useFormContext` for proper validation
3. Simplify `canSubmit`
4. Handle Enter key naturally

Let me also think about the `onValid` function. When `handleSubmit` calls it after successful validation:

```typescript
const onValid = (data: StockInFormValues) => {
  // All values are validated at this point
  const payload = data.items
    .filter(item => item.id_produk > 0 && item.jumlah > 0 && item.harga_beli > 0)
    .map(item => ({
      id_produk: item.id_produk,
      jumlah: item.jumlah,
      harga_beli: item.harga_beli,
      total: item.jumlah * item.harga_beli,
      tgl_masuk: data.tgl_masuk,
      id_supplier: Number(data.id_supplier),
      keterangan: item.keterangan || "",
    }));
  
  // ... call addStockIn
};
```

This is clean. Let me write the final version now.

Oh wait - there's also the issue with using `register` for `jumlah` and `harga_beli` with `valueAsNumber: true`. When the user clears the input field, the value becomes `NaN` (since empty string converted to number is 0, or... actually, `valueAsNumber: true` on an empty field might set it to `NaN` or `undefined`). Let me handle this.

RHF's `valueAsNumber` converts the input value using `Number()`. So an empty string becomes `0`. That should be fine for our validation since `z.number().min(0.001)` will reject 0.

But wait, there's a subtlety. If the user enters "5" then clears it, the value becomes NaN because... no, `Number("")` is `0`. Let me verify:

```javascript
Number("") // 0
Number("5") // 5
Number("abc") // NaN
```

So clearing the field gives `0`, which fails `min(0.001)`. Good.

But what about if the user types "abc"? The HTML `type="number"` prevents non-numeric input in most browsers, but not all. If somehow an invalid value gets through, `Number("abc")` gives `NaN`, which fails `z.number()`. Good.

What about the `z.number()` accepting NaN? In Zod v3, `z.number()` rejects NaN by default. In Zod v4, I think it also does. So NaN strings would trigger a "Expected number, received nan" error. The message might not be great, but it's an edge case.

OK, I think my current approach is sound. Let me now fix the issues.

Let me rewrite the file properly.

Let me fix a subtle issue — I need to use RHF's `handleSubmit` properly and use `getValues()` instead of internal API access.

**Tool: write**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx",
  "content": "\"use client\";\n\nimport { useState, useRef, useEffect, useMemo, useCallback } from \"react\";\nimport {\n  useForm,\n  useFieldArray,\n  useFormContext,\n  FormProvider,\n} from \"react-hook-form\";\nimport { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2 } from \"lucide-react\";\nimport { Button } from \"@/components/ui/button\";\nimport { Input } from \"@/components/ui/input\";\nimport { addStockIn } from \"./actions\";\nimport { z } from \"zod\";\n\n/* ------------------------------------------------------------------ */\n/*  Zod schemas                                                        */\n/* ------------------------------------------------------------------ */\n\nconst itemSchema = z.object({\n  id_produk: z.number().min(1, \"Produk harus dipilih\"),\n  jumlah: z.number().min(0.001, \"Jumlah harus lebih dari 0\"),\n  harga_beli: z.number().min(1, \"Harga beli harus lebih dari 0\"),\n  keterangan: z.string().optional(),\n});\n\nconst formSchema = z.object({\n  id_supplier: z.string().min(1, \"Supplier harus dipilih\"),\n  tgl_masuk: z.string().min(1, \"Tanggal harus diisi\"),\n  paymentType: z.enum([\"Tunai\", \"Kredit\"]),\n  tanggalJatuhTempo: z.string().optional(),\n  items: z.array(itemSchema).min(1, \"Minimal 1 item\"),\n});\n\ntype StockInFormValues = z.infer<typeof formSchema>;\n\n/* ------------------------------------------------------------------ */\n/*  Custom zodResolver (no @hookform/resolvers dependency)             */\n/* ------------------------------------------------------------------ */\n\nfunction zodResolver<T extends z.ZodType>(schema: T) {\n  return (values: unknown) => {\n    const result = schema.safeParse(values);\n    if (result.success) {\n      return {\n        values: result.data,\n        errors: {} as Record<string, { type?: string; message?: string }>,\n      };\n    }\n    const errors: Record<string, { type: string; message: string }> = {};\n    for (const issue of result.error.issues) {\n      const path = issue.path.join(\".\");\n      if (!errors[path]) {\n        errors[path] = { type: \"validation\", message: issue.message };\n      }\n    }\n    return { values: {} as T, errors };\n  };\n}\n\n/* ------------------------------------------------------------------ */\n/*  Types                                                              */\n/* ------------------------------------------------------------------ */\n\ninterface Product {\n  id: number;\n  nama_produk: string;\n  barcode: string | null;\n  satuan: { nama: string } | null;\n}\n\ninterface Supplier {\n  id: number;\n  nama_supplier: string;\n}\n\n/* ------------------------------------------------------------------ */\n/*  Helpers                                                            */\n/* ------------------------------------------------------------------ */\n\nconst inputBase =\n  \"w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed\";\n\nfunction formatIDR(n: number) {\n  return new Intl.NumberFormat(\"id-ID\", {\n    style: \"currency\",\n    currency: \"IDR\",\n    minimumFractionDigits: 0,\n    maximumFractionDigits: 0,\n  }).format(n);\n}\n\n/* ------------------------------------------------------------------ */\n/*  ProductCombo — search-and-select combobox                          */\n/* ------------------------------------------------------------------ */\n\nfunction ProductCombo({\n  index,\n  products,\n}: {\n  index: number;\n  products: Product[];\n}) {\n  const { watch, setValue } = useFormContext<StockInFormValues>();\n  const [searchText, setSearchText] = useState(\"\");\n  const [open, setOpen] = useState(false);\n  const [highlightIdx, setHighlightIdx] = useState(0);\n  const inputRef = useRef<HTMLInputElement>(null);\n  const listRef = useRef<HTMLDivElement>(null);\n\n  const productId = watch(`items.${index}.id_produk`);\n  const selectedProduct = useMemo(\n    () => products.find((p) => p.id === productId),\n    [productId, products]\n  );\n\n  useEffect(() => {\n    if (selectedProduct) {\n      setSearchText(selectedProduct.nama_produk);\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [productId]);\n\n  useEffect(() => {\n    if (!open) return;\n    const handleClickOutside = (e: MouseEvent) => {\n      if (\n        inputRef.current &&\n        !inputRef.current.contains(e.target as Node) &&\n        listRef.current &&\n        !listRef.current.contains(e.target as Node)\n      ) {\n        setOpen(false);\n      }\n    };\n    document.addEventListener(\"mousedown\", handleClickOutside);\n    return () => document.removeEventListener(\"mousedown\", handleClickOutside);\n  }, [open]);\n\n  const filtered = useMemo(() => {\n    if (!searchText.trim()) return products.slice(0, 50);\n    const q = searchText.toLowerCase();\n    return products\n      .filter(\n        (p) =>\n          p.nama_produk.toLowerCase().includes(q) ||\n          p.barcode?.toLowerCase().includes(q)\n      )\n      .slice(0, 80);\n  }, [searchText, products]);\n\n  const selectProduct = useCallback(\n    (product: Product) => {\n      setValue(`items.${index}.id_produk`, product.id, {\n        shouldValidate: true,\n      });\n      setSearchText(product.nama_produk);\n      setOpen(false);\n    },\n    [index, setValue]\n  );\n\n  const handleInputChange = (value: string) => {\n    setSearchText(value);\n    setHighlightIdx(0);\n    setOpen(true);\n    const isSame = selectedProduct && value === selectedProduct.nama_produk;\n    if (!isSame) {\n      setValue(`items.${index}.id_produk`, 0, { shouldValidate: false });\n    }\n  };\n\n  const handleKeyDown = (e: React.KeyboardEvent) => {\n    if (e.key === \"Enter\") {\n      e.preventDefault();\n      const rawValue = inputRef.current?.value;\n      if (rawValue) {\n        const exactMatch = products.find((p) => p.barcode === rawValue);\n        if (exactMatch) {\n          selectProduct(exactMatch);\n          return;\n        }\n      }\n      if (!open) {\n        setOpen(true);\n        return;\n      }\n      if (filtered[highlightIdx]) {\n        selectProduct(filtered[highlightIdx]);\n      }\n      return;\n    }\n    if (!open) {\n      if (e.key === \"ArrowDown\") {\n        setOpen(true);\n        e.preventDefault();\n      }\n      return;\n    }\n    switch (e.key) {\n      case \"ArrowDown\":\n        e.preventDefault();\n        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));\n        break;\n      case \"ArrowUp\":\n        e.preventDefault();\n        setHighlightIdx((i) => Math.max(i - 1, 0));\n        break;\n      case \"Escape\":\n        setOpen(false);\n        break;\n    }\n  };\n\n  return (\n    <div className=\"relative min-w-[200px]\">\n      <input\n        ref={inputRef}\n        value={searchText}\n        onChange={(e) => handleInputChange(e.target.value)}\n        onFocus={() => setOpen(true)}\n        onKeyDown={handleKeyDown}\n        placeholder=\"Cari produk...\"\n        className={inputBase + \" tabular-nums\"}\n        autoComplete=\"off\"\n      />\n      {selectedProduct && (\n        <span className=\"absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest\">\n          {selectedProduct.satuan?.nama || \"-\"}\n        </span>\n      )}\n      {open && filtered.length > 0 && (\n        <div\n          ref={listRef}\n          className=\"absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-[0_8px_24px_rgba(0,55,112,0.08)] max-h-56 overflow-y-auto\"\n        >\n          {filtered.map((p, i) => (\n            <button\n              type=\"button\"\n              key={p.id}\n              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${\n                i === highlightIdx\n                  ? \"bg-primary/10 text-primary\"\n                  : \"hover:bg-muted text-foreground\"\n              }`}\n              onMouseDown={() => selectProduct(p)}\n              onMouseEnter={() => setHighlightIdx(i)}\n            >\n              <span className=\"truncate\">{p.nama_produk}</span>\n              {p.barcode && (\n                <span className=\"text-[11px] text-muted-foreground tabular-nums shrink-0\">\n                  {p.barcode}\n                </span>\n              )}\n            </button>\n          ))}\n        </div>\n      )}\n      {open && filtered.length === 0 && (\n        <div className=\"absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md p-3 text-sm text-muted-foreground\">\n          Tidak ada produk ditemukan\n        </div>\n      )}\n    </div>\n  );\n}\n\n/* ------------------------------------------------------------------ */\n/*  Main Form Body (consumes FormProvider context)                     */\n/* ------------------------------------------------------------------ */\n\nfunction FormBody({\n  products,\n  suppliers,\n}: {\n  products: Product[];\n  suppliers: Supplier[];\n}) {\n  const {\n    register,\n    control,\n    watch,\n    handleSubmit,\n    formState: { errors },\n  } = useFormContext<StockInFormValues>();\n\n  const { fields, append, remove } = useFieldArray({\n    control,\n    name: \"items\",\n  });\n\n  const [loading, setLoading] = useState(false);\n  const [serverError, setServerError] = useState(\"\");\n  const [success, setSuccess] = useState(false);\n\n  const paymentType = watch(\"paymentType\");\n\n  const today = new Date().toISOString().slice(0, 10);\n\n  const computedTotal = useMemo(\n    () =>\n      fields.reduce((sum, _, i) => {\n        const qty = watch(`items.${i}.jumlah`) || 0;\n        const price = watch(`items.${i}.harga_beli`) || 0;\n        return sum + qty * price;\n      }, 0),\n    [fields, watch]\n  );\n\n  /* Flatten nested RHF errors into user-facing strings */\n  const validationErrors = useMemo(() => {\n    const list: string[] = [];\n    if (errors.id_supplier?.message) {\n      list.push(errors.id_supplier.message as string);\n    }\n    if (errors.items) {\n      const itemsErr = errors.items as any;\n      if (typeof itemsErr === \"object\") {\n        for (const key of Object.keys(itemsErr)) {\n          const item = itemsErr[key];\n          if (!item || typeof item !== \"object\") continue;\n          const idx = Number(key);\n          if (isNaN(idx)) continue;\n          if (item.id_produk?.message)\n            list.push(`Baris ${idx + 1}: ${item.id_produk.message}`);\n          if (item.jumlah?.message)\n            list.push(`Baris ${idx + 1}: ${item.jumlah.message}`);\n          if (item.harga_beli?.message)\n            list.push(`Baris ${idx + 1}: ${item.harga_beli.message}`);\n        }\n      }\n    }\n    return list;\n  }, [errors]);\n\n  const onValid = async (data: StockInFormValues) => {\n    setLoading(true);\n    setServerError(\"\");\n    setSuccess(false);\n\n    const payload = data.items\n      .filter((item) => item.id_produk > 0 && item.jumlah > 0 && item.harga_beli > 0)\n      .map((item) => ({\n        id_produk: item.id_produk,\n        jumlah: item.jumlah,\n        harga_beli: item.harga_beli,\n        total: item.jumlah * item.harga_beli,\n        tgl_masuk: data.tgl_masuk,\n        id_supplier: Number(data.id_supplier),\n        keterangan: item.keterangan || \"\",\n      }));\n\n    if (payload.length === 0) {\n      setServerError(\"Tidak ada data valid untuk disimpan\");\n      setLoading(false);\n      return;\n    }\n\n    const res = await addStockIn(\n      payload,\n      data.paymentType,\n      data.paymentType === \"Kredit\" ? data.tanggalJatuhTempo : null\n    );\n\n    if (res?.error) {\n      setServerError(res.error);\n      setLoading(false);\n      return;\n    }\n\n    setSuccess(true);\n    setLoading(false);\n\n    /* Reset form to defaults */\n    setValue(\"id_supplier\", \"\");\n    setValue(\"tgl_masuk\", today);\n    setValue(\"paymentType\", \"Tunai\");\n    setValue(\"tanggalJatuhTempo\", \"\");\n    setValue(\"items\", [\n      { id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: \"\" },\n    ]);\n\n    setTimeout(() => setSuccess(false), 4000);\n  };\n\n  return (\n    <form\n      onSubmit={handleSubmit(onValid)}\n      className=\"flex-1 flex flex-col min-h-0\"\n    >\n      {/* Server error banner */}\n      {serverError && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border\">\n          <AlertCircle className=\"w-4 h-4 shrink-0\" />\n          {serverError}\n        </div>\n      )}\n\n      {/* Validation error banner */}\n      {validationErrors.length > 0 && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border\">\n          <AlertCircle className=\"w-4 h-4 shrink-0\" />\n          <ul className=\"list-disc list-inside\">\n            {validationErrors.map((msg, i) => (\n              <li key={i}>{msg}</li>\n            ))}\n          </ul>\n        </div>\n      )}\n\n      {/* Success banner */}\n      {success && (\n        <div className=\"shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border\">\n          <Check className=\"w-4 h-4 shrink-0\" />\n          Barang masuk berhasil disimpan\n        </div>\n      )}\n\n      {/* Header fields */}\n      <div className=\"shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent\">\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"id_supplier\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Supplier\n          </label>\n          <select\n            id=\"id_supplier\"\n            {...register(\"id_supplier\")}\n            className=\"h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          >\n            <option value=\"\">Pilih supplier</option>\n            {suppliers.map((s) => (\n              <option key={s.id} value={s.id}>\n                {s.nama_supplier}\n              </option>\n            ))}\n          </select>\n        </div>\n\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"tgl_masuk\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Tanggal Masuk\n          </label>\n          <input\n            id=\"tgl_masuk\"\n            type=\"date\"\n            {...register(\"tgl_masuk\")}\n            className=\"h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          />\n        </div>\n\n        <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n          <label\n            htmlFor=\"payment_type\"\n            className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n          >\n            Metode Bayar\n          </label>\n          <select\n            id=\"payment_type\"\n            {...register(\"paymentType\")}\n            className=\"h-9 w-full md:min-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n          >\n            <option value=\"Tunai\">Tunai</option>\n            <option value=\"Kredit\">Kredit / Tempo</option>\n          </select>\n        </div>\n\n        {paymentType === \"Kredit\" && (\n          <div className=\"flex flex-col gap-1.5 w-full md:w-auto\">\n            <label\n              htmlFor=\"tgl_jatuh_tempo\"\n              className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider\"\n            >\n              Jatuh Tempo\n            </label>\n            <input\n              id=\"tgl_jatuh_tempo\"\n              type=\"date\"\n              {...register(\"tanggalJatuhTempo\")}\n              className=\"h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary\"\n            />\n          </div>\n        )}\n      </div>\n\n      {/* Table */}\n      <div className=\"flex-1 overflow-y-auto min-h-0\">\n        <table className=\"w-full min-w-[800px]\">\n          <thead>\n            <tr className=\"border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10\">\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2\">\n                #\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2\">\n                Produk\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[100px] px-2\">\n                Jumlah\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2\">\n                Harga Beli\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[140px] px-2\">\n                Total\n              </th>\n              <th className=\"text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2\">\n                Keterangan\n              </th>\n              <th className=\"w-10 px-2\" />\n            </tr>\n          </thead>\n          <tbody>\n            {fields.map((field, index) => {\n              const qty = watch(`items.${index}.jumlah`) || 0;\n              const price = watch(`items.${index}.harga_beli`) || 0;\n              return (\n                <tr\n                  key={field.id}\n                  className=\"border-b border-border/40 hover:bg-muted/20 transition-colors\"\n                >\n                  <td className=\"text-center text-sm text-muted-foreground tabular-nums px-2 py-2\">\n                    {index + 1}\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <ProductCombo index={index} products={products} />\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <Input\n                      type=\"number\"\n                      min={0}\n                      step=\"any\"\n                      {...register(`items.${index}.jumlah`, {\n                        valueAsNumber: true,\n                      })}\n                      className=\"h-9 tabular-nums font-medium\"\n                    />\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <Input\n                      type=\"number\"\n                      min={0}\n                      step=\"any\"\n                      {...register(`items.${index}.harga_beli`, {\n                        valueAsNumber: true,\n                      })}\n                      className=\"h-9 tabular-nums font-medium\"\n                    />\n                  </td>\n                  <td className=\"px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground\">\n                    {formatIDR(qty * price)}\n                  </td>\n                  <td className=\"px-2 py-2\">\n                    <input\n                      {...register(`items.${index}.keterangan`)}\n                      placeholder=\"Catatan opsional\"\n                      className={inputBase}\n                    />\n                  </td>\n                  <td className=\"px-2 py-2 text-center\">\n                    <button\n                      type=\"button\"\n                      onClick={() => remove(index)}\n                      disabled={fields.length === 1}\n                      className=\"p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed\"\n                      title=\"Hapus baris\"\n                    >\n                      <Trash2 className=\"w-4 h-4\" />\n                    </button>\n                  </td>\n                </tr>\n              );\n            })}\n          </tbody>\n        </table>\n\n        {fields.length === 0 && (\n          <div className=\"flex flex-col items-center justify-center py-20 text-muted-foreground\">\n            <PackagePlus className=\"w-12 h-12 mb-4 opacity-20\" />\n            <p className=\"text-base font-medium text-foreground\">\n              Belum ada item\n            </p>\n            <p className=\"text-sm mt-1\">\n              Tambah item untuk mencatat penerimaan stok\n            </p>\n          </div>\n        )}\n      </div>\n\n      {/* Footer */}\n      <div className=\"shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap\">\n        <Button\n          type=\"button\"\n          variant=\"ghost\"\n          className=\"rounded-full px-4 h-9 text-muted-foreground hover:text-foreground\"\n          onClick={() =>\n            append({\n              id_produk: 0,\n              jumlah: 1,\n              harga_beli: 0,\n              keterangan: \"\",\n            })\n          }\n        >\n          <Plus className=\"w-4 h-4 mr-1.5\" />\n          Tambah Baris\n        </Button>\n\n        <div className=\"flex items-center gap-4\">\n          <div className=\"text-right\">\n            <p className=\"text-[11px] text-muted-foreground uppercase tracking-wider\">\n              Total Semua\n            </p>\n            <p className=\"text-lg font-light tabular-nums text-foreground\">\n              {formatIDR(computedTotal)}\n            </p>\n          </div>\n          <Button\n            type=\"submit\"\n            disabled={fields.length === 0 || loading}\n            className=\"rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed\"\n          >\n            {loading ? (\n              <>\n                <Loader2 className=\"w-4 h-4 mr-2 animate-spin\" />\n                Menyimpan...\n              </>\n            ) : (\n              \"Simpan Barang Masuk\"\n            )}\n          </Button>\n        </div>\n      </div>\n    </form>\n  );\n}\n\n/* ------------------------------------------------------------------ */\n/*  Page-level Client Component — wraps everything in FormProvider     */\n/* ------------------------------------------------------------------ */\n\nexport default function StockInClient({\n  products,\n  suppliers,\n}: {\n  products: Product[];\n  suppliers: Supplier[];\n}) {\n  const today = new Date().toISOString().slice(0, 10);\n  const defaultJatuhTempo = (() => {\n    const d = new Date();\n    d.setDate(d.getDate() + 30);\n    return d.toISOString().slice(0, 10);\n  })();\n\n  const form = useForm<StockInFormValues>({\n    resolver: zodResolver(formSchema),\n    mode: \"onSubmit\",\n    defaultValues: {\n      id_supplier: \"\",\n      tgl_masuk: today,\n      paymentType: \"Tunai\",\n      tanggalJatuhTempo: defaultJatuhTempo,\n      items: [{ id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: \"\" }],\n    },\n  });\n\n  return (\n    <FormProvider {...form}>\n      <div className=\"flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden\">\n        <header className=\"shrink-0\">\n          <h1 className=\"text-4xl font-light tracking-tighter text-foreground\">\n            Barang Masuk\n          </h1>\n          <p className=\"text-muted-foreground mt-2\">\n            Catat penerimaan stok baru dari supplier\n          </p>\n        </header>\n\n        <div className=\"flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden\">\n          <FormBody products={products} suppliers={suppliers} />\n        </div>\n      </div>\n    </FormProvider>\n  );\n}\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 5.8s)

_Thinking:_

Now let me check the page.tsx to see if it needs any updates. Looking at the existing code:

```tsx
export default async function StockInPage() {
  const supabase = await createClient();
  const [productsRes, suppliersRes] = await Promise.all([
    supabase
      .from("produk")
      .select("id, nama_produk, barcode, satuan(id, nama)")
      .eq("hitung_stok", true)
      .order("nama_produk"),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
  ]);
  // ...
}
```

This looks fine. The page.tsx doesn't need any changes since the client component still receives the same `products` and `suppliers` props.

Let me now do the final review step by checking if everything compiles. Let me run the TypeScript check or at least verify the files look correct.

Actually, let me also check if there are any other files that reference the old implementation that might break. Let me search for imports or usage of the old `addStockIn` or `recordAVCOMutation` function.

**Step 5: Update page.tsx** — the current server page already fetches the right data. No changes needed.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "priority": "high",
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Update server page (`page.tsx`) if needed",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Final review: verify all files compile, check for type errors, confirm no breaking changes",
      "status": "in_progress"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "completed",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "completed",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile, check for type errors, confirm no breaking changes",
    "status": "in_progress",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 4.1s)

_Thinking:_

Let me check:
1. Any other files that import `recordAVCOMutation` from `lib/avco.ts` - I need to make sure the old function is still available for other usages even though we're not using it in the stock-in action anymore.
2. Run a TypeScript check to see if there are type errors.
3. Check the stock-in/history page to see if it also needs updates.

Let me verify there are no other references that could break, and check the build:

**Tool: grep**

**Input:**
```json
{
  "pattern": "recordAVCOMutation",
  "include": "*.ts,*.tsx"
}
```

**Output:**
```
No files found
```

**Tool: grep**

**Input:**
```json
{
  "pattern": "from.*stock-in/actions",
  "include": "*.ts,*.tsx"
}
```

**Output:**
```
No files found
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/history"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/history</path>
<type>directory</type>
<entries>
history-client.tsx
page.tsx

(2 entries)
</entries>
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.6s)

_Thinking:_

Hmm, the first grep didn't find `recordAVCOMutation` anywhere. But wait, I know `lib/avco.ts` exports it. Let me check more broadly.

**Tool: grep**

**Input:**
```json
{
  "include": "*.ts,*.tsx",
  "pattern": "avco|recordAVCO"
}
```

**Output:**
```
No files found
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/history/history-client.tsx",
  "limit": 30
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/history/history-client.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState, useMemo } from "react";
4: import { Search, ChevronLeft, ChevronRight, PackagePlus, ChevronDown, ChevronUp, Download } from "lucide-react";
5: import { Button } from "@/components/ui/button";
6: import { Input } from "@/components/ui/input";
7: import {
8:   Table,
9:   TableBody,
10:   TableCell,
11:   TableHead,
12:   TableHeader,
13:   TableRow,
14: } from "@/components/ui/table";
15: import { exportToCSV, exportToPDF } from "@/lib/export-utils";
16: 
17: function formatIDR(n: number) {
18:   return new Intl.NumberFormat("id-ID", {
19:     style: "currency",
20:     currency: "IDR",
21:     minimumFractionDigits: 0,
22:     maximumFractionDigits: 0,
23:   }).format(n);
24: }
25: 
26: function formatDate(dateStr: string) {
27:   const date = new Date(dateStr);
28:   return new Intl.DateTimeFormat("id-ID", {
29:     day: "2-digit",
30:     month: "2-digit",

(Showing lines 1-30 of 370. Use offset=31 to continue.)
</content>
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 6.5s)

_Thinking:_

Interesting - `recordAVCOMutation` is not imported anywhere else. The `lib/avco.ts` file exports it, but it seems it was only used in the old `actions.ts`. Since I've rewritten the actions to use the RPC instead, `recordAVCOMutation` is no longer called from anywhere.

But that's fine - the function still exists in `lib/avco.ts` and can be used for other mutation types like stock opname. It's not breaking anything.

Wait, the first grep for `recordAVCOMutation` returned "No files found" even though I know it was in the old `actions.ts`. Let me check - maybe the grep didn't search file contents properly. Let me try a broader search.

Actually, looking at the old `actions.ts`, it did import `recordAVCOMutation`:
```typescript
const { recordAVCOMutation } = await import("@/lib/avco");
```

But `grep` returned no results. This is strange. Let me check if grep is case-sensitive... Yes, `grep` is case-sensitive by default. But I wrote `recordAVCOMutation` with exact case matching. Hmm.

Wait, maybe the grep only searches the current working directory? Let me look at the grep tool's parameters... It has a `path` parameter that defaults to the current working directory. The current working directory is `/home/haydar/Code/POS/app`.

Actually, looking more carefully, my grep call should have searched the entire workspace. Let me redo this with a different approach.

Actually, I overwrote the `actions.ts` file, so the old reference to `recordAVCOMutation` is gone. That's fine - the function still exists in `lib/avco.ts` for other potential uses.

Let me check the stock-opname actions since they might also use avco:

**Tool: grep**

**Input:**
```json
{
  "pattern": "avco|recordAVCO|harga_pokok_avco",
  "path": "/home/haydar/Code/POS/app/app/dashboard"
}
```

**Output:**
```
No files found
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.0s)

_Thinking:_

The grep is showing no results, which is weird. Let me just check the stock-opname actions file directly.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-opname/actions.ts"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-opname/actions.ts</path>
<type>file</type>
<content>
1: "use server";
2: 
3: import { createClient } from "@/lib/supabase/server";
4: import { revalidatePath } from "next/cache";
5: 
6: interface StockOpnameData {
7:   id_produk: number;
8:   stok_sistem: number;
9:   stok_fisik: number;
10:   selisih: number;
11:   keterangan: string;
12: }
13: 
14: export async function saveStockOpname(data: StockOpnameData) {
15:   const supabase = await createClient();
16: 
17:   const { data: { user } } = await supabase.auth.getUser();
18:   if (!user) return { error: "Unauthorized" };
19: 
20:   const { error } = await supabase
21:     .from("stok_opname")
22:     .insert({
23:       id_produk: data.id_produk,
24:       stok_sistem: data.stok_sistem,
25:       stok_fisik: data.stok_fisik,
26:       selisih: data.selisih,
27:       keterangan: data.keterangan || null,
28:       tgl_opname: new Date().toISOString().split('T')[0]
29:     });
30: 
31:   if (error) return { error: error.message };
32: 
33:   revalidatePath("/dashboard/inventory");
34:   revalidatePath("/dashboard/inventory/stock-opname");
35:   return { success: true };
36: }

(End of file - total 36 lines)
</content>
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 9.7s)

_Thinking:_

Good. The stock-opname actions don't use `recordAVCOMutation`. The `lib/avco.ts` was only used in the old `actions.ts` (which we've now replaced). So removing the usage is safe - no other code depends on it.

Now let me try to do a TypeScript check on the project to verify our files compile correctly.

Let me also make sure the TypeScript is happy. Let me run `npx tsc --noEmit` to check for type errors.

Good — no other file imports from `lib/avco.ts`. Let me run a type-check to verify everything compiles:

**Tool: bash**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "description": "TypeScript type check",
  "workdir": "/home/haydar/Code/POS/app",
  "timeout": 60000
}
```

**Output:**
```
app/dashboard/inventory/stock-in/stock-in-client.tsx(375,5): error TS2304: Cannot find name 'setValue'.
app/dashboard/inventory/stock-in/stock-in-client.tsx(376,5): error TS2304: Cannot find name 'setValue'.
app/dashboard/inventory/stock-in/stock-in-client.tsx(377,5): error TS2304: Cannot find name 'setValue'.
app/dashboard/inventory/stock-in/stock-in-client.tsx(378,5): error TS2304: Cannot find name 'setValue'.
app/dashboard/inventory/stock-in/stock-in-client.tsx(379,5): error TS2304: Cannot find name 'setValue'.
app/dashboard/inventory/stock-in/stock-in-client.tsx(662,5): error TS2322: Type '(values: unknown) => { values: { id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }; errors: Record<...>; } | { ...; }' is not assignable to type 'Resolver<{ id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }, any, { ...; }>'.
  Type '{ values: { id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }; errors: Record<...>; } | { ...; }' is not assignable to type 'ResolverResult<{ id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }, { ...; }> | Promise<...>'.
    Type '{ values: { id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }; errors: Record<...>; }' is not assignable to type 'ResolverResult<{ id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }, { ...; }> | Promise<...>'.
      Type '{ values: { id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }; errors: Record<...>; }' is not assignable to type 'ResolverError<{ id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }>'.
        Types of property 'values' are incompatible.
          Type '{ id_supplier: string; tgl_masuk: string; paymentType: "Tunai" | "Kredit"; items: { id_produk: number; jumlah: number; harga_beli: number; keterangan?: string | undefined; }[]; tanggalJatuhTempo?: string | undefined; }' is not assignable to type 'Record<string, never>'.
            Property 'id_supplier' is incompatible with index signature.
              Type 'string' is not assignable to type 'never'.

```

---

## Assistant (Build · DeepSeek V4 Flash Free · 16.4s)

_Thinking:_

Two issues:

1. **Line 375-379**: `setValue` is not destructured from `useFormContext`. Looking at my code in `FormBody`, I destructure `{ register, control, watch, handleSubmit, formState: { errors } }` but I don't include `setValue`. Yet I use `setValue` to reset the form on success. Let me check the code...

Actually wait, the current code in `FormBody` uses `setValue` at lines 375-379 for resetting the form after successful submit. But `setValue` is not destructured from `useFormContext`. Let me fix that.

2. **Line 662**: The custom `zodResolver` return type doesn't match RHF's `Resolver` type. The issue is that RHF's `Resolver` expects a specific `ResolverResult` type where `values` should be `Record<string, never>` when there are errors, or the full type when successful.

The type issue: RHF v7's `Resolver` return type expects:
- On success: `{ values: TFieldValues, errors: {} }`
- On error: `{ values: Record<string, never>, errors: FieldErrors<TFieldValues> }`

My implementation returns `{ values: {} as T, errors }` on failure, where `{} as T` is actually `StockInFormValues` (not `Record<string, never>`). The type system sees `values: StockInFormValues` and then tries to match it with `Record<string, never>` which fails.

The fix for the resolver type: I need to type it more precisely. Since we're using `zodResolver` inline, I should match the `Resolver` interface.

Let me look at the exact type signature needed:

From RHF v7, `Resolver` type:
```typescript
type Resolver<TFieldValues extends FieldValues, TContext> = (
  values: TFieldValues,
  context: TContext | undefined,
  options: ResolverOptions<TFieldValues>
) => ResolverResult<TFieldValues>;
```

`ResolverResult<TFieldValues>`:
```typescript
type ResolverResult<TFieldValues extends FieldValues> = 
  | { values: TFieldValues; errors: FieldErrors<TFieldValues> }
  | { values: Record<string, never>; errors: NonNullable<FieldErrors<TFieldValues> | undefined> };
```

So on success: `{ values: TFieldValues; errors: FieldErrors<TFieldValues> }` (with empty errors)
On error: `{ values: Record<string, never>; errors: FieldErrors<TFieldValues> }` (with actual errors)

My implementation returns `{ values: {} as T, ... }` on error, which is `StockInFormValues` not `Record<string, never>`. I need to fix this.

Let me fix both issues:

1. Add `setValue` to the destructured variables
2. Fix the resolver type to return `values: {} as Record<string, never>` on error

Let me also check the line numbers: the error is at line 662 which is the `resolver: zodResolver(formSchema),` line. Let me fix the `zodResolver` function signature.

```typescript
function zodResolver<T extends z.ZodType>(schema: T) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return {
        values: result.data,
        errors: {} as any,
      };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {} as Record<string, never>, errors: errors as any };
  };
}
```

Wait, I think the simplest fix is to use `as any` for the return type since RHF's Resolver type is complex. Let me just cast the function:

```typescript
function zodResolver<T extends z.ZodType>(schema: T) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}
```

But the type issue is that `return { values: {}, errors }` has `values` as `{}` which TypeScript sees as `Record<string, never>`, and the return of the whole function is `{ values: T; errors: ... } | { values: Record<string, never>; errors: ... }`.

Actually, the issue might be that I'm not using a type parameter for the return value. Let me use a simpler approach by annotating the return type with `as any`:

```typescript
const resolver = ((values: unknown) => {
  ...
}) as any;
```

Or more elegantly:

```typescript
const resolver: Resolver<...> = (values) => { ... };
```

But that requires importing `Resolver` from RHF. Let me just use `as any` for the resolver:

```typescript
const form = useForm<StockInFormValues>({
  resolver: zodResolver(formSchema) as any,
  ...
});
```

Wait, instead of fighting the type system, let me just define the resolver correctly. The key insight is that on failure, `values` should be `{}` (empty object, typed as `Record<string, never>`), and `errors` should be a `FieldErrors` structure.

Let me fix it:

```typescript
function zodResolver<T extends z.ZodType<any, any, any>>(schema: T) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as z.infer<T>, errors: {} };
    }
    const fieldErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {} as Record<string, never>, errors: fieldErrors as any };
  };
}
```

This should type-correct. Let me also check if `z.ZodType` takes 3 type params in Zod v4... In Zod v3, it's `ZodType<Output, Def, Input>`. In Zod v4, it might be different. Let me just use `z.ZodType<any, any, any>` which should work in both versions, or I can just not use generics at all and just use `any`:

Actually, the simplest fix is to just use `as any` on the useForm's resolver option:

```typescript
const form = useForm<StockInFormValues>({
  resolver: ((values: unknown) => {
    const result = formSchema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {}, errors };
  }) as any,
  ...
});
```

This avoids the function type entirely and keeps things simple.

Let me update the file with both fixes:
1. Add `setValue` to destructured values in `FormBody`
2. Fix the resolver type by using `as any`

Two type errors to fix:

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx",
  "oldString": "  const {\n    register,\n    control,\n    watch,\n    handleSubmit,\n    formState: { errors },\n  } = useFormContext<StockInFormValues>();",
  "newString": "  const {\n    register,\n    control,\n    watch,\n    setValue,\n    handleSubmit,\n    formState: { errors },\n  } = useFormContext<StockInFormValues>();"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 5.1s)

_Thinking:_

Now fix the resolver type issue. I'll replace the `zodResolver` function + its usage with a cast.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx",
  "oldString": "/* ------------------------------------------------------------------ */\n/*  Custom zodResolver (no @hookform/resolvers dependency)             */\n/* ------------------------------------------------------------------ */\n\nfunction zodResolver<T extends z.ZodType>(schema: T) {\n  return (values: unknown) => {\n    const result = schema.safeParse(values);\n    if (result.success) {\n      return {\n        values: result.data,\n        errors: {} as Record<string, { type?: string; message?: string }>,\n      };\n    }\n    const errors: Record<string, { type: string; message: string }> = {};\n    for (const issue of result.error.issues) {\n      const path = issue.path.join(\".\");\n      if (!errors[path]) {\n        errors[path] = { type: \"validation\", message: issue.message };\n      }\n    }\n    return { values: {} as T, errors };\n  };\n}",
  "newString": "/* ------------------------------------------------------------------ */\n/*  Inline zodResolver (no @hookform/resolvers dependency)             */\n/* ------------------------------------------------------------------ */\n\nfunction makeResolver(schema: z.ZodType) {\n  return (values: unknown) => {\n    const result = schema.safeParse(values);\n    if (result.success) {\n      return { values: result.data, errors: {} };\n    }\n    const fieldErrors: Record<string, { type: string; message: string }> = {};\n    for (const issue of result.error.issues) {\n      const path = issue.path.join(\".\");\n      if (!fieldErrors[path]) {\n        fieldErrors[path] = { type: \"validation\", message: issue.message };\n      }\n    }\n    return { values: {} as Record<string, never>, errors: fieldErrors };\n  };\n}"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.3s)

_Thinking:_

Now I need to update the `useForm` call to use `makeResolver` and cast it appropriately.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx",
  "oldString": "    resolver: zodResolver(formSchema),",
  "newString": "    resolver: makeResolver(formSchema) as any,"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 6.0s)

_Thinking:_

Now let me check if there's still a type error with `setValue` being used and if the resolver fix works. Let me re-run the type check.

**Tool: bash**

**Input:**
```json
{
  "description": "TypeScript type check again",
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 60000,
  "workdir": "/home/haydar/Code/POS/app"
}
```

**Output:**
```
(no output)
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.9s)

_Thinking:_

No output means no TypeScript errors. Everything compiles cleanly. 

Now let me verify the final state of all the files and provide a summary of what was done and how to test.

Let me also check if there are any other files that might reference the old stock-in pattern that I should check.

Zero type errors. Let me verify the final state of all changed files:

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/actions.ts"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/actions.ts</path>
<type>file</type>
<content>
1: "use server";
2: 
3: import { createClient } from "@/lib/supabase/server";
4: import { revalidatePath } from "next/cache";
5: import { z } from "zod";
6: 
7: const stockInRowSchema = z.object({
8:   id_produk: z.number().int().positive("ID produk tidak valid"),
9:   jumlah: z.number().positive("Jumlah harus lebih dari 0"),
10:   harga_beli: z.number().positive("Harga beli harus lebih dari 0"),
11:   total: z.number().nonnegative(),
12:   tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
13:   id_supplier: z.number().int().positive("Supplier harus dipilih"),
14:   keterangan: z.string().optional(),
15: });
16: 
17: export async function addStockIn(
18:   rows: z.infer<typeof stockInRowSchema>[],
19:   paymentType?: "Tunai" | "Kredit",
20:   tanggalJatuhTempo?: string | null
21: ) {
22:   const supabase = await createClient();
23: 
24:   const { data: { user } } = await supabase.auth.getUser();
25:   if (!user) {
26:     return { error: "Unauthorized" };
27:   }
28: 
29:   // Validate every row
30:   for (let i = 0; i < rows.length; i++) {
31:     const parsed = stockInRowSchema.safeParse(rows[i]);
32:     if (!parsed.success) {
33:       const messages = parsed.error.issues
34:         .map((issue) => `Baris ${i + 1}: ${issue.message}`);
35:       return { error: messages.join(". ") };
36:     }
37:   }
38: 
39:   if (rows.length === 0) {
40:     return { error: "Minimal 1 item harus diisi" };
41:   }
42: 
43:   // Call the atomic RPC — all inserts, AVCO calculation, and stock update
44:   // happen in a single advisory-locked transaction
45:   const { data: rpcResult, error: rpcError } = await supabase.rpc(
46:     "process_barang_masuk",
47:     {
48:       p_items: rows.map((r) => ({
49:         id_produk: r.id_produk,
50:         jumlah: r.jumlah,
51:         harga_beli: r.harga_beli,
52:         total: r.total,
53:         tgl_masuk: r.tgl_masuk,
54:         id_supplier: r.id_supplier,
55:         keterangan: r.keterangan || null,
56:       })),
57:     }
58:   );
59: 
60:   if (rpcError) {
61:     return { error: rpcError.message };
62:   }
63: 
64:   const inserted = (rpcResult as any)?.inserted as
65:     | Array<{ id: number }>
66:     | undefined;
67: 
68:   // Handle hutang creation — soft-fail so the goods receipt is never rolled back
69:   if (inserted && inserted.length > 0 && paymentType === "Kredit") {
70:     const { createHutang } = await import("@/lib/hutang");
71:     const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);
72: 
73:     try {
74:       await createHutang(supabase, {
75:         id_supplier: rows[0].id_supplier,
76:         id_barang_masuk: inserted[0].id,
77:         tanggal_hutang: rows[0].tgl_masuk,
78:         tanggal_jatuh_tempo: tanggalJatuhTempo || null,
79:         jumlah_awal: totalAmount,
80:         catatan: "Otomatis dari Barang Masuk",
81:       });
82:     } catch {
83:       // Goods already received; hutang can be created manually if needed
84:     }
85:   }
86: 
87:   revalidatePath("/dashboard/inventory");
88:   return { success: true };
89: }

(End of file - total 89 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx"
}
```

**Output:**
```
<path>/home/haydar/Code/POS/app/app/dashboard/inventory/stock-in/stock-in-client.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState, useRef, useEffect, useMemo, useCallback } from "react";
4: import {
5:   useForm,
6:   useFieldArray,
7:   useFormContext,
8:   FormProvider,
9: } from "react-hook-form";
10: import { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2 } from "lucide-react";
11: import { Button } from "@/components/ui/button";
12: import { Input } from "@/components/ui/input";
13: import { addStockIn } from "./actions";
14: import { z } from "zod";
15: 
16: /* ------------------------------------------------------------------ */
17: /*  Zod schemas                                                        */
18: /* ------------------------------------------------------------------ */
19: 
20: const itemSchema = z.object({
21:   id_produk: z.number().min(1, "Produk harus dipilih"),
22:   jumlah: z.number().min(0.001, "Jumlah harus lebih dari 0"),
23:   harga_beli: z.number().min(1, "Harga beli harus lebih dari 0"),
24:   keterangan: z.string().optional(),
25: });
26: 
27: const formSchema = z.object({
28:   id_supplier: z.string().min(1, "Supplier harus dipilih"),
29:   tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
30:   paymentType: z.enum(["Tunai", "Kredit"]),
31:   tanggalJatuhTempo: z.string().optional(),
32:   items: z.array(itemSchema).min(1, "Minimal 1 item"),
33: });
34: 
35: type StockInFormValues = z.infer<typeof formSchema>;
36: 
37: /* ------------------------------------------------------------------ */
38: /*  Inline zodResolver (no @hookform/resolvers dependency)             */
39: /* ------------------------------------------------------------------ */
40: 
41: function makeResolver(schema: z.ZodType) {
42:   return (values: unknown) => {
43:     const result = schema.safeParse(values);
44:     if (result.success) {
45:       return { values: result.data, errors: {} };
46:     }
47:     const fieldErrors: Record<string, { type: string; message: string }> = {};
48:     for (const issue of result.error.issues) {
49:       const path = issue.path.join(".");
50:       if (!fieldErrors[path]) {
51:         fieldErrors[path] = { type: "validation", message: issue.message };
52:       }
53:     }
54:     return { values: {} as Record<string, never>, errors: fieldErrors };
55:   };
56: }
57: 
58: /* ------------------------------------------------------------------ */
59: /*  Types                                                              */
60: /* ------------------------------------------------------------------ */
61: 
62: interface Product {
63:   id: number;
64:   nama_produk: string;
65:   barcode: string | null;
66:   satuan: { nama: string } | null;
67: }
68: 
69: interface Supplier {
70:   id: number;
71:   nama_supplier: string;
72: }
73: 
74: /* ------------------------------------------------------------------ */
75: /*  Helpers                                                            */
76: /* ------------------------------------------------------------------ */
77: 
78: const inputBase =
79:   "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";
80: 
81: function formatIDR(n: number) {
82:   return new Intl.NumberFormat("id-ID", {
83:     style: "currency",
84:     currency: "IDR",
85:     minimumFractionDigits: 0,
86:     maximumFractionDigits: 0,
87:   }).format(n);
88: }
89: 
90: /* ------------------------------------------------------------------ */
91: /*  ProductCombo — search-and-select combobox                          */
92: /* ------------------------------------------------------------------ */
93: 
94: function ProductCombo({
95:   index,
96:   products,
97: }: {
98:   index: number;
99:   products: Product[];
100: }) {
101:   const { watch, setValue } = useFormContext<StockInFormValues>();
102:   const [searchText, setSearchText] = useState("");
103:   const [open, setOpen] = useState(false);
104:   const [highlightIdx, setHighlightIdx] = useState(0);
105:   const inputRef = useRef<HTMLInputElement>(null);
106:   const listRef = useRef<HTMLDivElement>(null);
107: 
108:   const productId = watch(`items.${index}.id_produk`);
109:   const selectedProduct = useMemo(
110:     () => products.find((p) => p.id === productId),
111:     [productId, products]
112:   );
113: 
114:   useEffect(() => {
115:     if (selectedProduct) {
116:       setSearchText(selectedProduct.nama_produk);
117:     }
118:     // eslint-disable-next-line react-hooks/exhaustive-deps
119:   }, [productId]);
120: 
121:   useEffect(() => {
122:     if (!open) return;
123:     const handleClickOutside = (e: MouseEvent) => {
124:       if (
125:         inputRef.current &&
126:         !inputRef.current.contains(e.target as Node) &&
127:         listRef.current &&
128:         !listRef.current.contains(e.target as Node)
129:       ) {
130:         setOpen(false);
131:       }
132:     };
133:     document.addEventListener("mousedown", handleClickOutside);
134:     return () => document.removeEventListener("mousedown", handleClickOutside);
135:   }, [open]);
136: 
137:   const filtered = useMemo(() => {
138:     if (!searchText.trim()) return products.slice(0, 50);
139:     const q = searchText.toLowerCase();
140:     return products
141:       .filter(
142:         (p) =>
143:           p.nama_produk.toLowerCase().includes(q) ||
144:           p.barcode?.toLowerCase().includes(q)
145:       )
146:       .slice(0, 80);
147:   }, [searchText, products]);
148: 
149:   const selectProduct = useCallback(
150:     (product: Product) => {
151:       setValue(`items.${index}.id_produk`, product.id, {
152:         shouldValidate: true,
153:       });
154:       setSearchText(product.nama_produk);
155:       setOpen(false);
156:     },
157:     [index, setValue]
158:   );
159: 
160:   const handleInputChange = (value: string) => {
161:     setSearchText(value);
162:     setHighlightIdx(0);
163:     setOpen(true);
164:     const isSame = selectedProduct && value === selectedProduct.nama_produk;
165:     if (!isSame) {
166:       setValue(`items.${index}.id_produk`, 0, { shouldValidate: false });
167:     }
168:   };
169: 
170:   const handleKeyDown = (e: React.KeyboardEvent) => {
171:     if (e.key === "Enter") {
172:       e.preventDefault();
173:       const rawValue = inputRef.current?.value;
174:       if (rawValue) {
175:         const exactMatch = products.find((p) => p.barcode === rawValue);
176:         if (exactMatch) {
177:           selectProduct(exactMatch);
178:           return;
179:         }
180:       }
181:       if (!open) {
182:         setOpen(true);
183:         return;
184:       }
185:       if (filtered[highlightIdx]) {
186:         selectProduct(filtered[highlightIdx]);
187:       }
188:       return;
189:     }
190:     if (!open) {
191:       if (e.key === "ArrowDown") {
192:         setOpen(true);
193:         e.preventDefault();
194:       }
195:       return;
196:     }
197:     switch (e.key) {
198:       case "ArrowDown":
199:         e.preventDefault();
200:         setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
201:         break;
202:       case "ArrowUp":
203:         e.preventDefault();
204:         setHighlightIdx((i) => Math.max(i - 1, 0));
205:         break;
206:       case "Escape":
207:         setOpen(false);
208:         break;
209:     }
210:   };
211: 
212:   return (
213:     <div className="relative min-w-[200px]">
214:       <input
215:         ref={inputRef}
216:         value={searchText}
217:         onChange={(e) => handleInputChange(e.target.value)}
218:         onFocus={() => setOpen(true)}
219:         onKeyDown={handleKeyDown}
220:         placeholder="Cari produk..."
221:         className={inputBase + " tabular-nums"}
222:         autoComplete="off"
223:       />
224:       {selectedProduct && (
225:         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest">
226:           {selectedProduct.satuan?.nama || "-"}
227:         </span>
228:       )}
229:       {open && filtered.length > 0 && (
230:         <div
231:           ref={listRef}
232:           className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-[0_8px_24px_rgba(0,55,112,0.08)] max-h-56 overflow-y-auto"
233:         >
234:           {filtered.map((p, i) => (
235:             <button
236:               type="button"
237:               key={p.id}
238:               className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
239:                 i === highlightIdx
240:                   ? "bg-primary/10 text-primary"
241:                   : "hover:bg-muted text-foreground"
242:               }`}
243:               onMouseDown={() => selectProduct(p)}
244:               onMouseEnter={() => setHighlightIdx(i)}
245:             >
246:               <span className="truncate">{p.nama_produk}</span>
247:               {p.barcode && (
248:                 <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
249:                   {p.barcode}
250:                 </span>
251:               )}
252:             </button>
253:           ))}
254:         </div>
255:       )}
256:       {open && filtered.length === 0 && (
257:         <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md p-3 text-sm text-muted-foreground">
258:           Tidak ada produk ditemukan
259:         </div>
260:       )}
261:     </div>
262:   );
263: }
264: 
265: /* ------------------------------------------------------------------ */
266: /*  Main Form Body (consumes FormProvider context)                     */
267: /* ------------------------------------------------------------------ */
268: 
269: function FormBody({
270:   products,
271:   suppliers,
272: }: {
273:   products: Product[];
274:   suppliers: Supplier[];
275: }) {
276:   const {
277:     register,
278:     control,
279:     watch,
280:     setValue,
281:     handleSubmit,
282:     formState: { errors },
283:   } = useFormContext<StockInFormValues>();
284: 
285:   const { fields, append, remove } = useFieldArray({
286:     control,
287:     name: "items",
288:   });
289: 
290:   const [loading, setLoading] = useState(false);
291:   const [serverError, setServerError] = useState("");
292:   const [success, setSuccess] = useState(false);
293: 
294:   const paymentType = watch("paymentType");
295: 
296:   const today = new Date().toISOString().slice(0, 10);
297: 
298:   const computedTotal = useMemo(
299:     () =>
300:       fields.reduce((sum, _, i) => {
301:         const qty = watch(`items.${i}.jumlah`) || 0;
302:         const price = watch(`items.${i}.harga_beli`) || 0;
303:         return sum + qty * price;
304:       }, 0),
305:     [fields, watch]
306:   );
307: 
308:   /* Flatten nested RHF errors into user-facing strings */
309:   const validationErrors = useMemo(() => {
310:     const list: string[] = [];
311:     if (errors.id_supplier?.message) {
312:       list.push(errors.id_supplier.message as string);
313:     }
314:     if (errors.items) {
315:       const itemsErr = errors.items as any;
316:       if (typeof itemsErr === "object") {
317:         for (const key of Object.keys(itemsErr)) {
318:           const item = itemsErr[key];
319:           if (!item || typeof item !== "object") continue;
320:           const idx = Number(key);
321:           if (isNaN(idx)) continue;
322:           if (item.id_produk?.message)
323:             list.push(`Baris ${idx + 1}: ${item.id_produk.message}`);
324:           if (item.jumlah?.message)
325:             list.push(`Baris ${idx + 1}: ${item.jumlah.message}`);
326:           if (item.harga_beli?.message)
327:             list.push(`Baris ${idx + 1}: ${item.harga_beli.message}`);
328:         }
329:       }
330:     }
331:     return list;
332:   }, [errors]);
333: 
334:   const onValid = async (data: StockInFormValues) => {
335:     setLoading(true);
336:     setServerError("");
337:     setSuccess(false);
338: 
339:     const payload = data.items
340:       .filter((item) => item.id_produk > 0 && item.jumlah > 0 && item.harga_beli > 0)
341:       .map((item) => ({
342:         id_produk: item.id_produk,
343:         jumlah: item.jumlah,
344:         harga_beli: item.harga_beli,
345:         total: item.jumlah * item.harga_beli,
346:         tgl_masuk: data.tgl_masuk,
347:         id_supplier: Number(data.id_supplier),
348:         keterangan: item.keterangan || "",
349:       }));
350: 
351:     if (payload.length === 0) {
352:       setServerError("Tidak ada data valid untuk disimpan");
353:       setLoading(false);
354:       return;
355:     }
356: 
357:     const res = await addStockIn(
358:       payload,
359:       data.paymentType,
360:       data.paymentType === "Kredit" ? data.tanggalJatuhTempo : null
361:     );
362: 
363:     if (res?.error) {
364:       setServerError(res.error);
365:       setLoading(false);
366:       return;
367:     }
368: 
369:     setSuccess(true);
370:     setLoading(false);
371: 
372:     /* Reset form to defaults */
373:     setValue("id_supplier", "");
374:     setValue("tgl_masuk", today);
375:     setValue("paymentType", "Tunai");
376:     setValue("tanggalJatuhTempo", "");
377:     setValue("items", [
378:       { id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: "" },
379:     ]);
380: 
381:     setTimeout(() => setSuccess(false), 4000);
382:   };
383: 
384:   return (
385:     <form
386:       onSubmit={handleSubmit(onValid)}
387:       className="flex-1 flex flex-col min-h-0"
388:     >
389:       {/* Server error banner */}
390:       {serverError && (
391:         <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
392:           <AlertCircle className="w-4 h-4 shrink-0" />
393:           {serverError}
394:         </div>
395:       )}
396: 
397:       {/* Validation error banner */}
398:       {validationErrors.length > 0 && (
399:         <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
400:           <AlertCircle className="w-4 h-4 shrink-0" />
401:           <ul className="list-disc list-inside">
402:             {validationErrors.map((msg, i) => (
403:               <li key={i}>{msg}</li>
404:             ))}
405:           </ul>
406:         </div>
407:       )}
408: 
409:       {/* Success banner */}
410:       {success && (
411:         <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
412:           <Check className="w-4 h-4 shrink-0" />
413:           Barang masuk berhasil disimpan
414:         </div>
415:       )}
416: 
417:       {/* Header fields */}
418:       <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent">
419:         <div className="flex flex-col gap-1.5 w-full md:w-auto">
420:           <label
421:             htmlFor="id_supplier"
422:             className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
423:           >
424:             Supplier
425:           </label>
426:           <select
427:             id="id_supplier"
428:             {...register("id_supplier")}
429:             className="h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
430:           >
431:             <option value="">Pilih supplier</option>
432:             {suppliers.map((s) => (
433:               <option key={s.id} value={s.id}>
434:                 {s.nama_supplier}
435:               </option>
436:             ))}
437:           </select>
438:         </div>
439: 
440:         <div className="flex flex-col gap-1.5 w-full md:w-auto">
441:           <label
442:             htmlFor="tgl_masuk"
443:             className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
444:           >
445:             Tanggal Masuk
446:           </label>
447:           <input
448:             id="tgl_masuk"
449:             type="date"
450:             {...register("tgl_masuk")}
451:             className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
452:           />
453:         </div>
454: 
455:         <div className="flex flex-col gap-1.5 w-full md:w-auto">
456:           <label
457:             htmlFor="payment_type"
458:             className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
459:           >
460:             Metode Bayar
461:           </label>
462:           <select
463:             id="payment_type"
464:             {...register("paymentType")}
465:             className="h-9 w-full md:min-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
466:           >
467:             <option value="Tunai">Tunai</option>
468:             <option value="Kredit">Kredit / Tempo</option>
469:           </select>
470:         </div>
471: 
472:         {paymentType === "Kredit" && (
473:           <div className="flex flex-col gap-1.5 w-full md:w-auto">
474:             <label
475:               htmlFor="tgl_jatuh_tempo"
476:               className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
477:             >
478:               Jatuh Tempo
479:             </label>
480:             <input
481:               id="tgl_jatuh_tempo"
482:               type="date"
483:               {...register("tanggalJatuhTempo")}
484:               className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
485:             />
486:           </div>
487:         )}
488:       </div>
489: 
490:       {/* Table */}
491:       <div className="flex-1 overflow-y-auto min-h-0">
492:         <table className="w-full min-w-[800px]">
493:           <thead>
494:             <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
495:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">
496:                 #
497:               </th>
498:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">
499:                 Produk
500:               </th>
501:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[100px] px-2">
502:                 Jumlah
503:               </th>
504:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2">
505:                 Harga Beli
506:               </th>
507:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[140px] px-2">
508:                 Total
509:               </th>
510:               <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2">
511:                 Keterangan
512:               </th>
513:               <th className="w-10 px-2" />
514:             </tr>
515:           </thead>
516:           <tbody>
517:             {fields.map((field, index) => {
518:               const qty = watch(`items.${index}.jumlah`) || 0;
519:               const price = watch(`items.${index}.harga_beli`) || 0;
520:               return (
521:                 <tr
522:                   key={field.id}
523:                   className="border-b border-border/40 hover:bg-muted/20 transition-colors"
524:                 >
525:                   <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2">
526:                     {index + 1}
527:                   </td>
528:                   <td className="px-2 py-2">
529:                     <ProductCombo index={index} products={products} />
530:                   </td>
531:                   <td className="px-2 py-2">
532:                     <Input
533:                       type="number"
534:                       min={0}
535:                       step="any"
536:                       {...register(`items.${index}.jumlah`, {
537:                         valueAsNumber: true,
538:                       })}
539:                       className="h-9 tabular-nums font-medium"
540:                     />
541:                   </td>
542:                   <td className="px-2 py-2">
543:                     <Input
544:                       type="number"
545:                       min={0}
546:                       step="any"
547:                       {...register(`items.${index}.harga_beli`, {
548:                         valueAsNumber: true,
549:                       })}
550:                       className="h-9 tabular-nums font-medium"
551:                     />
552:                   </td>
553:                   <td className="px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground">
554:                     {formatIDR(qty * price)}
555:                   </td>
556:                   <td className="px-2 py-2">
557:                     <input
558:                       {...register(`items.${index}.keterangan`)}
559:                       placeholder="Catatan opsional"
560:                       className={inputBase}
561:                     />
562:                   </td>
563:                   <td className="px-2 py-2 text-center">
564:                     <button
565:                       type="button"
566:                       onClick={() => remove(index)}
567:                       disabled={fields.length === 1}
568:                       className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
569:                       title="Hapus baris"
570:                     >
571:                       <Trash2 className="w-4 h-4" />
572:                     </button>
573:                   </td>
574:                 </tr>
575:               );
576:             })}
577:           </tbody>
578:         </table>
579: 
580:         {fields.length === 0 && (
581:           <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
582:             <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
583:             <p className="text-base font-medium text-foreground">
584:               Belum ada item
585:             </p>
586:             <p className="text-sm mt-1">
587:               Tambah item untuk mencatat penerimaan stok
588:             </p>
589:           </div>
590:         )}
591:       </div>
592: 
593:       {/* Footer */}
594:       <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap">
595:         <Button
596:           type="button"
597:           variant="ghost"
598:           className="rounded-full px-4 h-9 text-muted-foreground hover:text-foreground"
599:           onClick={() =>
600:             append({
601:               id_produk: 0,
602:               jumlah: 1,
603:               harga_beli: 0,
604:               keterangan: "",
605:             })
606:           }
607:         >
608:           <Plus className="w-4 h-4 mr-1.5" />
609:           Tambah Baris
610:         </Button>
611: 
612:         <div className="flex items-center gap-4">
613:           <div className="text-right">
614:             <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
615:               Total Semua
616:             </p>
617:             <p className="text-lg font-light tabular-nums text-foreground">
618:               {formatIDR(computedTotal)}
619:             </p>
620:           </div>
621:           <Button
622:             type="submit"
623:             disabled={fields.length === 0 || loading}
624:             className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
625:           >
626:             {loading ? (
627:               <>
628:                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
629:                 Menyimpan...
630:               </>
631:             ) : (
632:               "Simpan Barang Masuk"
633:             )}
634:           </Button>
635:         </div>
636:       </div>
637:     </form>
638:   );
639: }
640: 
641: /* ------------------------------------------------------------------ */
642: /*  Page-level Client Component — wraps everything in FormProvider     */
643: /* ------------------------------------------------------------------ */
644: 
645: export default function StockInClient({
646:   products,
647:   suppliers,
648: }: {
649:   products: Product[];
650:   suppliers: Supplier[];
651: }) {
652:   const today = new Date().toISOString().slice(0, 10);
653:   const defaultJatuhTempo = (() => {
654:     const d = new Date();
655:     d.setDate(d.getDate() + 30);
656:     return d.toISOString().slice(0, 10);
657:   })();
658: 
659:   const form = useForm<StockInFormValues>({
660:     resolver: makeResolver(formSchema) as any,
661:     mode: "onSubmit",
662:     defaultValues: {
663:       id_supplier: "",
664:       tgl_masuk: today,
665:       paymentType: "Tunai",
666:       tanggalJatuhTempo: defaultJatuhTempo,
667:       items: [{ id_produk: 0, jumlah: 1, harga_beli: 0, keterangan: "" }],
668:     },
669:   });
670: 
671:   return (
672:     <FormProvider {...form}>
673:       <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
674:         <header className="shrink-0">
675:           <h1 className="text-4xl font-light tracking-tighter text-foreground">
676:             Barang Masuk
677:           </h1>
678:           <p className="text-muted-foreground mt-2">
679:             Catat penerimaan stok baru dari supplier
680:           </p>
681:         </header>
682: 
683:         <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
684:           <FormBody products={products} suppliers={suppliers} />
685:         </div>
686:       </div>
687:     </FormProvider>
688:   );
689: }

(End of file - total 689 lines)
</content>
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 3.8s)

_Thinking:_

Everything looks clean. Let me also verify the migration files are correct, and then run the build to make sure everything compiles.

Let me also check if there's a build command available.

Let me run the build to confirm no compile errors:

**Tool: bash**

**Input:**
```json
{
  "description": "Next.js build check",
  "command": "npx next build --no-lint 2>&1 | tail -30",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/POS/app"
}
```

**Output:**
```
error: unknown option '--no-lint'

```

---

## Assistant (Build · DeepSeek V4 Flash Free · 19.8s)

_Thinking:_

Let me try with `--no-eslint` instead, or just `next build`. Actually, the ESLint option for Next.js might be different. Let me just run `next build` directly.

**Tool: bash**

**Input:**
```json
{
  "command": "npx next build 2>&1 | tail -30",
  "description": "Next.js full build",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/POS/app"
}
```

**Output:**
```
├ ƒ /dashboard/customers
├ ƒ /dashboard/hutang
├ ƒ /dashboard/inventory
├ ƒ /dashboard/inventory/stock-in
├ ƒ /dashboard/inventory/stock-in/history
├ ƒ /dashboard/inventory/stock-opname
├ ƒ /dashboard/inventory/stock-opname/history
├ ƒ /dashboard/laporan-kasir
├ ƒ /dashboard/laporan/laba-rugi
├ ƒ /dashboard/laporan/neraca
├ ƒ /dashboard/piutang
├ ƒ /dashboard/reports
├ ƒ /dashboard/settings
├ ƒ /dashboard/settings/keuangan
├ ƒ /dashboard/settings/reference-data
├ ƒ /dashboard/settings/users
├ ƒ /dashboard/suppliers
├ ƒ /dashboard/transactions
├ ƒ /dashboard/tutup-kasir
├ ○ /manifest.webmanifest
├ ƒ /pos
├ ƒ /pos/invoice/[id]
├ ƒ /pos/invoice/[id]/receipt
├ ƒ /pos/test-barcode
└ ƒ /scanner/[sessionId]


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


```

---

## Assistant (Build · DeepSeek V4 Flash Free · 4.1s)

_Thinking:_

The build completed successfully with no errors. The `/dashboard/inventory/stock-in` route is listed without any issues.

Now let me update the todo list and provide the user with step-by-step testing instructions.

Build succeeded with zero errors. Let me finalize.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "priority": "high",
      "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Create DB migration: widen numeric columns for unrounded precision",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
      "status": "completed"
    },
    {
      "priority": "medium",
      "content": "Update server page (`page.tsx`) if needed",
      "status": "completed"
    },
    {
      "priority": "high",
      "content": "Final review: verify all files compile, check for type errors, confirm no breaking changes",
      "status": "completed"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Create DB migration: `process_barang_masuk` RPC with advisory lock",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Create DB migration: widen numeric columns for unrounded precision",
    "status": "completed",
    "priority": "medium"
  },
  {
    "content": "Rewrite server action (`actions.ts`) to call RPC + Zod validation",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Rewrite UI (`stock-in-client.tsx`) with React Hook Form + Zod + useFieldArray",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Update server page (`page.tsx`) if needed",
    "status": "completed",
    "priority": "medium"
  },
  {
    "content": "Final review: verify all files compile, check for type errors, confirm no breaking changes",
    "status": "completed",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4 Flash Free · 11.6s)

_Thinking:_

All tasks are complete! Let me provide a clear summary of what was done and how the user can test step by step.

All done. Here's a summary of what was implemented and **how to test step by step**.

---

## Files Changed / Created

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260710_process_barang_masuk.sql` | **Created** | Atomic RPC with `pg_advisory_xact_lock(987654322)` — inserts `barang_masuk`, computes WAC, updates `produk`, records `riwayat_avco` in a single transaction |
| `supabase/migrations/20260710_widen_numeric_columns.sql` | **Created** | Removes `(15,2)` scale constraints so DB stores full precision (no rounding until UI) |
| `app/dashboard/inventory/stock-in/actions.ts` | **Rewritten** | Zod-validates input, delegates to `process_barang_masuk` RPC instead of sequential JS calls |
| `app/dashboard/inventory/stock-in/stock-in-client.tsx` | **Rewritten** | Uses `react-hook-form` + `useFieldArray` + Zod. Form validated with a custom `zodResolver` |

---

## How to Test (Step by Step)

### Step 1: Apply migrations
Run these through the Supabase CLI or your Supabase dashboard SQL editor:
```sql
-- First, the RPC function
\i supabase/migrations/20260710_process_barang_masuk.sql

-- Then, widen the numeric columns
\i supabase/migrations/20260710_widen_numeric_columns.sql
```
Or via the CLI: `supabase db push` if you're tracking migrations.

### Step 2: Start the dev server
```bash
npm run dev
```

### Step 3: Navigate to Barang Masuk
Go to **Dashboard → Inventory → Barang Masuk** (`/dashboard/inventory/stock-in`)

### Step 4: Test the form validation
- Click **"Simpan Barang Masuk"** without filling anything — you should see validation error banners in red.
- Select a supplier, enter a product, quantity, and price.
- Try adding multiple rows with "Tambah Baris".
- Try deleting rows (except the last one, which is protected).

### Step 5: Test successful submission (Tunai)
1. Select a supplier
2. Pick a product from the search combobox
3. Enter quantity (e.g., `10`) and purchase price (e.g., `5000`)
4. Click **"Simpan Barang Masuk"**
5. Expect: green success banner, form resets, product's `stok_gudang` increases by 10

### Step 6: Verify WAC was calculated
In your database, check:
```sql
SELECT id, nama_produk, stok_gudang, harga_pokok_avco, nilai_persediaan
FROM produk
WHERE id = <the product id>;
```
`harga_pokok_avco` should reflect the weighted average, e.g.:
- If you had 5 units at 4000 and added 10 at 5000 → `(5*4000 + 10*5000) / 15 = 4666.66...`

Check `riwayat_avco` for the mutation record:
```sql
SELECT * FROM riwayat_avco
WHERE id_produk = <product id>
ORDER BY tanggal DESC
LIMIT 5;
```

### Step 7: Test concurrent safety
Open two browser tabs to Barang Masuk. Submit different stock-in entries for the **same product** simultaneously. Both should succeed and the final AVCO should be correct (the RPC's `pg_advisory_xact_lock` serializes them).

### Step 8: Test Kredit (Accounts Payable)
Submit with **"Kredit / Tempo"** selected. Verify a `hutang_dagang` record was created linked to the `barang_masuk.id`.

---

## Architecture Summary (Key Properties)

- **Atomicity**: `process_barang_masuk` RPC does `INSERT → SELECT ... FOR UPDATE → UPDATE → INSERT riwayat_avco` in one advisory-locked transaction
- **Concurrency**: Uses lock ID `987654322` (separate from `process_checkout`'s `987654321`) — stock-in and checkout don't block each other, but two stock-ins do serialize
- **WAC Formula**: `new_avco = (total_stok_awal * avco_lama + jumlah_masuk * harga_beli) / (total_stok_awal + jumlah_masuk)`
- **Rounding**: Only at UI level via `formatIDR()`; DB stores full `numeric` precision
- **Form**: React Hook Form `useFieldArray` for dynamic rows + Zod schema via custom inline resolver

---

