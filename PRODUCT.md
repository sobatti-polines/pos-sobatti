# Product: POS Sobatti

## 1. Product Purpose & Vision

POS Sobatti is a modern Point of Sale (POS) system designed for retail stores, serving as a replacement for a classic Excel VBA-based application. It handles daily transactions, inventory management, customer and supplier tracking, employee attendance, and integrated accounting reporting.

The login page is the gate — it needs to feel professional and trustworthy (financial-grade confidence) without feeling cold or enterprise-cold. Users come to this page to authenticate and get to work. Success is a login that disappears into the task. Both cashiers and managers use this POS system. Cashiers log in quickly at the start or during a shift — speed matters. Managers log in for permissions-sensitive tasks and oversight. 

## 2. Core Features & Modules

### 2.1 Cashier Interface (POS)
- **Fast Input & Scanning:** Supports barcode scanning via device camera (ZXing) and manual product search.
- **Multiple Pricing Tiers:** Automatically applies pricing based on 3 tiers: `Satuan` (Unit), `Grosir` (Wholesale), and `Promo`, with support for manual price overrides.
- **Dynamic Discounts:** Supports per-item discounts (nominal/percentage) and global transaction discounts.
- **Flexible Payments:** Supports multiple payment methods including Cash (Tunai), Down Payment (DP), QRIS, Debit, and e-wallets. Calculates change and remaining debt for DP.
- **Invoice Generation:** Three printable formats (Struk 58mm Thermal, standard Invoice, and Faktur Penjualan), complete with the `Terbilang` function that converts numeric totals into Indonesian words (e.g., "Seratus Ribu Rupiah").
- **Transaction Correction:** Ability for authorized users to void or delete erroneous transactions.

### 2.2 Inventory Management
- **Product Master Data:** Manage products with categories, units (Satuan), and multiple price points.
- **Stock Tracking:** Real-time stock calculation based on incoming goods (Barang Masuk) and outgoing sales (Barang Keluar).
- **Purchasing (Barang Masuk):** Record incoming stock from suppliers, calculate total purchase values, and automatically update inventory.
- **Stock Opname (Physical Count):** Input forms for physical inventory checks to record discrepancies (selisih) between system stock and physical stock.
- **Low Stock Alerts:** Dashboard widgets notifying managers of products running low on stock.

### 2.3 Master Data Management
- **Customer Database:** Track registered customers for loyalty and accounts receivable. Includes a default `UMUM` customer for anonymous walk-ins.
- **Supplier Database:** Manage supplier contacts and details used during the purchasing process.
- **User Management:** Manage application access levels (Administrator vs. Kasir).
- **Settings & Configuration:** Centralized store information, tax rates, discount methods (nominal vs. percent), bank info, and custom invoice footers.

### 2.4 Manager Dashboard & Analytics
- **Daily Summary:** Overview of today's revenue vs. yesterday, transaction counts, and average ticket size.
- **Sales Charts:** Visual representations of 14-day sales trends.
- **Top Products:** Tracking of best-selling items.
- **Transaction History:** Comprehensive view of all past transactions with filtering and search capabilities.

### 2.5 QR Code Attendance System
- **Dynamic QR Check-in/Check-out:** Admin/Owners generate expiring QR codes (30-second validity) for employees to scan.
- **Geofencing / GPS Validation:** Attendance is only recorded if the employee is within a predefined radius (e.g., 50 meters) of the store coordinates.
- **Late Calculation:** Automatically marks status as `HADIR` (On-time), `TELAT` (Late), or `ALPHA` (Absent) based on working hours.
- **Attendance Reports:** History and analytics for owners to monitor staff punctuality and presence.

### 2.6 Financial & Accounting Module
- **Average Cost (AVCO) Valuation:** Automatically recalculates the cost of goods (HPP) whenever new stock is purchased at different prices.
- **Accounts Payable (Hutang Dagang):** Tracks unpaid purchases from suppliers, manages due dates, and records debt payments.
- **Accounts Receivable (Piutang Dagang):** Tracks unpaid sales from customers (using DP/Kredit methods) and manages collections.
- **Daily Cashier Reports:** End-of-shift reconciliation showing expected cash vs. actual cash in the drawer, summarizing sales, discounts, and HPP.
- **Profit & Loss (Laba Rugi):** Automated generation of P&L statements showing Gross Profit and Net Profit based on transaction data.
- **Balance Sheet (Neraca):** Snapshot of Assets, Liabilities, and Equity (implemented partially with manual inputs for fixed assets).

### 2.7 PWA & Technical Capabilities
- **Progressive Web App:** Installable on desktop and mobile devices for a native-like experience.
- **Offline & Cache Support:** Service workers cache static assets for fast loading.
- **Local HTTPS:** Enables secure camera access for barcode and QR scanning even on local networks.

## 3. Brand Personality

Professional, trustworthy, confident. Stripi-inspired financial infrastructure feel — deep navy ink, electric indigo primary, thin editorial typography. Not generic SaaS cream/teal, not enterprise-cold banking portals. A POS that feels as reliable as a bank terminal but as modern as a well-designed app.

## 4. Anti-references

- No overly decorative login screens — avoid glassmorphism, gradient text, side-stripe borders, hero-metric templates.
- Not generic SaaS (no cream + teal, no floating mockups).
- Not enterprise-cold banking portals.
- No dark patterns or confusing affordances.
- Avoid the "AI-made" cliché: no identical card grids, no flat surfaces with a single accent color out of nowhere.

## 5. Design Principles

1. **The tool disappears.** The interface is a means to an end. No gratuitous motion, no decorative flourishes that slow the user down.
2. **Professional confidence.** Deep navy ink, restrained indigo accents, thin typography at display sizes. Financial-grade without being cold.
3. **One strong CTA per surface.** One filled indigo pill per band. The brand's signature — sparing and decisive.
4. **Consistency is an affordance.** Follow the Stripi-inspired component vocabulary everywhere. Same button shape, same form control look, same icon style.
5. **States are first-class.** Every interactive element has default, hover, focus, active, disabled, loading, error. No shipped surfaces with half a state model.

## 6. Accessibility & Inclusion

- WCAG AA compliance.
- Form fields with clear labels, focus-visible rings, proper aria attributes.
- Touch targets ≥ 40×40px.
- Reduced motion support.
