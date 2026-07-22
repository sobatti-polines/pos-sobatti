<div align="center">

<img src="./public/logo-perusahaan.png" alt="POS Sobatti" height="80" />

# POS Sobatti

**Sistem Point of Sale modern untuk toko retail — migrasi dari Excel VBA ke Next.js + Supabase.**

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-149eca?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-38bdf8?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

[Overview](#overview) • [Features](#features) • [Getting started](#getting-started) • [Architecture](#architecture) • [Development](#development) • [Roadmap](#roadmap)

</div>

---

## Overview

POS Sobatti is a full-featured, web-based Point of Sale system designed for daily retail operations — transactions, inventory, customer/supplier management, employee attendance, financial reporting, and more — all in a lightweight PWA that works on desktop and mobile.

The project is a ground-up rewrite of a legacy Microsoft Excel + VBA application (17 sheets, macro-driven `Terbilangku`, VBA transaction engine, dual-stock tracking) into a modern web stack. Every core business rule is preserved: sequential transaction numbering with race-condition protection, three-tier pricing (Satuan/Grosir/Promo), item-level and global discounts, DP (down payment) support, and Rupiah-formatted receipts with an Indonesian-language `terbilang()` function.

The interface is intentionally calm and professional — built for daily use by cashiers who need speed, and managers who need clarity.

> [!NOTE]
> "Sobatti" is the internal store identity for the retail business where this system was first deployed.

## Features

**POS (Point of Sale)**
- Product search by name/SKU/barcode, on-screen numpad, three-tier pricing (Satuan/Grosir/Promo)
- Item-level discount, global discount percentage, automatic tax calculation
- Multiple payment methods, DP support with automatic receivable tracking
- Real-time barcode scanning via camera (ZXing) or USB scanner (SSE relay) — scan from your phone, ring up on the POS
- Auto-print receipt (thermal 58mm or full A4 invoice)

**Dashboard & Manager Reports**
- Revenue summary (today vs yesterday), transaction count, average ticket size, 14-day sales chart
- Low-stock alerts (real-time via Supabase subscription)
- Recent transactions widget, daily cash summary with closing-out workflow
- Profit & Loss report, Balance Sheet report

**Inventory Management**
- Product master with dual-stock tracking (display stock + warehouse stock)
- Category, unit, brand with SKU management
- Stock-in (purchasing) with Unit-of-Measure conversion support
- Stock opname (stock-taking with discrepancy reports)
- AVCO (weighted average cost) tracking for COGS calculation

**Customer & Supplier Management**
- Full CRUD with inline search, in-place editing, validation

**Employee Attendance**
- QR code-based check-in/check-out with 30-second rotating sessions
- GPS geofencing validation (Haversine formula, configurable radius)
- Attendance history, monthly stats, late-clock-in penalties
- Full attendance reports (admin/owner)

**User Management & Roles**
- Supabase Auth (email/password) with role-based access
- Roles: OWNER, ADMIN, KASIR (cashier), KARYAWAN (employee-only attendance)

**Technical Highlights**
- PWA — installable on any device, works offline (service worker caching)
- Real-time low-stock notifications via Supabase Realtime
- Race-condition-safe checkout using PostgreSQL advisory locks
- Server-Sent Events relay for multi-device barcode scanning
- Data export to CSV and PDF
- Full Indonesian language interface

## Getting started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Supabase](https://supabase.com) account (or local Supabase via Docker)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)

### Quick start

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd app
npm install

# Set up environment variables
cp .env.local.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SERVICE_ROLE=<your-service-role-key>
```

Then run database migrations and start the dev server:

```bash
supabase db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

> [!TIP]
> To test camera features (barcode scanning / QR attendance) on mobile devices, use `npm run dev:https` — this starts the dev server with HTTPS enabled and bound to `0.0.0.0`, so other devices on your LAN can connect.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on `http://localhost:3000` |
| `npm run dev:https` | Start dev server with HTTPS on `0.0.0.0` (camera/mobile testing) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Architecture

### Project structure

```
app/
├── page.tsx                     # Login page
├── layout.tsx                   # Root layout with Supabase SSR auth
├── globals.css                  # Tailwind v4 design tokens (OKLCH)
├── pos/                         # POS cashier interface
│   ├── page.tsx                 #   Main POS (product panel + cart + numpad)
│   └── invoice/[id]/            #   Receipt views (thermal 58mm & A4)
├── dashboard/                   # Manager dashboard
│   ├── page.tsx                 #   Overview (revenue, charts, low stock)
│   ├── transactions/            #   Transaction history & detail
│   ├── inventory/               #   Products, stock-in, stock opname
│   ├── customers/               #   Customer management
│   ├── suppliers/               #   Supplier management
│   ├── reports/                 #   Sales reports & exports
│   ├── laporan/                 #   P&L, Balance Sheet
│   ├── tutup-kasir/             #   Daily cash closing
│   ├── attendance/              #   Attendance history, QR gen, reports
│   └── settings/                #   Store settings, users, reference data
├── attendance/scan/             # QR attendance scanning (mobile)
├── scanner/[sessionId]/         # Barcode scanner camera page (SSE relay)
└── api/                         # Next.js Route Handlers
    ├── auth/login               # Supabase Auth login
    ├── pos/checkout             # Process checkout (atomic RPC)
    ├── pos/products             # Product listing for POS
    ├── pos/customer-search      # Customer search
    ├── dashboard/stats          # Dashboard aggregates
    ├── dashboard/transactions   # Transaction CRUD
    ├── inventory/*              # Products, categories, units, suppliers
    ├── inventory/stock-in       # Stock-in (RPC process_barang_masuk)
    ├── inventory/stock-opname   # Stock-taking
    ├── attendance/*             # Check-in, check-out, QR scan, QR gen
    ├── scanner/relay            # Barcode SSE relay
    ├── customers                # Customer CRUD
    ├── low-stock                # Low-stock items
    ├── users                    # User management
    ├── settings                 # Store configuration
    └── laporan/*                # Reports (P&L, balance sheet, sales)

components/
├── ui/                          # shadcn/ui primitives
├── data-table.tsx               # Reusable table with search, sort, pagination
├── login-form.tsx
├── logout-button.tsx
├── dashboard-sidebar.tsx        # Desktop sidebar navigation
├── dashboard-mobile-nav.tsx     # Mobile slide-over menu
├── low-stock-banner.tsx
├── attendance-widget.tsx
└── product-detail-sheet.tsx

lib/
├── supabase/
│   ├── client.ts                # Browser Supabase client
│   ├── server.ts                # Server component client (cookie-based SSR)
│   └── admin.ts                 # Service-role client (admin operations)
├── dashboard.ts                 # Dashboard data aggregator
├── attendance.ts                # Attendance queries & helpers
├── scanner-relay.ts             # In-memory SSE relay for barcode scanner
├── avco.ts                      # AVCO (Average Cost) calculation engine
├── laporan-kasir.ts             # Daily cash summary & closing
├── laporan-keuangan.ts          # P&L and Balance Sheet generation
├── export-utils.ts              # CSV & PDF export
├── terbilang.ts                 # Indonesian number-to-words
└── utils.ts                     # cn() utility

stores/
└── pos-store.ts                 # Zustand store (cart, numpad, checkout state)

hooks/
├── use-table.ts                 # Table sorting & pagination hook
└── use-low-stock-realtime.ts    # Real-time low-stock subscription

supabase/migrations/             # 19 SQL migration files
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19 + TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (Radix UI Nova) + CVA |
| **State** | Zustand 5 (POS state), React hooks (server state) |
| **Forms** | React Hook Form + Zod 4 |
| **Database** | Supabase (PostgreSQL) + Row Level Security |
| **Auth** | Supabase Auth (email/password, SSR cookies) |
| **Table** | @tanstack/react-table 8 |
| **Barcode/QR** | @zxing/browser + @zxing/library |
| **PDF** | jspdf + jspdf-autotable |
| **Barcode gen** | jsbarcode |
| **QR gen** | qrcode |
| **PWA** | @ducanh2912/next-pwa |
| **Icons** | lucide-react |
| **Dates** | date-fns 4 |

### Database overview

The schema follows the original Excel sheet structure, normalized to relational form (20 tables + 3 RPC functions):

| Table | Purpose |
|-------|---------|
| `pengguna` | Users with role-based access (ADMIN/KASIR/OWNER/KARYAWAN) |
| `produk` | Products with dual-stock, AVCO, 3-tier pricing, UoM |
| `kategori`, `satuan`, `merk` | Product categories, units, brands |
| `pelanggan`, `supplier` | Customers & suppliers |
| `transaksi_keluar`, `detail_transaksi_keluar` | Sales header & line items |
| `barang_masuk` | Stock-in purchases (with UoM conversion) |
| `stok_opname` | Stock-taking corrections |
| `absensi` | Attendance records with GPS & photos |
| `qr_session` | Ephemeral QR tokens (30s expiry) |
| `pengaturan` | Store configuration |
| `riwayat_avco` | AVCO mutation history |
| `saldo_kas_harian` | Daily cash balance |
| `pengaturan_keuangan` | Financial settings |
| `piutang_dagang` | Trade receivables (auto-created on credit sales) |

**Key RPC functions** (PostgreSQL, SECURITY DEFINER):
- `process_checkout` — Atomic checkout with `pg_advisory_xact_lock(987654321)`, generates sequential transaction numbers, handles AVCO and receivable creation
- `process_barang_masuk` — Atomic stock-in with `pg_advisory_xact_lock(987654322)`, dual-format (UoM + legacy)
- `get_inventory_value_at_date` — Inventory valuation at a given date

> Transaction numbers follow `YYYYMMNNNN` format (sequential per month), generated in `Asia/Jakarta` timezone.

## Development

> [!IMPORTANT]
> This project uses **Next.js 16** and **React 19**, which have breaking changes from earlier versions. Always consult the framework docs before writing new code.

### Coding conventions

- **Components**: Use named exports. Server Components by default; `"use client"` only for interactivity (forms, dialogs, hooks, state).
- **UI primitives**: Use shadcn/ui components from `components/ui/`. No new UI libraries without discussion.
- **Data fetching**: Encapsulate in `lib/<domain>.ts`. Use `lib/supabase/server.ts` for server components, `lib/supabase/client.ts` for browser.
- **Forms**: React Hook Form + Zod. Define schemas locally.
- **Validation**: Always validate on the server side — never trust the client.
- **Language**: All UI copy, error messages, labels, and tooltips must be in **Bahasa Indonesia**.
- **Money**: Store as `numeric` in the database. Format display with the standard IDR formatter. Use `terbilangRupiah()` for printed receipts.

### Design system

The UI follows a Stripe-inspired design language ("Stripi"):

- **Primary**: `#533afd` (electric indigo) — CTAs, links, active accents
- **Typography**: Thin (300 weight) display text with negative tracking; tabular numbers for monetary values
- **Buttons**: Pill-shaped (`rounded-full`), `h-10 px-6 bg-primary`
- **Cards**: `rounded-xl` with soft shadows and subtle rings
- **Input/Select**: `rounded-[6px]`, primary border on focus

### Terbilang utility

A direct TypeScript port of the original VBA `Terbilangku()` macro. Supports numbers up to trillions, negative numbers (`Minus`), and the `Rupiah` suffix.

```ts
import { terbilangRupiah } from "@/lib/terbilang";

terbilangRupiah(164600);
// "Seratus Enam Puluh Empat Ribu Enam Ratus Rupiah"
```

## Roadmap

- [x] Core POS (checkout, cart, numpad, 3-tier pricing)
- [x] Inventory management (products, stock-in, stock opname)
- [x] Customer & supplier management
- [x] Transaction history & reports
- [x] QR attendance module
- [x] Barcode scanner (camera + USB relay)
- [x] PWA support
- [x] User management & RBAC
- [x] Financial reports (P&L, Balance Sheet)
- [x] Daily cash closing
- [ ] PWA service worker caching for attendance module
- [ ] Unit-of-Measure conversion (in progress)
