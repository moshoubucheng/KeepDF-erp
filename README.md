# KeepDF ERP

> Keep Data Flow — Cross-border E-commerce Intelligent Platform

Production: **https://erp.keepdf.com**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Cache | Cloudflare KV |
| Queue | Cloudflare Queues |
| Frontend | Vanilla JS SPA |
| Testing | Vitest + @cloudflare/vitest-pool-workers |
| Language | TypeScript |

## Features

**Orders & Fulfillment**
- Multi-platform order management (TikTok, Temu, Rakuten)
- Shipment creation with stock deduction, tracking timeline, carrier URLs
- Returns & refunds with wallet refund + commission reversal
- Batch operations (status update, product update, stock adjust)

**Inventory & Supply Chain**
- Warehouse location management, inbound/outbound records
- Product management with variants and images
- Procurement with purchase orders (PO lifecycle)
- Inventory forecasting (daily/weekly velocity, reorder points)
- Enhanced SKU mapping with price/stock sync flags

**Finance**
- Wallet system (deposit, freeze, deduct, refund)
- Commission settlement (auto-calculate on delivery)
- Invoice generation (PDF, qualified invoice format)
- Multi-currency support (JPY/USD/CNY) with exchange rate management
- Coupon system (percentage, fixed amount, free shipping)
- Financial reports

**Platform Integration**
- TikTok / Temu / Rakuten sync (manual + cron)
- Platform SKU mapping with validation
- CSV import/export for products and orders

**System**
- RBAC (admin / distributor) with data isolation
- Password login + TOTP 2FA
- Automation rules (auto reorder, price adjust, stock alerts)
- Audit logging, notification center
- Disaster recovery snapshots (R2 encrypted backup)
- i18n: Japanese, English, Chinese
- Mobile responsive (768px / 480px breakpoints)

## Project Structure

```
src/
  index.ts              # Entry: routes, queue consumer, cron
  db/
    schema.sql           # 40 tables
    types.ts             # TypeScript interfaces
    seed.sql             # Development seed data
    migration-*.sql      # Database migrations
  controllers/           # 20 Hono route controllers
  services/              # 20 business logic services
  middleware/            # Auth, rate-limit, security headers
  utils/                 # CSV export helpers
  __tests__/             # 45 test files (526 tests)
public/
  index.html             # SPA shell
  login.html             # Login page
  static/
    app.js               # Frontend application logic
    style.css            # Styles
    i18n.js              # Translations (ja/en/zh)
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Deploy
npm run deploy
```

## API

28 route groups under `/api/v1/`:

| Group | Endpoints | Auth |
|-------|-----------|------|
| `/auth` | login, verify-2fa, change-password | Public |
| `/dashboard` | stats, platform-stats | All |
| `/orders` | CRUD, deliver, cancel | All |
| `/shipping` | CRUD, batch, events, timeline | All |
| `/inventory` | products, warehouse, inbound | All |
| `/wallet` | balance, recharge, transactions | All |
| `/commissions` | rates, settlements | All |
| `/invoices` | generate, list | All |
| `/currency` | rates, convert | All (write: admin) |
| `/sku-mappings` | CRUD, import, export, validate | All (write: admin) |
| `/coupons` | CRUD, validate, available, usage | All (write: admin) |
| `/returns` | CRUD, approve, receive, refund | All |
| `/suppliers` | CRUD | Admin |
| `/purchase-orders` | lifecycle, items | All |
| `/pricing` | rules, history | Admin |
| `/customers` | CRUD, tags | Admin |
| `/communications` | templates, triggers, messages | All |
| `/notifications` | list, read, preferences | All |
| `/reports` | profit, platform, trend, custom | Admin |
| `/financial-reports` | P&L, cashflow, tax | Admin |
| `/forecasting` | calculate, list | Admin |
| `/automation` | rules, logs, evaluate | Admin |
| `/batch` | orders, products, stock | All |
| `/import` | CSV products, orders | All |
| `/distributors` | CRUD, profile | Admin |
| `/platform-sync` | manual sync, logs | Admin |
| `/audit-logs` | list | Admin |
| `/settings` | system settings | Admin |

## Database

40 tables across D1, organized by domain:

- **Core**: distributors, products, product_variants, orders, order_items
- **Warehouse**: warehouse_locations, inbound_records, outbound_records
- **Finance**: wallet_transactions, commissions, commission_settlements, invoices
- **Shipping**: shipments, shipment_events
- **CRM**: customers, customer_messages, message_templates, message_triggers
- **Procurement**: suppliers, purchase_orders, purchase_order_items
- **Pricing**: price_rules, price_history
- **Returns**: returns, return_items
- **Currency**: exchange_rates
- **Coupons**: coupons, coupon_usage
- **Platform**: platform_mappings, platform_sync_logs
- **System**: automation_rules, automation_logs, audit_logs, notifications, notification_preferences, notification_logs, api_logs, backup_snapshots, import_logs, inventory_forecasts

## Testing

```bash
# Run all 526 tests
npm test

# Watch mode
npm run test:watch

# Run specific test file
npx vitest run src/__tests__/currency.test.ts
```

## License

Private project.
