# Tech Stack

## Runtime and languages

| Concern | Frontend | Backend |
|---|---|---|
| Language | TypeScript and JavaScript | TypeScript |
| Framework | React 18 | NestJS 10 |
| Build/dev server | Vite 7 with SWC React plugin | Nest CLI 10 / TypeScript compiler |
| API/data access | Axios, native `fetch`, TanStack Query | NestJS REST, Prisma Client 5 |
| Database | — | PostgreSQL |
| Test tooling | Vitest 3, Testing Library, jsdom | Jest 29, ts-jest, Supertest |
| Runtime version constraint | No `engines` entry or `.nvmrc` found | No `engines` entry or `.nvmrc` found |

The versions below are the ranges declared in the respective `package.json`
files, not a claim about the exact installed or deployed versions. Lockfiles
exist for both applications.

## Frontend dependencies

Manifest: [`VAF_frontend/package.json`](../VAF_frontend/package.json).

### Runtime dependencies

| Group | Declared packages |
|---|---|
| Core and routing | `react@^18.3.1`, `react-dom@^18.3.1`, `react-router-dom@^6.30.3`, `@tanstack/react-query@^5.83.0` |
| UI primitives | `@radix-ui/react-accordion@^1.2.11`, `@radix-ui/react-alert-dialog@^1.1.14`, `@radix-ui/react-aspect-ratio@^1.1.7`, `@radix-ui/react-avatar@^1.1.10`, `@radix-ui/react-checkbox@^1.3.2`, `@radix-ui/react-collapsible@^1.1.11`, `@radix-ui/react-context-menu@^2.2.15`, `@radix-ui/react-dialog@^1.1.14`, `@radix-ui/react-dropdown-menu@^2.1.15`, `@radix-ui/react-hover-card@^1.1.14`, `@radix-ui/react-label@^2.1.7`, `@radix-ui/react-menubar@^1.1.15`, `@radix-ui/react-navigation-menu@^1.2.13`, `@radix-ui/react-popover@^1.1.14`, `@radix-ui/react-progress@^1.1.7`, `@radix-ui/react-radio-group@^1.3.7`, `@radix-ui/react-scroll-area@^1.2.9`, `@radix-ui/react-select@^2.2.5`, `@radix-ui/react-separator@^1.1.7`, `@radix-ui/react-slider@^1.3.5`, `@radix-ui/react-slot@^1.2.3`, `@radix-ui/react-switch@^1.2.5`, `@radix-ui/react-tabs@^1.1.12`, `@radix-ui/react-toast@^1.2.14`, `@radix-ui/react-toggle@^1.1.9`, `@radix-ui/react-toggle-group@^1.1.10`, `@radix-ui/react-tooltip@^1.2.7`, `cmdk@^1.1.1`, `input-otp@^1.4.2`, `react-resizable-panels@^2.1.9`, `vaul@^0.9.9` |
| Forms and validation | `@hookform/resolvers@^3.10.0`, `react-hook-form@^7.61.1`, `zod@^3.25.76` |
| Presentation | `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `framer-motion@^12.38.0`, `lucide-react@^0.462.0`, `next-themes@^0.3.0`, `react-countup@^6.5.3`, `react-day-picker@^8.10.1`, `react-hot-toast@^2.6.0`, `recharts@^2.15.4`, `sonner@^1.7.4`, `tailwind-merge@^2.6.0`, `tailwindcss-animate@^1.0.7` |
| Data, media, and utilities | `axios@^1.15.2`, `date-fns@^3.6.0`, `embla-carousel-react@^8.6.0`, `qrcode.react@^4.2.0`, `@yudiel/react-qr-scanner@^2.6.0`, `react-qr-code@^2.2.0` |

### Development dependencies

| Group | Declared packages |
|---|---|
| Build and language | `@vitejs/plugin-react-swc@^3.11.0`, `vite@^7.3.1`, `typescript@^5.8.3`, `@types/node@^22.16.5`, `@types/react@^18.3.23`, `@types/react-dom@^18.3.7` |
| Styling | `tailwindcss@^3.4.17`, `@tailwindcss/typography@^0.5.16`, `autoprefixer@^10.4.21`, `postcss@^8.5.6` |
| Linting | `@eslint/js@^9.32.0`, `eslint@^9.32.0`, `eslint-plugin-react-hooks@^5.2.0`, `eslint-plugin-react-refresh@^0.4.20`, `globals@^15.15.0`, `typescript-eslint@^8.38.0` |
| Testing and local tooling | `@testing-library/jest-dom@^6.6.0`, `@testing-library/react@^16.0.0`, `jsdom@^29.0.0`, `vitest@^3.2.4`, `lovable-tagger@^1.1.13` |

## Backend dependencies

Manifest: [`VAF_backend/ploggers-attendance-system/package.json`](../VAF_backend/ploggers-attendance-system/package.json).

### Runtime dependencies

| Group | Declared packages |
|---|---|
| NestJS | `@nestjs/common@^10.4.22`, `@nestjs/config@^3.3.0`, `@nestjs/core@^10.4.22`, `@nestjs/jwt@^10.2.0`, `@nestjs/mapped-types@^2.0.5`, `@nestjs/passport@^10.0.3`, `@nestjs/platform-express@^10.4.22`, `@nestjs/swagger@^7.4.2`, `@nestjs/throttler@^6.2.1` |
| Database and validation | `@prisma/client@^5.22.0`, `class-transformer@^0.5.1`, `class-validator@^0.14.1` |
| Authentication | `bcrypt@^6.0.0`, `passport@^0.7.0`, `passport-jwt@^4.0.1` |
| Integrations and documents | `axios@^1.15.2`, `cloudinary@^2.10.0`, `multer@^2.4.0`, `nodemailer@^10.0.15`, `pdf-lib@^1.17.1`, `stripe@^18.5.0` |
| Other runtime packages | `helmet@^8.1.0`, `js-yaml@^5.4.2`, `lodash@^4.18.1`, `qs@^6.16.0`, `reflect-metadata@^0.2.2`, `rxjs@^7.8.1`, `swagger-jsdoc@^6.2.8`, `swagger-ui-express@^5.0.1`, `throttle@^1.0.3` |

### Development dependencies

| Group | Declared packages |
|---|---|
| NestJS and Prisma tooling | `@nestjs/cli@^10.4.9`, `@nestjs/schematics@^10.2.3`, `@nestjs/testing@^10.4.22`, `prisma@^5.22.0` |
| TypeScript and build | `typescript@^5.6.3`, `ts-node@^10.9.2`, `ts-loader@^9.5.1`, `tsconfig-paths@^4.2.0`, `source-map-support@^0.5.21`, `@types/node@^20.19.43` |
| Tests | `jest@^29.7.0`, `ts-jest@^29.2.5`, `supertest@^7.0.0`, `@types/jest@^29.5.14`, `@types/supertest@^6.0.3` |
| Types | `@types/bcrypt@^5.0.2`, `@types/express@^4.17.21`, `@types/nodemailer@^6.4.17`, `@types/passport-jwt@^4.0.1` |
| Linting and formatting | `@typescript-eslint/eslint-plugin@^7.18.0`, `@typescript-eslint/parser@^7.18.0`, `eslint@^8.57.1`, `eslint-config-prettier@^9.1.0`, `eslint-plugin-prettier@^5.2.1`, `prettier@^3.3.3` |

## Configuration and compiler facts

- Frontend alias `@` maps to `VAF_frontend/src`; the Vite dev server is
  configured for port `8080` and host `::`.
- Frontend TypeScript uses ES2020, bundler module resolution, React JSX, and
  `strict: false` in `tsconfig.app.json`.
- Backend TypeScript targets ES2021, emits CommonJS, uses decorator metadata,
  and enables `strict: true`.
- Backend API documentation is created with Nest Swagger when
  `NODE_ENV !== 'production'`.
- The backend Prisma datasource is PostgreSQL and reads `DATABASE_URL`.

See [`05-SETUP-AND-DEVELOPMENT-GUIDE.MD`](./05-SETUP-AND-DEVELOPMENT-GUIDE.MD)
for commands and environment-variable names.