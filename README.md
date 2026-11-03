# HireFlow

HireFlow is the existing responsive recruitment workspace built with React, Vite, Bootstrap 5, and React Router. An Express 5 API, PostgreSQL schema, session authentication, and workspace-scoped endpoints are included. The frontend stays in browser-only mode by default; server mode must be explicitly configured and must not be treated as production-ready until its required services have been provisioned and tested.

## Run locally

```sh
npm install
npm run dev
```

Check the production bundle, source lint, and product catalog tests with `npm run build`, `npm run lint`, and `npm test`. Run `npm run validate` to execute lint and the production build as one CI-friendly correctness gate.

## Backend setup

Install PostgreSQL and create an empty `hireflow` database. Copy `.env.example` to `.env`, then configure `DATABASE_URL` and a random `SESSION_SECRET` of at least 32 characters. Keep `.env` private; it is git-ignored. Apply the schema with `npm run db:migrate`, then start the API in a separate terminal with `npm run server`. Start Vite with `npm run dev`; its `/api` requests proxy to `http://127.0.0.1:4000`.

For account registration, configure a Resend API key and a verified sender in `RESEND_API_KEY` and `EMAIL_FROM`. Set `APP_BASE_URL` to the frontend origin used in verification links. Registration returns setup-required until email verification delivery is available. Candidate creation also requires an explicit `CANDIDATE_RETENTION_DAYS` policy value; choose that period only after documenting the applicable legal/business retention policy. Production cross-origin deployments also require the exact frontend origin in `FRONTEND_ORIGINS`, HTTPS, `SESSION_SAME_SITE=none`, and `DATABASE_SSL=require` when required by the database host. Set `VITE_REQUIRE_AUTH=true` at frontend build time only after the API and database are ready. The Vite API base defaults to `/api`; set `VITE_API_BASE_URL` to the deployed API origin when frontend and backend use separate hosts.

The SQL migration is in `server/db/migrations/001_initial_schema.sql`. The current schema is applied by the included migration runner; PostgreSQL was not available in the development environment, so no migration or database-backed request has been executed here.

## Supabase status and safe integration path

Supabase is not currently configured in this repository. There is no `@supabase/supabase-js` dependency, no Supabase URL/key environment variable, and no Supabase Auth integration. The current backend is an Express API using `pg`, PostgreSQL-backed sessions, parameterized SQL, and workspace membership authorization.

The safe first Supabase option is to use Supabase as managed PostgreSQL without changing frontend authentication: place the Supabase pooled PostgreSQL connection string in the private server-side `DATABASE_URL`, set `DATABASE_SSL=require`, and run the numbered migrations only after confirming the target project and backup policy. Do not put that connection string, a service-role key, or any database credential in a `VITE_` variable.

Supabase Auth and Row Level Security are a separate migration. Before enabling RLS, the application must map the current account to a Supabase Auth user and set a trusted database request identity for every transaction. Enabling policies against `auth.uid()` before that mapping would deny legitimate API requests or encourage unsafe service-role access. Until that work is complete, the Express authorization layer remains the enforced boundary.

Use `npm.cmd run test:integration` only with an explicitly selected disposable, non-production PostgreSQL/Supabase database in `INTEGRATION_DATABASE_URL`. The database name must include `test`, `integration`, or `ci`; the runner sets `NODE_ENV=test` and refuses to execute against an unnamed database. The suite does not create permanent fixtures: its data is rolled back in a transaction. It is skipped by default and does not claim RLS coverage until Supabase Auth identity mapping exists.

## Phase 0 correctness and observability

- The browser API client validates safe and unsafe request behavior, CSRF refresh/retry behavior, JSON serialization, and structured API errors in `src/api/client.test.js`.
- `npm run validate` combines ESLint and the Vite production build. This catches JavaScript defects such as undefined API-client identifiers before deployment.
- The frontend exposes `globalThis.__HIREFLOW_MONITORING__` as an optional monitoring adapter. Provide a `captureException(error, context)` function before the app loads to connect an approved monitoring provider; sensitive context keys are filtered by the integration point.
- Backend responses include a generated `X-Request-ID`. Structured server logs include request IDs and redact keys associated with credentials, tokens, cookies, authorization, API keys, and email addresses.
- No database credentials, session secrets, or mail-provider keys are sent to the frontend or written to structured log context.

## Deploy the frontend

The static production output is written to `dist/`. Deploy that directory to a static host such as Netlify or Vercel. SPA rewrite configuration is included for both hosts so routes such as `/jobs` load when opened directly.

Vite remains the frontend build tool because it provides fast development feedback and a production build that can be deployed as static assets without coupling the website to the API server. The app uses route-level dynamic imports, so authentication, dashboard, pricing, and workspace screens are downloaded only when needed. Vite 8/Rolldown also keeps React dependencies in a separate vendor chunk; this prevents the initial application chunk from growing as new screens are added. Replacing Vite with another bundler would not improve the API or database scaling boundary and would add migration risk without a measurable benefit.

The workspace includes light and dark themes. The selected theme is saved in browser storage and can be changed from the top-bar theme button or Settings → Appearance. Decorative background motion is disabled automatically when the user requests reduced motion.

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
- Workspace authorization is enforced on the server. Owners and admins can update workspace profile details and select a pricing plan; recruiters can use operational recruiting workflows but cannot change workspace-level settings.
- Password recovery uses one-time, hashed, one-hour tokens stored server-side. Completing a reset invalidates existing PostgreSQL-backed sessions; email delivery must be configured before recovery requests are processed.
- Candidate deletion is an explicit, server-authorized `DELETE /api/workspace/candidates/:id` operation requiring an owner/admin role and `{ "confirm": true }`; the deletion is workspace-scoped, transactional, cascades related records, and records a non-PII activity event.
- Retention cleanup is available through `npm.cmd run db:cleanup-candidates`, which performs a dry run by default. Applying deletion requires both `--apply` and `ALLOW_DESTRUCTIVE_RETENTION_CLEANUP=true`; each expired record receives an audit event before deletion.
- Candidate organization uses workspace-scoped folders, pipeline statuses (`New`, `Screening`, `Interview`, `Offer`, `Hired`, `Rejected`), and internal notes. All organization endpoints validate identifiers and workspace ownership on the server.
- Outreach foundation stores workspace-scoped templates, recipient consent snapshots, unsubscribe records, and provider delivery events. Campaign sending is not enabled until queueing, provider verification, unsubscribe handling, and idempotency are implemented and tested.
- Campaign queueing is an explicit owner/admin-only transition from `Draft` to `Queued`. It uses workspace/campaign rate limits, transaction locking, idempotency keys, consent and unsubscribe suppression, and creates recipient snapshots without sending email.
- Authorized campaign reviewers can preview eligible recipients without seeing email addresses, select specific candidate IDs, and queue only that selection. The server re-validates every selected candidate inside the queue transaction; the quick queue action intentionally uses all currently eligible recipients.
- Candidate unsubscribe links are served through the public `/api/outreach/unsubscribe/:token` endpoint. Valid links revoke current outreach consent, suppress queued/sending recipients, record an append-only unsubscribe event, and create an audit activity entry.
- Migration `007_outreach_governance.sql` adds immutable consent and unsubscribe histories that survive candidate deletion, plus a `sending` recipient state. A future worker can use `claimQueuedRecipients` to re-check consent, retention, and unsubscribe suppression under row locks before any provider delivery is attempted.
- Only public settings may use the `VITE_` prefix. Database, session, and mail secrets belong in private server environment variables.
- Supabase configuration, when adopted, must remain server-side during the first integration phase. The expected private variables are the existing `DATABASE_URL` and `DATABASE_SSL`; `SUPABASE_URL`, anon keys, service-role keys, and database credentials must never be committed or exposed through Vite.
- Update plans/features in `shared/productCatalog.js` if the supplied launch catalog changes.

The contact details currently shown in the app are for founder Krishna Chaurasiya: business email `chaurafix25@gmail.com`, personal email `chaurasiyakrishn05@gmail.com`, and phone `+91 75593 15089`.
