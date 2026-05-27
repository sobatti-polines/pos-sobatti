# POS App — Attendance Module To-Do List

> Tracks all implementation steps from `techspec_attendance_module_pos_sobatti.md`.
> Mark `[x]` when complete, `[/]` when in progress.
> DB schema and new API routes need to be created from scratch.

---

## 🔴 Critical — Database & Core APIs (Phase 1 & 2)

These form the foundation of the attendance module and must be completed first.

- [x] **1. Database Schema Setup**
  - Create `absensi` table (relates to `pengguna`, fields: tanggal, jam_masuk, jam_pulang, status, telat_menit, lat/long, etc.)
  - Create `qr_session` table (token, expired_at, is_active, created_by)
  - Add recommended indexes (`idx_absensi_pengguna`, `idx_absensi_tanggal`, `idx_qr_session_token`, `idx_qr_session_expired`)

- [x] **2. Environment Variables & Dependencies**
  - Add `STORE_LATITUDE`, `STORE_LONGITUDE`, `MAX_ATTENDANCE_RADIUS` (50), `QR_EXPIRE_SECONDS` (30) to `.env`
  - Install dependencies: `html5-qrcode` (skipped, using existing `@zxing`), `qrcode`, `next-pwa`, `@tanstack/react-table`, `zod`, `react-hook-form`

- [x] **3. Attendance API Routes**
  - `POST /api/attendance/generate-qr`: Generate dynamic UUID token, 30s expiration (Admin/Owner only)
  - `POST /api/attendance/checkin`: Validate QR token, calculate distance from store GPS, check > 09:15 for `TELAT` status, check duplicate
  - `POST /api/attendance/checkout`: Record checkout time, ensure already checked in
  - `GET /api/attendance/history`: Fetch personal history for current user
  - `GET /api/admin/attendance`: Fetch all records for Admin/Owner with pagination/filters

---

## 🟠 Important — Core UI & Scanning (Phase 3 & 4)

The primary user interfaces for generating and scanning QR codes.

- [x] **4. QR Generation Page (Admin/Owner)**
  - Route: `/dashboard/attendance/generate-qr`
  - Display dynamic QR code using `qrcode`
  - Auto-refresh every 30 seconds with a visual countdown timer

- [x] **5. QR Scanning Page (Admin/Cashier)**
  - Route: `/dashboard/attendance/scan`
  - Use existing `@zxing/browser` to scan from mobile camera
  - Request browser GPS permission on scan
  - Post payload to API and display success/error notification (handle expired/out-of-radius)

- [x] **6. Employee Dashboard & History**
  - Route: `/dashboard`: Add attendance widget showing today's status, check-in/out times, and a "Quick Scan" button
  - Route: `/dashboard/attendance/history`: Display personal attendance history, monthly view, and late statistics

---

## 🟡 Nice-to-have — Admin Reports & PWA (Phase 4 & 5)

Polish items and advanced features for administration and mobile experience.

- [x] **7. Admin Attendance Report Page**
  - Route: `/dashboard/attendance/report`
  - Show full attendance data using `@tanstack/react-table` with search, date filters, pagination
  - Add "Export to CSV" functionality
  - Integrate Supabase Realtime for live updates when an employee checks in/out

- [ ] **8. PWA Integration**
  - Configure `next-pwa` in `next.config.ts`
  - Create web manifest (app name, icons, theme color, splash screen)
  - Setup Service Worker to cache static layout shell and fonts (strictly do NOT cache QR tokens or API responses)

---

## Progress Tracker

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| 🔴 Critical | 3 | 3 | 0 |
| 🟠 Important | 3 | 3 | 0 |
| 🟡 Nice-to-have | 2 | 1 | 1 |
| **Total** | **8** | **7** | **1** |

> Last updated: 2026-05-26
