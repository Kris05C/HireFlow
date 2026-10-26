# HireFlow

HireFlow is the existing responsive recruitment workspace built with React, Vite, Bootstrap 5, and React Router. An Express 5 API, PostgreSQL schema, session authentication, and workspace-scoped endpoints are included. The frontend stays in browser-only mode by default; server mode must be explicitly configured and must not be treated as production-ready until its required services have been provisioned and tested.

## Run locally

```sh
npm install
npm run dev
```

Check the production bundle, source lint, and product catalog tests with `npm run build`, `npm run lint`, and `npm test`.

## Backend setup

Install PostgreSQL and create an empty `hireflow` database. Copy `.env.example` to `.env`, then configure `DATABASE_URL` and a random `SESSION_SECRET` of at least 32 characters. Keep `.env` private; it is git-ignored. Apply the schema with `npm run db:migrate`, then start the API in a separate terminal with `npm run server`. Start Vite with `npm run dev`; its `/api` requests proxy to `http://127.0.0.1:4000`.

For account registration, configure a Resend API key and a verified sender in `RESEND_API_KEY` and `EMAIL_FROM`. Set `APP_BASE_URL` to the frontend origin used in verification links. Registration returns setup-required until email verification delivery is available. Candidate creation also requires an explicit `CANDIDATE_RETENTION_DAYS` policy value; choose that period only after documenting the applicable legal/business retention policy. Production cross-origin deployments also require the exact frontend origin in `FRONTEND_ORIGINS`, HTTPS, `SESSION_SAME_SITE=none`, and `DATABASE_SSL=require` when required by the database host. Set `VITE_REQUIRE_AUTH=true` at frontend build time only after the API and database are ready. The Vite API base defaults to `/api`; set `VITE_API_BASE_URL` to the deployed API origin when frontend and backend use separate hosts.

The SQL migration is in `server/db/migrations/001_initial_schema.sql`. The current schema is applied by the included migration runner; PostgreSQL was not available in the development environment, so no migration or database-backed request has been executed here.

## Deploy the frontend

The static production output is written to `dist/`. Deploy that directory to a static host such as Netlify or Vercel. SPA rewrite configuration is included for both hosts so routes such as `/jobs` load when opened directly.

## Implemented functionality

- Create, filter, sort, edit, and update job statuses; edit campaign drafts; schedule and complete follow-ups. Candidate-linked browser-mode reminders are session-only because candidate PII is intentionally not persisted in localStorage.
- See actual workspace counts and recorded activity when authenticated API mode is connected.
- Add recruiter-entered candidate records only after required discovery-consent attestation; email storage/contact is separately opt-in. Browser-only candidate records stay in memory for the session; server records require a configured retention period and are workspace-scoped. No profiles are fabricated or bundled.
- Select products from the shared catalog in browser mode or persist the selection to a workspace in API mode. Selection never activates a subscription or charges the user.
- Register, sign in, verify email, resend verification, and sign out through server sessions when database and email are configured.
- Update account/workspace profile data locally or through the authenticated server API.
- Start in browser-only mode with a visible persistence label when server authentication is not enabled.

## Production integrations still required

API/database/authentication code is prepared, but no PostgreSQL instance or Resend credentials are configured here. Email verification has not been integration-tested. Candidate consent is currently a recruiter attestation, not candidate-verified evidence; candidate self-registration/verification, CSV import, consent-evidence workflows, retention/deletion jobs, full candidate lifecycle, audit review UI, workspace switching, subscription entitlements, billing history, and production monitoring are not yet implemented. Do not use candidate data in production until privacy/consent, retention/deletion, access control, and operational controls have been reviewed.

PhonePe checkout is deliberately disabled: the API returns `PAYMENTS_NOT_CONFIGURED` with HTTP 503 and never simulates a payment. No merchant account, bank destination, or gateway credentials are configured. Before live checkout, complete PhonePe merchant onboarding, select the correct official integration for the account, implement server-side order creation/status verification/callback signature checks/idempotency, and test pending/success/failure/cancelled paths in the merchant sandbox. Keep all credentials server-side. The prices in `shared/productCatalog.js` are authoritative for the frontend and server; plan selection is not an active subscription or payment. Define refund, tax, and recurring billing terms before launch.

## Project configuration points

- Product identifiers and paise amounts are maintained in `shared/productCatalog.js` and server selection validates against that catalog.
- API endpoints live in `server/routes`; SQL uses parameterized queries and workspace scoping.
- Only public settings may use the `VITE_` prefix. Database, session, and mail secrets belong in private server environment variables.
- Update plans/features in `shared/productCatalog.js` if the supplied launch catalog changes.

The contact details currently shown in the app are for founder Krishna Chaurasiya: business email `chaurafix25@gmail.com`, personal email `chaurasiyakrishn05@gmail.com`, and phone `+91 75593 15089`.
