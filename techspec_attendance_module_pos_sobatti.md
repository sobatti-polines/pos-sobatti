# Attendance Module Technical Specification
## POS Sobatti — QR Attendance System
Version: 1.0
Last Updated: 2026-05-26

---

# 1. Overview

## 1.1 Purpose

This document defines the complete technical specification for the Attendance Module integrated into the POS Sobatti system.

The attendance system allows:
- Admin and cashier employees to perform attendance using QR scanning
- Owners to monitor attendance activity
- Attendance validation using dynamic QR tokens
- Mobile-friendly access through PWA
- GPS validation
- Attendance reporting

This specification is intended for:
- AI coding agents
- Fullstack developers
- Backend developers
- Frontend developers
- Database engineers

The goal is to eliminate ambiguity during implementation.

---

# 2. System Architecture

## 2.1 Technology Stack

### Frontend (use what is already there, add if needed)
- Next.js 15+
- React 19+
- TypeScript
- Tailwind CSS
- PWA support
- Zustand or Context API
- React Query / TanStack Query

### Backend (use what is already there, add if needed)
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage

### Deployment
- Vercel

---

# 3. Business Requirements

## 3.1 Attendance Rules

### Working Hours
- Start: 09:00
- End: 17:00

### Late Tolerance
- 15 minutes

### Attendance Status Rules

| Condition | Status |
|---|---|
| Check-in <= 09:15 | HADIR |
| Check-in > 09:15 | TELAT |
| No attendance | ALPHA |

---

# 4. User Roles

## 4.1 ADMIN
Permissions:
- Login
- Check-in/check-out
- View own attendance history

## 4.2 KASIR
Permissions:
- Login
- Check-in/check-out
- View own attendance history

## 4.3 OWNER
Permissions:
- Login
- Generate QR attendance
- View attendance reports
- View employee attendance history
- View all reports
- View attendance analytics
- Cannot perform attendance

---

# 5. Functional Requirements

# 5.1 Authentication

Authentication uses existing `pengguna` table.

No new authentication table required.

### Allowed Attendance Users
- ADMIN
- KASIR

### Restricted Users
- OWNER cannot perform attendance scanning

---

# 5.2 Attendance Flow

## Check-In Flow (user = admin and cashier)

1. User login
2. User opens scan page
3. Owner generates QR session
4. User scans QR
5. Browser requests GPS permission
6. System validates:
   - QR token active
   - QR token not expired
   - User role valid
   - User not already checked-in
   - GPS within allowed radius
7. System records attendance
8. Success notification displayed

---

## Check-Out Flow (user = admin and cashier)

1. User opens scan page
2. User scans QR
3. System validates:
   - User already checked-in
   - User has not checked-out
4. System records checkout timestamp

---

# 5.3 QR Session Rules

## Dynamic QR Requirement

QR MUST NOT be static.

QR token expiration:
- 30 seconds

After expiration:
- QR automatically refreshes

---

# 5.4 GPS Validation

## Requirement

Attendance only allowed within office/store radius.

## Store Coordinate

Configured in environment variables or settings table.

Example:
- Latitude: -7.139
- Longitude: 110.405

## Allowed Radius
- 50 meters

---

# 5.5 PWA Requirements

Application must support:
- Install to home screen
- Responsive layout
- Mobile camera access
- Offline cache for static assets
- Fast loading

---

# 6. Database Specification

# 6.1 Existing Table Used

## `pengguna`

Existing table reused.

Relevant fields:
- id
- username
- level
- aktif

---

# 6.2 New Table: `absensi`

```sql
CREATE TABLE absensi (
    id BIGSERIAL PRIMARY KEY,

    id_pengguna INTEGER NOT NULL REFERENCES pengguna(id),

    tanggal DATE NOT NULL,

    jam_masuk TIMESTAMP,
    jam_pulang TIMESTAMP,

    status VARCHAR(20) NOT NULL DEFAULT 'HADIR',

    telat_menit INTEGER DEFAULT 0,

    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),

    foto_masuk TEXT,
    foto_pulang TEXT,

    device_info TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(id_pengguna, tanggal)
);
```

---

# 6.3 New Table: `qr_session`

```sql
CREATE TABLE qr_session (
    id BIGSERIAL PRIMARY KEY,

    token TEXT UNIQUE NOT NULL,

    expired_at TIMESTAMP NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    created_by INTEGER REFERENCES pengguna(id),

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 6.4 Recommended Indexes

```sql
CREATE INDEX idx_absensi_pengguna
ON absensi(id_pengguna);

CREATE INDEX idx_absensi_tanggal
ON absensi(tanggal);

CREATE INDEX idx_qr_session_token
ON qr_session(token);

CREATE INDEX idx_qr_session_expired
ON qr_session(expired_at);
```

---

# 7. API Specification

# 7.1 Authentication

Use Supabase Auth session.

Frontend must validate session on every protected route.

---

# 7.2 Attendance APIs

## POST `/api/attendance/checkin`

### Request

```json
{
  "token": "qr_token_here",
  "latitude": -7.123456,
  "longitude": 110.123456,
  "device_info": "Chrome Android"
}
```

---

### Response Success

```json
{
  "success": true,
  "message": "Check-in successful"
}
```

---

### Response Failed

```json
{
  "success": false,
  "message": "QR expired"
}
```

---

# 7.3 POST `/api/attendance/checkout`

### Request

```json
{
  "token": "qr_token_here"
}
```

---

# 7.4 POST `/api/attendance/generate-qr`

Admin only.

### Response

```json
{
  "token": "uuid_here",
  "expired_at": "2026-05-26T13:00:00Z"
}
```

---

# 7.5 GET `/api/attendance/history`

Get attendance history for current user.

---

# 7.6 GET `/api/admin/attendance`

Admin/Owner only.

Supports:
- filtering
- pagination
- date range

---

# 8. Frontend Specification

# 8.1 Pages

## Public

### `/login`

Features:
- Username/password login
- Validation
- Remember session

---

## Employee Pages

### `/dashboard`

Features:
- Attendance status today
- Current time
- Check-in status
- Check-out status
- Quick scan button

---

### `/scan`

Features:
- QR camera scanner
- GPS validation
- Success/error notification

---

### `/history`

Features:
- Attendance history
- Monthly attendance
- Late statistics

---

## Admin Pages

### `/admin/attendance`

Features:
- Attendance table
- Search
- Filter
- Export CSV

---

### `/admin/generate-qr`

Features:
- Live QR generation
- Auto refresh every 30s
- QR expiration timer

---

# 8.2 Responsive Design

Must support:
- Mobile portrait
- Mobile landscape
- Tablet
- Desktop

---

# 8.3 PWA Requirements

## Manifest
Must include:
- app name
- icons
- theme color
- splash screen

---

## Service Worker

Cache:
- static assets
- fonts
- layout shell

Do NOT cache:
- QR tokens
- attendance API responses

---

# 9. Security Specification

# 9.1 QR Security

## Requirements
- Dynamic QR only
- UUID token required
- Token expiration mandatory
- Token single-use recommended

---

# 9.2 Role Validation

Backend MUST validate:
- ADMIN
- KASIR

before attendance insertion.

Never trust frontend role validation.

---

# 9.3 GPS Validation

Backend must validate radius.

Frontend validation alone is insufficient.

---

# 9.4 Duplicate Attendance Prevention

User cannot:
- check-in twice
- checkout before check-in

---

# 9.5 Rate Limiting

Recommended:
- 10 requests/minute per user

---

# 10. Realtime Features

# 10.1 QR Auto Refresh

Use:
- Supabase Realtime
OR
- polling every 30 seconds

---

# 10.2 Live Attendance Dashboard

Admin dashboard updates automatically when:
- employee check-in
- employee check-out

---

# 11. Attendance Logic

# 11.1 Late Calculation

```typescript
const officeStart = "09:00";
const tolerance = 15;
```

If:
- current_time > 09:15

Then:
- status = TELAT

Else:
- status = HADIR

---

# 11.2 Check-Out Logic

User must:
- already checked-in
- not already checked-out

---

# 12. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

STORE_LATITUDE=
STORE_LONGITUDE=

MAX_ATTENDANCE_RADIUS=50

QR_EXPIRE_SECONDS=30
```

---

# 13. Folder Structure (use what is already there and add a new folder if needed, make sure its separated from the existing POS modules)

```text
src/
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── scan/
│   ├── history/
│   ├── admin/
│   │   ├── attendance/
│   │   └── generate-qr/
│
├── components/
│   ├── attendance/
│   ├── qr/
│   ├── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── gps/
│   ├── qr/
│
├── services/
├── hooks/
├── stores/
├── middleware.ts
```

---

# 14. Recommended Libraries

## QR Scanner
```bash
npm install html5-qrcode
```

---

## QR Generator
```bash
npm install qrcode
```

---

## PWA
```bash
npm install next-pwa
```

---

## Form Validation
```bash
npm install zod react-hook-form
```

---

## Table UI
```bash
npm install @tanstack/react-table
```

---

# 15. Analytics Recommendations

Recommended metrics:
- attendance percentage
- late percentage
- monthly attendance
- average check-in time

---

# 16. Future Scalability

Future modules supported:
- leave requests
- overtime
- payroll
- branch attendance
- face recognition
- fingerprint integration

Current schema intentionally designed to support future expansion.

---

# 17. Non-Functional Requirements

# Performance
- Initial load < 3 seconds
- QR scan response < 2 seconds

# Availability
- Mobile-friendly
- Cross-browser support

# Browser Support
- Chrome
- Edge
- Safari
- Firefox

---

# 18. Recommended Development Order

## Phase 1
- Database migration
- Authentication integration

## Phase 2
- QR generation
- QR scanning

## Phase 3
- Attendance APIs
- GPS validation

## Phase 4
- Admin dashboard
- Reports

## Phase 5
- PWA optimization

---

# 19. Acceptance Criteria

System considered complete when:

- User can login
- User can scan QR
- QR expires automatically
- GPS validation works
- Attendance stored successfully
- Duplicate attendance blocked
- Admin can view reports
- App installable as PWA
- Mobile camera works
- Role permissions enforced

---

# 20. Final Notes

This attendance module is intentionally designed:
- simple
- scalable
- production-ready
- mobile-first
- integrated with existing POS architecture

No unnecessary HR complexity included.

Architecture optimized for:
- retail stores
- minimarket
- building material stores
- small-medium business operations

