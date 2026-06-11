# Coins Backend

Node.js, Express, and MongoDB backend for Coins Store.
It powers authentication, wallets, deposits, product catalog management, order
fulfillment, provider integrations, target coin requests, notifications, and
admin operations.

The backend is organized as modular domain services under `src/modules`, with
shared middleware, error handling, and utilities under `src/shared`.

## Main Features

- JWT authentication with email verification, Google OAuth support, account
  approval states, and optional email OTP two-factor authentication.
- Customer wallets with multi-currency balances, credit limits, atomic debits,
  refunds, admin adjustments, and full wallet transaction history.
- Digital product catalog with categories, group-based pricing, manual or synced
  product pricing, dynamic order fields, and provider field mapping.
- Order lifecycle management for manual and automatic fulfillment, including
  provider dispatch, polling, retries, refunds, and manual review fallbacks.
- External provider adapter layer for provider catalog sync, order placement,
  order status checks, and balance checks.
- Deposit requests with uploaded proof images and optional receipt analysis.
- Target app and target coin order workflow for customer-submitted purchase
  requests reviewed by admins.
- Admin APIs for users, products, orders, wallets, providers, currencies,
  groups, settings, deposits, targets, notifications, audit logs, and dashboard
  statistics.
- Immutable audit logs for security-sensitive and financial actions.
- Background jobs for provider catalog sync and order status polling.
- WhatsApp admin notification integration via `whatsapp-web.js`.

## Tech Stack

- Runtime: Node.js 18+
- API framework: Express 4
- Database: MongoDB with Mongoose
- Authentication: JWT, bcrypt, Passport Google OAuth
- Validation: express-validator and Joi
- Uploads: Multer, local `/uploads` static serving
- Background work: node-cron
- Email: Nodemailer
- Image/OCR tooling: sharp and Tesseract.js
- Tests: Jest and mongodb-memory-server
- Process manager: PM2 config included in `ecosystem.config.js`

## Project Structure

```text
Backend/
  src/
    app.js                    Express app, middleware, routes
    server.js                 DB connection, jobs, HTTP startup
    config/                   Database, app config, Google strategy
    modules/
      admin/                  Admin dashboard and management APIs
      audit/                  Audit log model and APIs
      auth/                   Auth, verification, OAuth, 2FA
      categories/             Product categories
      currency/               Currency rates and conversion
      deposits/               Deposit request workflow
      groups/                 Pricing groups
      me/                     Customer self-service APIs
      notifications/          In-app notifications
      orders/                 Orders, pricing, fulfillment, polling
      products/               Customer-facing products
      providers/              Provider records, adapters, sync
      reseller/               Reseller/client-compatible APIs
      targets/                Target apps and target orders
      users/                  User management
      wallet/                 Wallet and credit operations
      whatsapp/               WhatsApp admin notifications
    shared/
      errors/                 AppError and global error handler
      middlewares/            Auth, authorization, upload, rate limits
      routes/                 Shared upload routes
      services/               Receipt analyzer
      utils/                  API responses, decimal/currency helpers
    services/                 Email and exchange-rate services
    tests/                    Jest test suites and helpers
  docs/                       Detailed architecture and feature docs
  uploads/                    Local uploaded files
  package.json
  ecosystem.config.js
  jest.config.js
```

## Prerequisites

- Node.js 18 or newer
- MongoDB
- npm

For production-like wallet/order transaction behavior, use a MongoDB replica set.
Tests use `mongodb-memory-server`.

## Setup

From the repository root, enter the backend project:

```bash
cd Backend
```

Install dependencies:

```bash
npm install
```

Create your local environment file from the sample, then edit it with real
values:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Minimum required values:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/coins

JWT_SECRET=change_me_to_a_long_random_secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

Common optional values:

```env
# Frontend, email links, and CORS
FRONTEND_URL=http://localhost:3000
FRONTEND_VERIFY_REDIRECT_URL=http://localhost:3000/email-verified
APP_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:3000

# SMTP / email verification / 2FA email
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@platform.com

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Exchange-rate sync
EXCHANGE_RATE_API_URL=https://api.exchangerate.host/latest?base=USD
EXCHANGE_RATE_API_KEY=
EXCHANGE_RATE_TIMEOUT_MS=10000

# Order/provider runtime tuning
ORDER_CREATION_TRANSACTIONS=
POLL_BATCH_LIMIT=100
POLL_MAX_BATCH_SIZE=50
POLL_MAX_CONCURRENT=3
POLL_INTER_BATCH_DELAY_MS=0
SYNC_UPSERT_CONCURRENCY=10
PROVIDER_PRICE_CACHE_TTL_MS=300000

# Legacy Royal Crown shim fallback only; provider records normally carry credentials
PROVIDER_BASE_URL=
PROVIDER_API_TOKEN=

# Deposit receipt analyzer
RECEIPT_ANALYZER_ENABLE_OCR=false
RECEIPT_ANALYZER_MIN_ENTROPY=1.0
RECEIPT_ANALYZER_BLACK_MEAN_MAX=8
RECEIPT_ANALYZER_WHITE_MEAN_MIN=247
RECEIPT_ANALYZER_SOLID_STDDEV_MAX=2.5
RECEIPT_ANALYZER_LOW_ENTROPY_STDDEV_MAX=3.2
RECEIPT_ANALYZER_MAX_INPUT_PIXELS=40000000
RECEIPT_ANALYZER_OCR_TIMEOUT_MS=3500
RECEIPT_ANALYZER_OCR_RESIZE_WIDTH=1200
RECEIPT_ANALYZER_OCR_MIN_KEYWORD_MATCHES=1
RECEIPT_ANALYZER_OCR_KEYWORDS=vodafone,cash,transfer,success

# WhatsApp admin notifications
ADMIN_NOTIFICATION_NUMBER=
WHATSAPP_CLIENT_ID=admin-notifications
WHATSAPP_AUTH_DATA_PATH=
WHATSAPP_CACHE_DATA_PATH=
WHATSAPP_RECONNECT_DELAY_MS=5000
```

Required variables are `MONGO_URI` and `JWT_SECRET`. Most integrations are
optional, but production must set `ALLOWED_ORIGINS` to a comma-separated list of
trusted frontend origins.

Set `ADMIN_NOTIFICATION_NUMBER` to the admin WhatsApp number in international
digits only, without `+` or spaces, for example `201234567890`. WhatsApp auth
and cache directories should be on persistent storage if notifications are used.

Provider credentials are normally stored in provider records through the admin
APIs (`baseUrl`, `apiToken`/`apiKey`). The `PROVIDER_BASE_URL` and
`PROVIDER_API_TOKEN` variables exist only for the legacy Royal Crown shim.

## Running Locally

Start the development server:

```bash
npm run dev
```

Start without nodemon:

```bash
npm start
```

Seed data:

```bash
npm run seed
```

Clear and reseed data:

```bash
npm run seed:clear
```

The API listens on `PORT` from `.env`. If `PORT` is omitted, it falls back to
`5000`.

Health check:

```text
GET /health
```

Expected response:

```json
{
  "success": true,
  "status": "healthy",
  "environment": "development",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with nodemon |
| `npm start` | Start the API with Node |
| `npm test` | Run Jest tests serially |
| `npm run seed` | Seed initial data |
| `npm run seed:clear` | Clear seed-managed data and reseed |

## API Surface

Base prefix: `/api`

| Route | Purpose |
| --- | --- |
| `/api/auth` | Register, login, verification, Google OAuth, 2FA |
| `/api/me` | Customer profile, dashboard, wallet/orders/deposits views |
| `/api/me/targets` | Customer target coin requests |
| `/api/me/notifications` | Customer notifications |
| `/api/products` | Product APIs |
| `/api/orders` | Order APIs |
| `/api/wallet` | Wallet APIs |
| `/api/deposits` | Deposit APIs |
| `/api/providers` | Provider APIs |
| `/api/v1/reseller` | Reseller-compatible APIs |
| `/api/client` | Alias for reseller-compatible APIs |
| `/api/users` | User APIs |
| `/api/groups` | Pricing group APIs |
| `/api/audit` | Audit log APIs |
| `/api/categories` | Public active categories |
| `/api/currencies/active` | Public active currencies |
| `/api/settings/payment` | Public payment settings |
| `/api/public/catalog` | Public catalog without pricing data |
| `/api/admin` | Admin dashboard and management APIs |
| `/api/admin/currencies` | Admin currency management |
| `/api/admin/whatsapp` | Admin WhatsApp integration |
| `/api/upload` | Shared upload endpoints |

See `docs/api-reference.md` for more endpoint detail.

Uploaded files are served from `/uploads`.

## Core Runtime Flow

1. `src/server.js` loads environment variables and connects to MongoDB.
2. `src/app.js` configures security middleware, CORS, request parsing, rate
   limits, static uploads, public routes, protected routes, and admin routes.
3. Default settings are seeded idempotently on app startup.
4. Background jobs start after the HTTP server starts:
   - order fulfillment polling
   - provider product catalog sync
5. WhatsApp admin notification client initialization is attempted in the
   background.
6. Shutdown handlers stop jobs, destroy the WhatsApp client, close HTTP, and
   close MongoDB.

## Background Jobs

| Job | Schedule | Purpose |
| --- | --- | --- |
| Fulfillment polling | Every minute | Poll processing orders and move them toward terminal states |
| Provider sync | Every 6 hours | Sync active provider catalogs into provider products |

Both jobs skip automatically in the test environment.

Useful tuning variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORDER_CREATION_TRANSACTIONS` | auto | Force order creation MongoDB transactions on/off with `true` or `false`; auto enables them when topology supports sessions |
| `POLL_BATCH_LIMIT` | `100` | Max processing orders loaded per polling run |
| `POLL_MAX_BATCH_SIZE` | `50` | Max orders sent to one provider batch status call |
| `POLL_MAX_CONCURRENT` | `3` | Max providers polled concurrently |
| `POLL_INTER_BATCH_DELAY_MS` | `0` | Delay between provider sub-batches |
| `SYNC_UPSERT_CONCURRENCY` | `10` | Concurrent provider-product upserts during sync |
| `PROVIDER_PRICE_CACHE_TTL_MS` | `300000` | Live provider price cache TTL |

## Dynamic Order Fields

Products can define active order fields such as text, number, URL, select, email,
telephone, date, and textarea fields. Submitted order values are validated
against the product field schema, then stored as an immutable order snapshot.

`providerMapping` translates internal field keys to provider-specific parameter
names before automatic fulfillment. This keeps provider-specific API details out
of customer-facing form definitions.

Detailed docs:

- `docs/dynamic-order-fields.md`
- `docs/order-system.md`
- `docs/provider-integration.md`

## Wallet and Financial Safety

Wallet operations use atomic MongoDB updates for debits, credits, refunds, admin
adjustments, and credit-limit usage. Orders snapshot pricing at creation time, so
later product, currency, or group changes do not mutate historical orders.

Detailed docs:

- `docs/wallet-system.md`
- `docs/database-schema.md`
- `docs/order-system.md`

## Testing

Run all backend tests:

```bash
npm test
```

Tests use Jest with `mongodb-memory-server`. The global setup injects test
values for `MONGO_URI`, `MONGO_TEST_URI`, `JWT_SECRET`, and related runtime
variables.

Detailed docs:

- `docs/testing.md`

## Deployment

The repo includes a PM2 config:

```bash
pm2 start ecosystem.config.js --env production
pm2 logs
pm2 restart all
pm2 stop all
```

Production checklist:

- Set `NODE_ENV=production`.
- Use a long random `JWT_SECRET`.
- Set `MONGO_URI` to a reliable MongoDB deployment.
- Set `ALLOWED_ORIGINS` to trusted frontend origins.
- Configure SMTP if email verification or 2FA emails are required.
- Configure provider credentials through provider records/admin APIs.
- Ensure the process has persistent storage for `uploads/` and WhatsApp auth
  data if those features are used.
- Set `ADMIN_NOTIFICATION_NUMBER` if WhatsApp admin notifications should be
  delivered.
- If PM2 cluster mode is used, make sure cron jobs and WhatsApp notification
  startup run in only one worker or are moved to a separate worker process.
- Run behind HTTPS and a trusted reverse proxy.

## Error Format

Errors follow a consistent JSON shape:

```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "statusCode": 422
}
```

Common codes include:

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Missing or invalid authentication |
| `AUTHORIZATION_ERROR` | Missing role or permission |
| `NOT_FOUND` | Resource was not found |
| `CONFLICT` | Duplicate or conflicting resource |
| `INSUFFICIENT_FUNDS` | Wallet and credit cannot cover the operation |
| `INVALID_ORDER_FIELDS` | Dynamic order field validation failed |
| `BUSINESS_RULE_VIOLATION` | Domain rule prevented the action |
| `ACCOUNT_INACTIVE` | User account is not active |

## Detailed Docs

- `docs/architecture.md`
- `docs/api-reference.md`
- `docs/database-schema.md`
- `docs/admin-panel.md`
- `docs/user-panel.md`
- `docs/order-system.md`
- `docs/wallet-system.md`
- `docs/provider-integration.md`
- `docs/dynamic-order-fields.md`
- `docs/testing.md`
