# VAF Backend — Ploggers Attendance System

Backend API for the Vinit Abhedya Foundation (VAF) platform, built to support volunteer management, drive attendance, certificates, communication, and related foundation operations.

## Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **Email:** Nodemailer
- **File and Media Storage:** Cloudinary
- **Testing:** Jest
- **Package Manager:** npm

## Features

The backend is organized into modules that support the platform's core functionality:

- **Authentication:** Login, JWT authentication, and authorization.
- **User Management:** User profiles and volunteer-related operations.
- **Drive Management:** Drive creation, management, completion, and attendance workflows.
- **Dashboard:** Dashboard metrics and data retrieval.
- **Certificates:** Certificate generation and management.
- **Cloudinary Integration:** File uploads and certificate/template deletion.
- **Messaging:** Message management.
- **Newsletter:** Newsletter subscription management.
- **Mail:** Email-related functionality.
- **Payments:** Payment-related operations.
- **Database:** Database connectivity and Prisma integration.

## Prerequisites

Before running the backend, ensure you have installed:

- Node.js version compatible with the project configuration.
- npm
- A PostgreSQL database
- Access to the required external services, such as Cloudinary and email delivery.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/VinitAbhedyaFoundation/VAF_backend.git
cd VAF_backend/ploggers-attendance-system
```

If the repository is already cloned, navigate to the backend project directory.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the backend project root and configure the variables required by the application.

The application uses environment configuration for database connectivity, Cloudinary, and other integrations.

At minimum, configure the database connection using `DATABASE_URL` according to your Prisma schema. Add the required authentication and email configuration variables based on the project implementation.

**Do not commit secrets, passwords, API keys, or production environment files to GitHub.**

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Set up the database

Apply the project's existing migrations:

```bash
npx prisma migrate deploy
```

For local development, use the migration workflow agreed upon by your team. Do not reset or recreate a shared database without authorization.

### 6. Run the application

Development mode:

```bash
npm run start:dev
```

Standard mode:

```bash
npm run start
```

Production mode:

```bash
npm run start:prod
```

The application listens on the port configured by the application environment.

## Build

Generate Prisma Client and compile the NestJS application:

```bash
npm run build
```

The project also defines a Vercel build script:

```bash
npm run vercel-build
```

## Testing

The project uses Jest for automated tests.

Run unit tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Generate test coverage:

```bash
npm run test:cov
```

Test coverage depends on the test cases implemented across the modules. Not every module necessarily has dedicated test coverage.

## Project Structure

```text
ploggers-attendance-system/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── auth/
│   ├── certificate/
│   ├── cloudinary/
│   ├── common/
│   ├── dashboard/
│   ├── database/
│   ├── drive/
│   ├── mail/
│   ├── message/
│   ├── newsletter/
│   ├── payment/
│   ├── user/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── package.json
└── README.md
```

## Development Guidelines

- Keep business logic organized within the appropriate NestJS modules.
- Validate incoming requests using DTOs.
- Protect authenticated routes with the appropriate authentication and authorization guards.
- Add or update unit tests when changing existing functionality.
- Run the build and relevant tests before submitting changes.
- Keep credentials and environment-specific configuration out of source control.

## Contributing

1. Create or switch to the appropriate feature or fix branch.
2. Make your changes within the relevant module.
3. Run the relevant tests and build.
4. Commit changes with a descriptive commit message.
5. Push your branch and open a pull request for review.

## License

Refer to the repository's license file for licensing information.
