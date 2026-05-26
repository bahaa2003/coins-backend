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

Install dependencies:

```bash
npm install
```

Create `Backend/.env`:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/coins

JWT_SECRET=change_me_to_a_long_random_secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

FRONTEND_URL=http://localhost:3000
FRONTEND_VERIFY_REDIRECT_URL=http://localhost:3000/email-verified
APP_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:3000

SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@platform.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

EXCHANGE_RATE_API_URL=https://api.exchangerate.host/latest?base=USD
EXCHANGE_RATE_API_KEY=
EXCHANGE_RATE_TIMEOUT_MS=10000

RECEIPT_ANALYZER_ENABLE_OCR=false
RECEIPT_ANALYZER_MIN_ENTROPY=1.0
RECEIPT_ANALYZER_OCR_TIMEOUT_MS=3500
RECEIPT_ANALYZER_OCR_KEYWORDS=vodafone,cash,transfer,success

ADMIN_NOTIFICATION_NUMBER=
WHATSAPP_CLIENT_ID=admin-notifications
WHATSAPP_AUTH_DATA_PATH=
WHATSAPP_RECONNECT_DELAY_MS=5000
```

Required variables are `MONGO_URI` and `JWT_SECRET`. Most integrations are
optional, but production must set `ALLOWED_ORIGINS` to a comma-separated list of
trusted frontend origins.

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

The API runs on `http://localhost:5000` by default.

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
