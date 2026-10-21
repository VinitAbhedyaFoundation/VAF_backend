# Deployment and Maintenance

## Deployment configuration found in the repository

### Frontend

[`VAF_frontend/vercel.json`](../VAF_frontend/vercel.json) declares:

- Build command: `npm run build`
- Output directory: `dist`
- Static-file handling followed by SPA rewrites for `/`, the registered
  top-level pages, and `/blog/:slug`
- Response headers for content-type sniffing, framing, referrer policy,
  browser permissions, and Content Security Policy

The CSP's current `connect-src` is `'self'` and
`https://vaf-backend.vercel.app`. The frontend's request client instead uses
`VITE_API_URL` or the local fallback `http://localhost:3000/api`. Verify the
deployed API origin is consistent with the CSP and backend CORS allowlist
through the platform configuration; no environment-specific Vite value is
documented in source here.

The SPA rewrite list does not include `/payment-success` or
`/payment-cancel`, even though the backend's Stripe Checkout service uses those
paths as return URLs.

### CI/deployment workflow files

Workflow-like YAML files are present under
[`VAF_frontend/.github-temp/workflows/`](../VAF_frontend/.github-temp/workflows/),
not under the standard `.github/workflows/` directory:

- `sanity.yml` checks out source, sets up Node, runs `npm ci`, lint, and build.
- `deploy.yml` installs the Vercel CLI and invokes preview/production Vercel
  commands using a CI secret reference named `VERCEL_TOKEN`.

Because these files are in `.github-temp/workflows`, their presence alone does
not establish that GitHub Actions discovers or runs them. No secret values are
documented here. The workspace also has an `auto-merge.yml` file in that
directory; its behavior is not part of the application runtime.

### Backend

The backend package has `build`, `vercel-build`, `start:prod`, and
`migrate:deploy` scripts. Its production start command is `node dist/main`.
No active backend `vercel.json`, Dockerfile, Compose file, Kubernetes
manifest, or other backend hosting manifest was found in the backend package.
The `vercel-build` script is a build command, not by itself proof of a Vercel
deployment.

The backend listens on `PORT` or defaults to `3000`, serves API routes below
`/api`, and enables Swagger only when `NODE_ENV !== 'production'`.

## Release procedure supported by source configuration

The repository does not prescribe a complete release/cutover procedure. The
following are the available package commands; coordinate the order and target
environment with the actual hosting/database configuration:

1. Install from the relevant application directory using the lockfile
   (`npm ci` is used by the frontend sanity workflow; local README/package
   setup uses npm).
2. Configure environment values privately. Frontend builds need the correct
   `VITE_API_URL`; backend runtime needs its database/JWT settings and any
   enabled integration credentials.
3. Build the frontend with `npm run build`; Vercel outputs `dist`.
4. Build the backend with `npm run build`; start the generated application
   using `npm run start:prod` in the backend package.
5. Before applying database changes, review the migration warning in
   [`06-DATABASE-AND-API-GUIDE.MD`](./06-DATABASE-AND-API-GUIDE.MD). The
   available `npm run migrate:deploy` applies the Prisma migration files
   currently present, which do not encode the full schema shown in
   `schema.prisma`.
6. Smoke-test public frontend routes, API connectivity, authentication, and
   enabled integrations in the deployed environment.

Do not run migrations against production until the schema/migration history
has been reconciled and the database has a verified backup.

## Runtime behavior relevant to operations

- `DatabaseService` connects at module initialization and retries a failed
  connection up to five attempts, with a three-second wait between failed
  attempts. It disconnects on module destroy.
- `MailService` checks SMTP configuration at startup. Without credentials, it
  logs that email sending is disabled; a verification failure is logged while
  allowing application startup to continue.
- Services use Nest's `Logger` for selected operational events and failures.
- A protected `GET /api/cloudinary/ping` checks the Cloudinary API, but it is
  not an unauthenticated overall application-health endpoint.
- No scheduled backup, database restore, centralized telemetry, alerting,
  uptime-check, or backend health-check configuration was found in the
  inspected project.

## Maintenance responsibilities

| Area | Source-backed behavior / operational consideration |
|---|---|
| Database | PostgreSQL/Prisma; validate migration state before every schema release |
| Credentials | Rotate secrets in the hosting secret store; do not store them in frontend build variables or repository docs |
| Email | Delivery requires `EMAIL_USER` and `EMAIL_PASS`; newsletter persistence is retained even when its confirmation email fails |
| Payments | Stripe Checkout requires `STRIPE_SECRET_KEY` and `FRONTEND_URL`; the current API creates a session but no webhook/reconciliation route is present |
| Certificate files | Generated files/templates use Cloudinary; failed database persistence triggers cleanup attempts |
| API access | Keep frontend origin, CSP API destination, `VITE_API_URL`, and backend CORS allowlist aligned |
| Client/API compatibility | Validate portal login and protected routes after deployments; frontend's Axios client reacts to `401` by clearing local token state |

## Recommended operational safeguards (not currently automated here)

These are operational recommendations, not settings or automation claimed to
exist in the repository:

- Maintain and test database backups before schema releases.
- Keep separate development, staging, and production credentials and data.
- Add platform-level health checks and monitoring for API, database, email,
  Stripe, and Cloudinary dependencies.
- Confirm donation return pages and deployment rewrites before enabling live
  checkout.
- Move workflow files into the deployment platform's recognized workflow
  location only after reviewing their triggers and secret handling.

## Related references

- [Setup and development guide](./05-SETUP-AND-DEVELOPMENT-GUIDE.MD)
- [Database and API guide](./06-DATABASE-AND-API-GUIDE.MD)
- [Authentication and security](./07-AUTHENTICATION-AND-SECURITY.MD)