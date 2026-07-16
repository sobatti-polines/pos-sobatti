# POS Sobatti - Agent Instructions

Welcome to the POS Sobatti project. This document provides essential rules, context, and guidelines for AI agents working on this codebase. Read this carefully before making any changes.

## ⚠️ CRITICAL RULES

1. **Next.js Version**: This project uses Next.js 16 (App Router). This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
2. **DO NOT USE BROWSER FOR TESTING**: Use automated testing or rely on the user for visual/manual testing unless explicitly instructed otherwise.
3. **Language**: All UI copy, error messages, and form labels MUST be in **Bahasa Indonesia**.

## 🏗️ Architecture & Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui + Radix UI
- **Database & Backend**: Supabase (PostgreSQL), Supabase Auth, Row Level Security (RLS)
- **State Management**: Zustand (for POS state - `stores/pos-store.ts`)
- **Forms & Validation**: React Hook Form + Zod
- **Specialized Libs**: `@zxing/browser` (Barcode/QR scanner), `jspdf` (Invoice/Reports)

## 💼 Business Logic & Domain Rules

- **Domain**: This is a Point of Sale (POS) system for a retail store, replacing an older Excel VBA system.
- **Transaction Numbering**: Must be strictly sequential, starting from `#10000001`. See DB migrations for atomic race-condition handling.
- **Pricing Tiers**: The system supports 3 tiers: `Satuan` (Unit), `Grosir` (Wholesale), and `Promo`.
- **Discounts**: Supports both per-item discounts and global transaction discounts.
- **Currency & Numbers**: 
  - Store monetary values as `numeric`/`bigint` in the database.
  - Always format for display using the `formatIDR()` helper.
  - Use the `terbilangRupiah()` function (`lib/terbilang.ts`) to generate Indonesian text representations of totals for printed invoices.

## 🎨 Design & UI (Stripi-inspired)

- **Vibe**: Professional, trustworthy, financial-grade confidence. Not generic SaaS, not cold enterprise.
- **Typography**: Thin editorial typography. Use `font-weight: 300` and negative tracking for display text. Use `font-feature-settings: "tnum"` for any cell containing money or numerics.
- **Colors**: Deep navy ink for dark elements/text, electric indigo (`#533afd`) as the primary CTA color.
- **Components**: Use existing primitives in `components/ui/` (shadcn). Do not introduce new component libraries.
- **Buttons**: Pill-shaped (fully rounded) buttons are the standard.

## 📁 File Structure Conventions

- `app/`: Next.js App Router pages and API routes (e.g., `pos/`, `dashboard/`, `api/`).
- `components/ui/`: shadcn primitive components. Do not modify unless necessary.
- `components/`: Composite components (e.g., forms, layout elements).
- `lib/supabase/`: Supabase clients for server and browser.
- `stores/`: Zustand global state (e.g., `pos-store.ts`).
- `supabase/migrations/`: PostgreSQL schema and migrations. Always check these for data structure details.