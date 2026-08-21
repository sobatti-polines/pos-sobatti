# MIGRASI SUPABASE → POSTGRESQL + PRISMA

**Status:** Belum mulai
**Estimasi:** 14-21 hari kerja
**Metode:** Migrasi bertahap (phase by phase)
**Stack tujuan:** PostgreSQL + Prisma ORM + polling (tanpa realtime)

---

## DAFTAR ISI

1. [Arsitektur Before vs After](#1-arsitektur-before-vs-after)
2. [Persiapan VPS](#2-persiapan-vps)
3. [Phase 1: Setup Prisma & Schema Migration](#3-phase-1-setup-prisma--schema-migration)
4. [Phase 2: Auth System Custom](#4-phase-2-auth-system-custom)
5. [Phase 3: Database Query Layer (Prisma)](#5-phase-3-database-query-layer-prisma)
6. [Phase 4: RPC Functions ke Prisma Transactions](#6-phase-4-rpc-functions-ke-prisma-transactions)
7. [Phase 5: Admin Client & Service Layer](#7-phase-5-admin-client--service-layer)
8. [Phase 6: Realtime → Polling](#8-phase-6-realtime--polling)
9. [Phase 7: Cleanup & Testing](#9-phase-7-cleanup--testing)
10. [Phase 8: Deploy ke VPS](#10-phase-8-deploy-ke-vps)
11. [Checklist per Phase](#11-checklist-per-phase)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. ARSITEKTUR BEFORE VS AFTER

### BEFORE (Supabase Cloud)

```
Browser → Next.js (VPS) → Supabase Cloud
                              ├── PostgreSQL (managed)
                              ├── Auth (GoTrue)
                              ├── PostgREST (auto API)
                              ├── Realtime (WebSocket)
                              └── RLS (Row Level Security)
```

### AFTER (PostgreSQL + Prisma di VPS yang sama)

```
Browser → Next.js (VPS) → Prisma ORM → PostgreSQL (lokal)
                              ├── Auth (custom JWT + bcrypt)
                              ├── Queries (Prisma Client)
                              ├── Transactions (Prisma TX)
                              └── Polling (interval, bukan realtime)
```

### Env Variables BEFORE vs AFTER

| BEFORE (Supabase) | AFTER (PostgreSQL + Prisma) |
|-------------------|----------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `DATABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `JWT_SECRET` |
| `SERVICE_ROLE` | _(hapus, tidak diperlukan)_ |
| `STORE_LATITUDE` | `STORE_LATITUDE` (tetap) |
| `STORE_LONGITUDE` | `STORE_LONGITUDE` (tetap) |
| `MAX_ATTENDANCE_RADIUS` | `MAX_ATTENDANCE_RADIUS` (tetap) |
| `QR_EXPIRE_SECONDS` | `QR_EXPIRE_SECONDS` (tetap) |
| `ATTENDANCE_START_TIME` | `ATTENDANCE_START_TIME` (tetap) |
| `ATTENDANCE_TOLERANCE_MINUTES` | `ATTENDANCE_TOLERANCE_MINUTES` (tetap) |

---

## 2. PERSIAPAN VPS

### 2.1 Install PostgreSQL di VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL 17
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-17 postgresql-client-17

# Verify
psql --version
sudo systemctl status postgresql
```

### 2.2 Setup Database & User

```bash
# Masuk ke PostgreSQL shell
sudo -u postgres psql

-- Buat database
CREATE DATABASE pos_sobatti;

-- Buat user
CREATE USER pos_user WITH PASSWORD 'GANTI_DENGAN_PASSWORD_YANG_KUAT';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pos_sobatti TO pos_user;
\c pos_sobatti
GRANT ALL ON SCHEMA public TO pos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO pos_user;

\q
```

### 2.3 Install Node.js Dependencies

```bash
# Di direktori project
npm install prisma @prisma/client jsonwebtoken bcryptjs jose
npm install -D @types/jsonwebtoken @types/bcryptjs tsx
```

### 2.4 Inisialisasi Prisma

```bash
npx prisma init --datasource-provider postgresql
```

Ini membuat:
- `prisma/schema.prisma` (template kosong)
- `.env` (dengan `DATABASE_URL`)

### 2.5 Konfigurasi Connection Pool

PgBouncer sudah di-setup di VPS sebagai connection pooler, jadi **tidak perlu** menambahkan `connection_limit` atau `pool_timeout` di DATABASE_URL. PgBouncer menangani pooling secara terpusat.

```
# .env
DATABASE_URL="postgresql://pos_user:PASSWORD@localhost:6432/pos_sobatti"
```

> **Catatan:** Port `6432` adalah port default PgBouncer (transaction mode). Sesuaikan dengan port PgBouncer yang kamu konfigurasi di VPS.

---

## 3. PHASE 1: SETUP PRISMA & SCHEMA MIGRATION

**Estimasi:** 1-2 hari
**Goal:** Pindahkan seluruh schema database dari Supabase ke PostgreSQL lokal via Prisma

### Step 1.1: Dump Schema + Data dari Supabase Cloud

**Paling simpel:** Gunakan `pg_dump` untuk ambil schema + data sekaligus.

```bash
# Dump full (schema + data) dari Supabase ke file SQL
PGPASSWORD="YOUR_SUPABASE_DB_PASSWORD" pg_dump \
  --host=aws-0-ap-southeast-1.pooler.supabase.com \
  --port=6543 \
  --username=postgres.POS_ID \
  --dbname=pos \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --file=supabase/full_dump.sql

# Verifikasi
ls -lh supabase/full_dump.sql
wc -l supabase/full_dump.sql
head -50 supabase/full_dump.sql  # Harus ada CREATE TABLE + INSERT INTO
```

> **Atau gunakan file yang sudah ada:** `supabase/data_dump.sql` (812KB) sudah berisi INSERT statements untuk semua tabel public.

### Step 1.2: Restore ke Local PostgreSQL

```bash
# Restore full dump (schema + data) ke local PostgreSQL
psql -h localhost -U pos_user -d pos_sobatti -f supabase/full_dump.sql

# Atau dari file yang sudah ada
psql -h localhost -U pos_user -d pos_sobatti -f supabase/data_dump.sql

# Verifikasi data ter-restore
psql -h localhost -U pos_user -d pos_sobatti -c "
SELECT 'kategori' as tbl, count(*) FROM kategori
UNION ALL SELECT 'satuan', count(*) FROM satuan
UNION ALL SELECT 'produk', count(*) FROM produk
UNION ALL SELECT 'transaksi_keluar', count(*) FROM transaksi_keluar
UNION ALL SELECT 'pengguna', count(*) FROM pengguna;
"
```

### Step 1.3: Generate Prisma Schema (Otomatis)

```bash
# Install Prisma
npm install prisma --save-dev

# Pull schema dari local PostgreSQL → otomatis generate schema.prisma
npx prisma db pull

# Verifikasi
npx prisma format
npx prisma generate
npx prisma studio  # Cek semua tabel ter-load dengan benar
```

> **Prisma akan otomatis detect semua tabel** dari database lokal dan generate `schema.prisma` lengkap dengan relations. Tidak perlu tulis manual.

### Step 1.4: Generate Prisma Client & Push ke Database

```bash
# Generate Prisma Client
npx prisma generate

# Push schema ke PostgreSQL (tanpa migration, langsung sync)
npx prisma db push

# Atau pakai migration (recommended untuk production)
npx prisma migrate dev --name init
```

### Step 1.5: Verifikasi Schema

```bash
# Buka Prisma Studio (GUI) untuk cek data
npx prisma studio
```

### Step 1.6: Migrate PL/pgSQL Functions

Prisma tidak manage PostgreSQL functions. Function-function ini harus dijalankan manual:

```bash
# Dump functions dari Supabase
npx supabase db dump --data-only --db-url "..." > functions.sql

# Atau buat file SQL terpisah untuk functions:
# prisma/migrations/functions.sql
```

Functions yang harus dimigrasikan (dari Supabase ke PostgreSQL lokal):

| Function | File SQL | Keterangan |
|----------|----------|------------|
| `process_checkout` | `prisma/migrations/functions.sql` | Checkout transaksi |
| `process_barang_masuk` | `prisma/migrations/functions.sql` | Barang masuk |
| `process_stock_opname` | `prisma/migrations/functions.sql` | Stok opname |
| `cancel_barang_masuk` | `prisma/migrations/functions.sql` | Batalkan barang masuk |
| `process_retur_pembelian` | `prisma/migrations/functions.sql` | Retur pembelian |
| `process_isi_stok_paket` | `prisma/migrations/functions.sql` | Isi stok paket |
| `increment_point` | `prisma/migrations/functions.sql` | Tambah point member |
| `reset_pelanggan_id_seq` | `prisma/migrations/functions.sql` | Reset sequence |
| `tambah_log_aktivitas` | `prisma/migrations/functions.sql` | Log aktivitas |
| `get_inventory_value_at_date` | `prisma/migrations/functions.sql` | Nilai persediaan |
| `generate_no_transaksi` | `prisma/migrations/functions.sql` | Generate no transaksi |
| `sync_harga_jual_besar` | `prisma/migrations/functions.sql` | Sync harga besar |
| `cek_overlap_event_promo` | `prisma/migrations/functions.sql` | Cek overlap promo |
| `guard_produk_paket` | `prisma/migrations/functions.sql` | Guard produk paket |
| `fn_hitung_selisih_opname` | `prisma/migrations/functions.sql` | Hitung selisih opname |

Jalankan functions:
```bash
psql -h localhost -U pos_user -d pos_sobatti -f prisma/migrations/functions.sql
```

### Step 1.7: Migrate Triggers

```sql
-- Trigger sync harga jual besar
CREATE TRIGGER trg_sync_harga_jual_besar
  AFTER INSERT OR UPDATE ON produk
  FOR EACH ROW
  EXECUTE FUNCTION sync_harga_jual_besar();

-- Trigger cek overlap event promo
CREATE TRIGGER trg_cek_overlap_event_promo
  BEFORE INSERT OR UPDATE ON event_promo
  FOR EACH ROW
  EXECUTE FUNCTION cek_overlap_event_promo();

-- Trigger guard produk paket
CREATE TRIGGER trg_guard_produk_paket
  BEFORE INSERT OR UPDATE ON produk
  FOR EACH ROW
  EXECUTE FUNCTION guard_produk_paket();
```

### Step 1.8: Verifikasi Data

```bash
# Cek jumlah data per tabel
psql -h localhost -U pos_user -d pos_sobatti -c "
SELECT 'kategori' as tbl, count(*) FROM kategori
UNION ALL SELECT 'satuan', count(*) FROM satuan
UNION ALL SELECT 'merk', count(*) FROM merk
UNION ALL SELECT 'produk', count(*) FROM produk
UNION ALL SELECT 'pengguna', count(*) FROM pengguna
UNION ALL SELECT 'pelanggan', count(*) FROM pelanggan
UNION ALL SELECT 'supplier', count(*) FROM supplier
UNION ALL SELECT 'transaksi_keluar', count(*) FROM transaksi_keluar
UNION ALL SELECT 'detail_transaksi_keluar', count(*) FROM detail_transaksi_keluar
UNION ALL SELECT 'barang_masuk', count(*) FROM barang_masuk
UNION ALL SELECT 'absensi', count(*) FROM absensi
ORDER BY tbl;
"

# Cek sample data
psql -h localhost -U pos_user -d pos_sobatti -c "SELECT id, nama_produk, stok FROM produk LIMIT 5;"
psql -h localhost -U pos_user -d pos_sobatti -c "SELECT id, username, level FROM pengguna;"
```

---

## 4. PHASE 2: AUTH SYSTEM CUSTOM

**Estimasi:** 3-5 hari
**Goal:** Ganti Supabase Auth dengan custom JWT + bcrypt + session cookies

### Step 2.1: Buat `lib/auth.ts`

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = "session_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export interface SessionUser {
  id: number;
  username: string;
  role: string; // ADMIN, KASIR, OWNER, KARYAWAN
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Sign JWT
export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT(user as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

// Verify JWT
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

// Set session cookie
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

// Get session from cookies
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

### Step 2.2: Buat `lib/db.ts` (Prisma Singleton)

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Step 2.3: Rewrite Login Route

**File:** `app/api/auth/login/route.ts`

```typescript
// SEBELUM (Supabase):
// import { createServerClient } from "@supabase/ssr";
// const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// SESUDAH (Custom):
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, signToken, setSessionCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Transform email: jika tidak ada @, tambahkan @sobats.com
  const loginEmail = email.includes("@") ? email : `${email}@sobats.com`;
  const username = loginEmail.split("@")[0];

  // Cari user di database
  const pengguna = await prisma.pengguna.findUnique({
    where: { username },
  });

  if (!pengguna) {
    return NextResponse.json(
      { error: "Username atau password salah" },
      { status: 401 }
    );
  }

  if (!pengguna.aktif) {
    return NextResponse.json(
      { error: "Akun Anda dinonaktifkan. Hubungi admin." },
      { status: 401 }
    );
  }

  // Verify password
  const valid = await verifyPassword(password, pengguna.password);
  if (!valid) {
    return NextResponse.json(
      { error: "Username atau password salah" },
      { status: 401 }
    );
  }

  // Sign JWT
  const token = await signToken({
    id: pengguna.id,
    username: pengguna.username,
    role: pengguna.level,
  });

  // Set cookie
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, role: pengguna.level });
}
```

### Step 2.4: Rewrite `lib/supabase/server.ts` → `lib/auth.ts` (helper)

Ganti semua usage di server components:

```typescript
// SEBELUM:
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/");
const role = user.user_metadata?.role;

// SESUDAH:
import { getSessionUser } from "@/lib/auth";
const user = await getSessionUser();
if (!user) redirect("/");
const role = user.role;
```

### Step 2.5: Update `lib/supabase/client.ts` → Browser Auth

```typescript
// lib/auth-client.ts
"use client";

import { jwtDecode } from "jwt-decode";

interface ClientUser {
  id: number;
  username: string;
  role: string;
}

export function getClientUser(): ClientUser | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  if (!token) return null;

  try {
    const decoded = jwtDecode<ClientUser>(token);
    // Cek expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
```

### Step 2.6: Update Logout di 5 Lokasi

```typescript
// SEBELUM (5 file):
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
await supabase.auth.signOut();
router.push("/");
router.refresh();

// SESUDAH:
import { clearSessionCookie } from "@/lib/auth";
await clearSessionCookie();
router.push("/");
router.refresh();
```

File yang harus diupdate:
- `components/logout-button.tsx`
- `components/dashboard-sidebar.tsx` (baris ~71)
- `components/dashboard-mobile-nav.tsx` (baris ~61)
- `app/pos/pos-client.tsx` (baris ~119)
- `app/api/auth/login/route.ts` (baris ~65, forced signout)

### Step 2.7: Update User Management

**File:** `app/dashboard/settings/users/actions.ts`

Ganti semua `supabaseAdmin.auth.admin.*` dengan direct Prisma queries:

```typescript
// SEBELUM:
const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { role: level, username },
});

// SESUDAH:
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const hashedPassword = await hashPassword(password);
const newUser = await prisma.pengguna.create({
  data: {
    username,
    password: hashedPassword,
    level,
    nama,
    aktif: true,
  },
});
```

```typescript
// SEBELUM:
const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();

// SESUDAH:
const users = await prisma.pengguna.findMany({
  select: { id: true, username: true, level: true, nama: true, aktif: true },
  orderBy: { id: "asc" },
});
```

### Step 2.8: Update Role Checks

36 lokasi yang akses `user.user_metadata?.role` harus diupdate:

```typescript
// SEBELUM:
const role = user.user_metadata?.role;

// SESUDAH (sudah di-handle di Step 2.4):
const role = user.role; // dari SessionUser interface
```

---

## 5. PHASE 3: DATABASE QUERY LAYER (PRISMA)

**Estimasi:** 5-7 hari
**Goal:** Ganti semua `supabase.from()` calls dengan Prisma queries

### Step 3.1: Pattern Translation Guide

| Supabase Pattern | Prisma Equivalent |
|-----------------|-------------------|
| `.from("produk").select("id, nama")` | `prisma.produk.findMany({ select: { id: true, nama: true } })` |
| `.from("produk").select("*").eq("id", 1).single()` | `prisma.produk.findUnique({ where: { id: 1 } })` |
| `.from("produk").select("*").eq("id", 1).maybeSingle()` | `prisma.produk.findUnique({ where: { id: 1 } })` |
| `.from("produk").select("*").eq("id", 1)` | `prisma.produk.findMany({ where: { id: 1 } })` |
| `.from("produk").select("*").ilike("nama", "%abc%")` | `prisma.produk.findMany({ where: { nama_produk: { contains: "abc", mode: "insensitive" } } })` |
| `.from("produk").select("*").or("a.ilike.x,b.ilike.y")` | `prisma.produk.findMany({ where: { OR: [{ nama: { contains: "x", mode: "insensitive" } }, { barcode: { contains: "y", mode: "insensitive" } }] } })` |
| `.from("produk").select("*").in("id", [1,2,3])` | `prisma.produk.findMany({ where: { id: { in: [1,2,3] } } })` |
| `.from("produk").select("*").gte("stok", 5)` | `prisma.produk.findMany({ where: { stok: { gte: 5 } } })` |
| `.from("produk").select("*").order("nama")` | `prisma.produk.findMany({ orderBy: { nama_produk: "asc" } })` |
| `.from("produk").select("*").range(0, 99)` | `prisma.produk.findMany({ skip: 0, take: 100 })` |
| `.from("produk").insert(data)` | `prisma.produk.create({ data })` |
| `.from("produk").update(data).eq("id", 1)` | `prisma.produk.update({ where: { id: 1 }, data })` |
| `.from("produk").delete().eq("id", 1)` | `prisma.produk.delete({ where: { id: 1 } })` |
| `.from("produk").upsert(data, { onConflict: "id" })` | `prisma.produk.upsert({ where: { id: data.id }, create: data, update: data })` |
| `.from("produk").select("*", { count: "exact", head: true })` | `prisma.produk.count()` |
| `.rpc("function_name", { params })` | `prisma.$queryRaw\`SELECT * FROM function_name(${params})\`` |
| `.select("..., pelanggan(nama)")` (FK join) | `include: { pelanggan: { select: { nama_pelanggan: true } } }` |
| `.select("..., pengguna!fk_name(nama)")` | `include: { pengguna: { select: { nama: true } } }` |

### Step 3.2: Contoh Implementasi per Modul

#### Modul Produk (CRUD)

```typescript
// app/dashboard/inventory/actions.ts

import { prisma } from "@/lib/db";

// GET produk
export async function getProducts() {
  return prisma.produk.findMany({
    include: {
      kategori: { select: { nama: true } },
      satuan: { select: { nama: true } },
      merk: { select: { nama: true } },
    },
    orderBy: { nama_produk: "asc" },
  });
}

// CREATE produk
export async function createProduct(data: any) {
  return prisma.produk.create({ data });
}

// UPDATE produk
export async function updateProduct(id: number, data: any) {
  return prisma.produk.update({ where: { id }, data });
}

// DELETE produk
export async function deleteProduct(id: number) {
  // Hapus relasi manual (cascade delete)
  await prisma.event_promo_produk.deleteMany({ where: { id_produk: id } });
  await prisma.stok_opname.deleteMany({ where: { id_produk: id } });
  await prisma.barang_masuk.deleteMany({ where: { id_produk: id } });
  await prisma.riwayat_avco.deleteMany({ where: { id_produk: id } });
  await prisma.detail_transaksi_keluar.deleteMany({ where: { id_produk: id } });
  return prisma.produk.delete({ where: { id } });
}
```

#### Modul Transaksi

```typescript
// app/dashboard/transactions/page.tsx

const [transactions, paymentMethods] = await Promise.all([
  prisma.transaksi_keluar.findMany({
    include: {
      pengguna: { select: { username: true, nama: true } },
      pelanggan: { select: { nama_pelanggan: true } },
      metode_bayar: { select: { id: true, nama: true } },
    },
    orderBy: { tgl_transaksi: "desc" },
    skip: page * pageSize,
    take: pageSize,
  }),
  prisma.metode_bayar.findMany({ orderBy: { nama: "asc" } }),
]);
```

#### Modul Pelanggan

```typescript
// app/dashboard/customers/actions.ts

import { prisma } from "@/lib/db";

export async function addCustomer(data: any) {
  return prisma.pelanggan.create({ data });
}

export async function updateCustomer(id: number, data: any) {
  return prisma.pelanggan.update({ where: { id }, data });
}

export async function deleteCustomer(id: number, name: string) {
  if (name.toUpperCase() === "UMUM") {
    return { error: "Pelanggan UMUM tidak dapat dihapus" };
  }
  return prisma.pelanggan.delete({ where: { id } });
}
```

### Step 3.3: Handle `fetchAllRows` (Pagination Helper)

```typescript
// lib/fetch-all.ts

import { prisma } from "./db";

type FindManyArgs = Parameters<typeof prisma.produk.findMany>[0];

export async function fetchAllRows<T>(
  model: { findMany: (args: any) => Promise<T[]> },
  baseArgs: any,
  pageSize: number = 1000
): Promise<T[]> {
  let allRows: T[] = [];
  let offset = 0;

  while (true) {
    const rows = await model.findMany({
      ...baseArgs,
      skip: offset,
      take: pageSize,
    });
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}
```

### Step 3.4: Update Error Handling

```typescript
// SEBELUM (Supabase):
const { error } = await supabase.from("produk").insert([data]);
if (error) {
  if (error.code === "23505") return { error: "Data sudah ada" };
  return { error: "Gagal menambah produk" };
}

// SESUDAH (Prisma):
import { Prisma } from "@prisma/client";
try {
  await prisma.produk.create({ data });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { error: "Data sudah ada" };
    if (e.code === "P2003") return { error: "Referensi tidak ditemukan" };
  }
  return { error: "Gagal menambah produk" };
}
```

### Step 3.5: File yang Harus Diupdate

| File | Operasi | Estimasi |
|------|---------|----------|
| `app/dashboard/inventory/actions.ts` | SELECT, INSERT, UPDATE, DELETE, UPSERT | 2 hari |
| `app/dashboard/customers/actions.ts` | CRUD pelanggan | 0.5 hari |
| `app/dashboard/suppliers/actions.ts` | CRUD supplier | 0.5 hari |
| `app/dashboard/transactions/actions.ts` | DELETE transaksi | 0.5 hari |
| `app/dashboard/settings/actions.ts` | UPDATE pengaturan | 0.5 hari |
| `app/dashboard/settings/store-actions.ts` | UPSERT pengaturan | 0.5 hari |
| `app/dashboard/settings/keuangan/actions.ts` | UPSERT pengaturan_keuangan | 0.5 hari |
| `app/dashboard/settings/reference-data/actions.ts` | CRUD kategori/satuan/merk | 0.5 hari |
| `app/dashboard/inventory/stock-in/actions.ts` | Complex queries + joins | 1 hari |
| `app/dashboard/inventory/stock-opname/actions.ts` | Complex queries | 1 hari |
| `app/api/pos/products/route.ts` | Search + pagination | 0.5 hari |
| `app/api/pos/barcode/route.ts` | Search by barcode | 0.5 hari |
| `app/api/pos/customers/route.ts` | Select pelanggan | 0.5 hari |
| `app/api/pos/payment-methods/route.ts` | Select metode_bayar | 0.5 hari |
| `app/api/pos/checkout/route.ts` | Complex queries | 1 hari |
| `app/api/pos/member-register/route.ts` | INSERT pelanggan | 0.5 hari |
| `app/api/pos/member-search/route.ts` | Search member | 0.5 hari |
| `app/api/laporan/penjualan/route.ts` | Complex queries + joins | 1 hari |
| `app/api/laporan/penjualan/[id]/route.ts` | Select detail | 0.5 hari |
| `app/api/laporan/penjualan/rekap/route.ts` | Complex queries | 1 hari |
| `app/api/laporan/penjualan/export/route.ts` | Export queries | 0.5 hari |
| `app/api/attendance/*.ts` | Attendance queries | 1 hari |
| `app/api/low-stock/route.ts` | Low stock query | 0.5 hari |
| `lib/dashboard.ts` | Dashboard stats | 0.5 hari |
| `lib/low-stock.ts` | Low stock query | 0.5 hari |
| `lib/attendance.ts` | Attendance queries | 0.5 hari |
| `lib/laporan-kasir.ts` | Cash summary | 1 hari |
| `lib/laporan-keuangan.ts` | Financial reports | 1 hari |
| `lib/avco.ts` | AVCO calculations | 0.5 hari |
| `app/dashboard/buka-kasir/*.ts` | Buka kasir | 0.5 hari |
| `app/dashboard/tutup-kasir/*.ts` | Tutup kasir | 0.5 hari |
| `app/dashboard/laporan-kasir/*.ts` | Laporan kasir | 0.5 hari |
| `app/dashboard/keuangan/*.ts` | Keuangan | 1 hari |
| `app/dashboard/event-promo/*.ts` | Event promo | 0.5 hari |

---

## 6. PHASE 4: RPC FUNCTIONS KE PRISMA TRANSACTIONS

**Estimasi:** 1-2 hari
**Goal:** Ganti `supabase.rpc()` dengan Prisma `$queryRaw` atau Prisma transactions

### Step 4.1: RPC Calling Pattern

```typescript
// lib/rpc.ts

import { prisma } from "./db";

export async function rpc<T = any>(
  functionName: string,
  params: Record<string, any>
): Promise<T> {
  // Build parameterized query
  const keys = Object.keys(params);
  const values = Object.values(params);

  // PostgreSQL named parameters: function_name(p1 => $1, p2 => $2)
  const paramStr = keys
    .map((k, i) => `"${k}" => $${i + 1}`)
    .join(", ");

  const result = await prisma.$queryRawUnsafe<T>(
    `SELECT * FROM ${functionName}(${paramStr})`,
    ...values
  );

  return result;
}
```

### Step 4.2: Update RPC Calls

```typescript
// SEBELUM:
const { data, error } = await supabase.rpc("process_checkout", {
  p_items: itemsForRpc,
  p_id_kasir: id_kasir,
  // ...
});

// SESUDAH:
import { rpc } from "@/lib/rpc";

try {
  const result = await rpc("process_checkout", {
    p_items: itemsForRpc,
    p_id_kasir: id_kasir,
    p_id_pelanggan: id_pelanggan || null,
    p_id_metode_bayar: id_metode_bayar,
    p_diskon_persen: diskon_persen || 0,
    p_bayar: bayar ?? 0,
    p_pajak_persen: pajak_persen,
    p_is_dp: isDP,
  });
} catch (e: any) {
  const msg = e.message ?? "";
  const domainErrors = [
    "Stok tidak mencukupi",
    "Pelanggan harus dipilih",
    "Jumlah bayar kurang",
    "tidak ditemukan",
    "Qty tidak valid",
  ];
  if (domainErrors.some((d) => msg.includes(d))) {
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(
    { error: "Gagal memproses checkout" },
    { status: 500 }
  );
}
```

### Step 4.3: File RPC yang Harus Diupdate

| File | RPC Call |
|------|----------|
| `app/api/pos/checkout/route.ts` | `process_checkout`, `increment_point` |
| `app/api/pos/member-register/route.ts` | `reset_pelanggan_id_seq` |
| `app/dashboard/inventory/stock-in/actions.ts` | `process_barang_masuk`, `cancel_barang_masuk`, `process_retur_pembelian` |
| `app/dashboard/inventory/stock-opname/actions.ts` | `process_stok_opname_apply`, `batalkan_sesi_stok_opname` |
| `app/dashboard/inventory/actions.ts` | `process_isi_stok_paket` |
| `lib/laporan-keuangan.ts` | `get_inventory_value_at_date` |
| `lib/activity-log.ts` | `tambah_log_aktivitas` |

---

## 7. PHASE 5: ADMIN CLIENT & SERVICE LAYER

**Estimasi:** 1 hari
**Goal:** Ganti `supabaseAdmin` dengan direct Prisma queries

### Step 7.1: Hapus `lib/supabase/admin.ts`

`supabaseAdmin` di Supabase berguna untuk bypass RLS. Di PostgreSQL biasa tanpa RLS, tidak perlu. Cukup pakai `prisma` biasa.

### Step 7.2: Ganti Semua Import `supabaseAdmin`

```typescript
// SEBELUM:
import { supabaseAdmin } from "@/lib/supabase/admin";
const { error } = await supabaseAdmin.from("produk").delete().eq("id", id);

// SESUDAH:
import { prisma } from "@/lib/db";
await prisma.produk.delete({ where: { id } });
```

### Step 7.3: File yang Harus Diupdate

- `app/dashboard/inventory/actions.ts` (6 lokasi)
- `app/dashboard/settings/users/actions.ts` (8 lokasi)
- `app/api/pos/member-register/route.ts` (1 lokasi)

---

## 8. PHASE 6: REALTIME → POLLING

**Estimasi:** 1 hari
**Goal:** Ganti Supabase Realtime subscription dengan polling

### Step 8.1: Update `hooks/use-low-stock-realtime.ts`

```typescript
// SEBELUM (Supabase Realtime):
channel = supabaseClient
  .channel("low-stock-global")
  .on("postgres_changes", { event: "*", table: "produk" }, () => {
    fetchItems();
  })
  .subscribe();

// SESUDAH (Polling):
useEffect(() => {
  fetchItems(); // initial fetch
  const interval = setInterval(fetchItems, 10000); // poll tiap 10 detik
  return () => clearInterval(interval);
}, []);
```

### Step 8.2: Buat API Endpoint untuk Low Stock

```typescript
// app/api/low-stock/route.ts

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const lowStockItems = await prisma.produk.findMany({
    where: {
      hitung_stok: true,
      OR: [
        { stok: { gt: 0, lte: prisma.raw("stok_minimum") } },
        {
          stok_minimum_gudang: { not: null },
          stok_gudang: { lte: prisma.raw("stok_minimum_gudang") },
        },
      ],
    },
    include: {
      kategori: { select: { nama: true } },
      satuan: { select: { nama: true } },
    },
  });

  return NextResponse.json(lowStockItems);
}
```

---

## 9. PHASE 7: CLEANUP & TESTING

**Estimasi:** 2-3 hari
**Goal:** Hapus dependencies Supabase, testing menyeluruh

### Step 9.1: Hapus Dependencies

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

### Step 9.2: Hapus File Lama

```bash
rm -f lib/supabase/server.ts
rm -f lib/supabase/client.ts
rm -f lib/supabase/admin.ts
rm -f lib/supabase/fetch-all.ts
rm -f proxy.ts
```

### Step 9.3: Update `.gitignore`

```gitignore
# Tambahkan:
prisma/migrations/

# Hapus:
# .env (tetap di gitignore)
```

### Step 9.4: Update `next.config.ts`

Hapus `serverActions.allowedOrigins` yang reference Supabase:

```typescript
// SEBELUM:
serverActions: {
  allowedOrigins: [getLocalIp(), "localhost:3000", "*.trycloudflare.com"],
},

// SESUDAH:
serverActions: {
  allowedOrigins: [getLocalIp(), "localhost:3000"],
},
```

### Step 9.5: Testing Checklist

| Area | Test Case | Status |
|------|-----------|--------|
| **Auth** | Login dengan username + password | ☐ |
| **Auth** | Login gagal (password salah) | ☐ |
| **Auth** | Login user nonaktif → ditolak | ☐ |
| **Auth** | Logout → session hilang | ☐ |
| **Auth** | Role KASIR → redirect ke /pos | ☐ |
| **Auth** | Role ADMIN → redirect ke /dashboard | ☐ |
| **Auth** | Role KARYAWAN → redirect ke /attendance/scan | ☐ |
| **POS** | Search produk | ☐ |
| **POS** | Tambah produk ke cart | ☐ |
| **POS** | Ubah qty | ☐ |
| **POS** | Checkout tunai | ☐ |
| **POS** | Checkout dengan diskon | ☐ |
| **POS** | Checkout dengan pajak | ☐ |
| **POS** | Checkout dengan DP | ☐ |
| **POS** | Cetak struk/faktur | ☐ |
| **Inventory** | CRUD produk | ☐ |
| **Inventory** | Import CSV produk | ☐ |
| **Inventory** | Restock display dari gudang | ☐ |
| **Inventory** | Barcode generation | ☐ |
| **Inventory** | Price tag generation | ☐ |
| **Stock In** | Barang masuk (single item) | ☐ |
| **Stock In** | Barang masuk (multi item) | ☐ |
| **Stock In** | Batalkan barang masuk | ☐ |
| **Stock In** | Retur pembelian | ☐ |
| **Stock Opname** | Buat sesi opname | ☐ |
| **Stock Opname** | Isi stok fisik | ☐ |
| **Stock Opname** | Apply opname | ☐ |
| **Stock Opname** | Batalkan sesi | ☐ |
| **Pelanggan** | CRUD pelanggan | ☐ |
| **Supplier** | CRUD supplier | ☐ |
| **Kategori** | CRUD kategori | ☐ |
| **Satuan** | CRUD satuan | ☐ |
| **Merk** | CRUD merk | ☐ |
| **Transaksi** | Lihat riwayat transaksi | ☐ |
| **Transaksi** | Detail transaksi | ☐ |
| **Transaksi** | Void transaksi | ☐ |
| **Laporan** | Laporan penjualan | ☐ |
| **Laporan** | Export CSV | ☐ |
| **Laporan** | Rekap penjualan | ☐ |
| **Laporan** | Laba rugi | ☐ |
| **Laporan** | Neraca | ☐ |
| **Kasir** | Buka kasir | ☐ |
| **Kasir** | Tutup kasir | ☐ |
| **Kasir** | Laporan kas harian | ☐ |
| **Keuangan** | Pengeluaran | ☐ |
| **Keuangan** | Arus kas | ☐ |
| **Absensi** | Generate QR | ☐ |
| **Absensi** | Scan QR (HP) | ☐ |
| **Absensi** | Check-in | ☐ |
| **Absensi** | Check-out | ☐ |
| **Absensi** | Riwayat absensi | ☐ |
| **Absensi** | Laporan absensi pegawai | ☐ |
| **Settings** | Update profil | ☐ |
| **Settings** | Update pengaturan toko | ☐ |
| **Settings** | Update pengaturan keuangan | ☐ |
| **Settings** | CRUD users | ☐ |
| **Low Stock** | Widget dashboard | ☐ |
| **Low Stock** | Banner | ☐ |
| **Low Stock** | Badge sidebar | ☐ |
| **Member** | Poin member | ☐ |
| **Member** | Register member baru | ☐ |
| **Scanner** | SSE relay | ☐ |

---

## 10. PHASE 8: DEPLOY KE VPS

**Estimasi:** 1 hari
**Goal:** Deploy aplikasi yang sudah dimigrasi ke VPS

### Branch Strategy

```
dev  ← push perubahan kode di sini dulu
 │
 └─→ main  ← merge ke main hanya jika sudah dicek di lokal
       │
       └─→ Deploy otomatis ke VPS (triggered by push to main)
```

**Alur:**
1. Semua perubahan kode di-push ke branch `dev` dulu
2. Cek & test di lokal (branch `dev`)
3. Jika sudah oke, merge `dev` → `main`
4. Push ke `main` → otomatis trigger deploy ke VPS via GitHub Actions

**Kenapa workflow hanya trigger di `main`:**
```yaml
on:
  push:
    branches: [main]  # ← hanya main yang trigger deploy
```
Push ke branch `dev` tidak akan trigger deploy. Aman untuk trial and error.

### Step 10.1: Setup PostgreSQL di VPS

(Lihat Phase 2 di atas)

### Step 10.2: Push Schema ke Database

```bash
# Di local development
npx prisma migrate dev --name init

# Commit migration files ke branch dev
git checkout -b dev
git add prisma/
git commit -m "feat: prisma schema migration"

# Push ke branch dev
git push origin dev

# Cek di lokal, test, pastikan OK

# Jika sudah oke, merge ke main
git checkout main
git merge dev
git push origin main
# → Deploy otomatis ter-trigger
```

### Step 10.3: Update Deploy Workflow

**File:** `.github/workflows/deploy.yml`

Tambahkan `npx prisma migrate deploy` di dalam heredoc SSH script, **setelah** `.env` di-link tapi **sebelum** PM2 reload:

```yaml
- name: Deploy on VPS (extract, symlink, reload, health check, rollback on failure)
  env:
    RELEASE: ${{ steps.vars.outputs.release }}
  run: |
    ssh -p ${{ secrets.VPS_PORT || 22 }} ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} \
      "..." bash -s" <<'ENDSSH'
    set -euo pipefail

    # ... (load nvm, extract, dll)

    echo ">> Linking shared runtime env"
    mkdir -p "$DEPLOY_PATH/shared"
    if [ -f "$DEPLOY_PATH/shared/.env" ]; then
      ln -sf "$DEPLOY_PATH/shared/.env" "$RELEASE_DIR/.env"
    fi

    echo ">> Running Prisma migrations"
    cd "$RELEASE_DIR"
    npx prisma migrate deploy

    echo ">> Switching current symlink (atomic)"
    ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

    # ... (PM2 reload, health check, dll)
    ENDSSH
```

**Urutan di deploy script:**

| Step | Keterangan |
|------|-----------|
| 1. Extract release | File code sudah ada |
| 2. Link shared `.env` | `DATABASE_URL` sudah tersedia |
| 3. `npx prisma migrate deploy` | **Migration jalan otomatis di sini** |
| 4. Switch symlink | Code baru aktif |
| 5. PM2 reload | Server restart dengan code baru |
| 6. Health check | Pastikan server jalan |

**Kenapa di posisi ini:**
- `.env` sudah di-link → `DATABASE_URL` tersedia
- Release sudah extracted → `prisma/schema.prisma` sudah ada
- Sebelum PM2 reload → database sudah updated sebelum code baru jalan
- Jika migration gagal → PM2 tidak reload, deployment gagal (fail-fast)

> **Satu-satunya tempat migration dijalankan adalah di CI/CD ini.** Tidak perlu manual di VPS.

### Step 10.4: Setup Shared `.env` di VPS

```bash
# Di VPS
mkdir -p /var/www/pos-sobatti/shared
cat > /var/www/pos-sobatti/shared/.env << 'EOF'
DATABASE_URL="postgresql://pos_user:PASSWORD@localhost:6432/pos_sobatti"
JWT_SECRET="random-64-characters-here"
STORE_LATITUDE=-7.xxx
STORE_LONGITUDE=110.xxx
MAX_ATTENDANCE_RADIUS=50
QR_EXPIRE_SECONDS=30
ATTENDANCE_START_TIME=09:00
ATTENDANCE_TOLERANCE_MINUTES=10
EOF

chmod 600 /var/www/pos-sobatti/shared/.env
```

### Step 10.5: Migrate Functions ke VPS

```bash
# Jalankan functions di VPS
psql -h localhost -U pos_user -d pos_sobatti -f prisma/migrations/functions.sql
```

### Step 10.6: Restart PM2

```bash
pm2 restart pos-sobatti
```

---

## 11. CHECKLIST PER PHASE

### Phase 1: Schema Migration ☐
- [ ] Dump schema dari Supabase
- [ ] Buat Prisma schema
- [ ] Generate & push ke PostgreSQL
- [ ] Migrate PL/pgSQL functions
- [ ] Migrate triggers
- [ ] Migrate data (jika perlu)
- [ ] Verifikasi di Prisma Studio

### Phase 2: Auth System ☐
- [ ] Buat `lib/auth.ts`
- [ ] Buat `lib/db.ts` (Prisma singleton)
- [ ] Rewrite login route
- [ ] Rewrite server component auth check
- [ ] Update browser auth
- [ ] Update logout (5 lokasi)
- [ ] Update user management
- [ ] Update role checks (36 lokasi)
- [ ] Test login/logout
- [ ] Test role-based access

### Phase 3: Query Layer ☐
- [ ] Update inventory actions
- [ ] Update customer actions
- [ ] Update supplier actions
- [ ] Update transaction actions
- [ ] Update settings actions
- [ ] Update POS routes
- [ ] Update laporan routes
- [ ] Update attendance routes
- [ ] Update dashboard lib
- [ ] Update fetchAllRows helper
- [ ] Update error handling

### Phase 4: RPC Functions ☐
- [ ] Buat `lib/rpc.ts`
- [ ] Update process_checkout
- [ ] Update increment_point
- [ ] Update process_barang_masuk
- [ ] Update cancel_barang_masuk
- [ ] Update process_retur_pembelian
- [ ] Update process_stock_opname
- [ ] Update batalkan_sesi_stok_opname
- [ ] Update process_isi_stok_paket
- [ ] Update get_inventory_value_at_date
- [ ] Update tambah_log_aktivitas

### Phase 5: Admin Client ☐
- [ ] Ganti supabaseAdmin → prisma (6 file)
- [ ] Hapus lib/supabase/admin.ts

### Phase 6: Realtime → Polling ☐
- [ ] Update use-low-stock-realtime hook
- [ ] Pastikan polling interval optimal

### Phase 7: Cleanup & Testing ☐
- [ ] Hapus @supabase/ssr & @supabase/supabase-js
- [ ] Hapus file lama
- [ ] Update next.config.ts
- [ ] Testing menyeluruh (semua test case)

### Phase 8: Deploy ☐
- [ ] Setup PostgreSQL di VPS
- [ ] Setup PgBouncer di VPS
- [ ] Setup shared/.env
- [ ] Update deploy workflow (opsional, karena migration di VPS)
- [ ] Push ke branch `dev` → cek di lokal
- [ ] Merge `dev` → `main` → deploy otomatis
- [ ] Jalankan migration di VPS (`npx prisma migrate deploy`)
- [ ] Migrate functions ke VPS
- [ ] Restart PM2
- [ ] Health check
- [ ] Rollback plan siap

---

## 12. TROUBLESHOOTING

### Error: `P1001 - Can't reach database server`

```bash
# Cek PostgreSQL running
sudo systemctl status postgresql

# Cek koneksi
psql -h localhost -U pos_user -d pos_sobatti -c "SELECT 1"

# Cek pg_hba.conf (allow local connections)
sudo nano /etc/postgresql/17/main/pg_hba.conf
# Pastikan ada: local all all trust (atau md5)
```

### Error: `P2002 - Unique constraint failed`

```typescript
// Prisma error code P2002 = Supabase error code 23505
// Handle dengan Prisma.PrismaClientKnownRequestError
```

### Error: `P2003 - Foreign key constraint failed`

```typescript
// Prisma error code P2003 = Supabase error code 23503
// Handle dengan cek relasi sebelum delete
```

### Error: `P2024 - Timed out fetching connection`

```typescript
// Cek PgBouncer running di VPS
// Cek connection_limit di PgBouncer config (bukan di DATABASE_URL)
// PgBouncer default pool_mode: transaction
```

### Error: `Cannot find module '@prisma/client'`

```bash
npx prisma generate
```

### Error: `QualifiedName not found` (Prisma schema)

```bash
# Prisma schema error - cek relasi
npx prisma format
npx prisma validate
```

---

## ROLLBACK PLAN

Jika migrasi gagal, kembalikan ke Supabase:

1. Revert semua code changes (`git checkout origin/main`)
2. Pastikan Supabase Cloud masih aktif
3. Update env variables kembali ke Supabase
4. Deploy versi lama

```bash
# Quick rollback
git checkout origin/main -- lib/supabase/
git checkout origin/main -- app/
npm install @supabase/ssr @supabase/supabase-js
npm run build
```
