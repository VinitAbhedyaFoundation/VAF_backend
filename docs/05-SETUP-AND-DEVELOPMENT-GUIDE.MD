# Setup and Development Guide

## Prerequisites

- Node.js and npm compatible with the installed dependency versions. The
  manifests do not declare a Node engine or include an `.nvmrc`.
- PostgreSQL accessible to the backend.
- Optional integrations: Stripe, Cloudinary, and an email account usable by
  the configured Nodemailer Gmail transport.

Both applications are independently installable packages; there is no root
`package.json`.

## Configure environment

The backend loads environment variables through Nest `ConfigModule` and
`process.env`. The frontend reads `VITE_API_URL` at build/dev time. Local
`.env` files exist in the workspace; their values are intentionally not
reproduced here. Use your own private values and do not put credentials in
source control or documentation.

| Variable | Used by | Requirement / purpose |
|---|---|---|
| `DATABASE_URL` | Backend Prisma / `DatabaseService` | Required PostgreSQL connection URL |
| `JWT_SECRET_KEY` | Backend JWT module, auth service, strategy | Required; auth service and strategy require at least 32 characters after trimming leading/trailing whitespace |
| `PORT` | Backend bootstrap | Optional HTTP listen port; defaults to `3000` |
| `NODE_ENV` | Backend bootstrap | Swagger is installed when the value is not `production` |
| `VITE_API_URL` | Frontend | Optional API base URL; defaults to `http://localhost:3000/api` |
| `STRIPE_SECRET_KEY` | Payment service | Required to create Stripe Checkout sessions |
| `FRONTEND_URL` | Payment service | Required frontend origin for Stripe success/cancel redirects; must be a valid root HTTP(S) URL, with HTTPS outside localhost |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary service | Cloudinary account configuration for uploads; no startup validation is shown |
| `CLOUDINARY_API_KEY` | Cloudinary service | Cloudinary account configuration for uploads; no startup validation is shown |
| `CLOUDINARY_API_SECRET` | Cloudinary service | Cloudinary account configuration for uploads; no startup validation is shown |
| `EMAIL_USER` | Mail service | Gmail SMTP account used as sender |
| `EMAIL_PASS` | Mail service | Gmail SMTP credential; email sending is disabled when credentials are absent |

Keep secret values out of `VITE_*` variables: frontend environment values are
bundled into browser-delivered code. Do not use production credentials in
local/test environments.

## Install and start the frontend

From the workspace root, in PowerShell:

```powershell
Set-Location .\VAF_frontend
npm install
npm run dev
```

Vite is configured to serve on port `8080` and host `::`. Open
`http://localhost:8080`. This differs from the generic frontend README's
example port; the Vite configuration is the active source for the local
server port.

## Install and start the backend

Use a separate PowerShell terminal:

```powershell
Set-Location .\VAF_backend\ploggers-attendance-system
npm install
npm run start:dev
```

The default API server port is `3000`, with controllers mounted below
`/api`. Set required database and JWT environment variables before startup.
`postinstall` runs Prisma Client generation; the build script also runs
`npx prisma generate` before `nest build`.

Development Swagger is configured at `/swagger` when `NODE_ENV` is not
`production`. It includes bearer-auth support.

## Database setup and migrations

The Prisma datasource is PostgreSQL and reads `DATABASE_URL`. The backend
provides this migration command:

```powershell
npm run migrate:deploy
```

It runs `prisma migrate deploy` against the configured database. **Check the
migration history before using it on an existing or production database.**
The current `schema.prisma` includes models and fields not represented by the
three migration SQL files currently present; the initial migration is an older
snapshot. Do not assume this migration folder alone reconstructs the current
Prisma schema. See the schema/migration notes in
[`06-DATABASE-AND-API-GUIDE.MD`](./06-DATABASE-AND-API-GUIDE.MD).

## Build, lint, typecheck, and tests

### Frontend

Run from `VAF_frontend`:

```powershell
npm run build
npm run typecheck
npm run lint
npm test
```

The manifest also defines `npm run build:dev`, `npm run preview`, and
`npm run test:watch`.

### Backend

Run from `VAF_backend\ploggers-attendance-system`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:cov
```

The backend Jest unit-test glob is `src/**/*.spec.ts`. The e2e command uses
`test/jest-e2e.json`; the current `test/app.e2e-spec.ts` asserts `GET /`
returns `Hello World!`. The e2e file does not use the production bootstrap
function in `src/main.ts`, so its prefix/CORS/validation setup is not applied
by that test fixture.

## Common local workflow

1. Set private backend environment values and point `DATABASE_URL` to a
   development database.
2. Start the backend and frontend in separate terminals.
3. Confirm that the API base URL in `VITE_API_URL` matches the backend origin
   plus `/api`; unset it to use the local fallback.
4. Use test accounts in approved states when exercising authenticated portal
   routes. Newly registered volunteers begin as pending.
5. Run the targeted build/test commands above before submitting changes.

## Related references

- [Tech stack](./03-TECH-STACK.MD)
- [Database and API guide](./06-DATABASE-AND-API-GUIDE.MD)
- [Authentication and security](./07-AUTHENTICATION-AND-SECURITY.MD)
- [Deployment and maintenance](./08-DEPLOYMENT-AND-MAINTENANCE.MD)