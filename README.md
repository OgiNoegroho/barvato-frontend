# Barvato — Barbershop Management Frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS v4 web application for the **Barvato** multi-tenant barbershop management platform.

---

## 1. Tech Stack & Architecture

- **Framework**: React 19 (`react`, `react-dom`) with TypeScript 5.7 (`strict` mode)
- **Build Tool & Dev Server**: Vite 8 (`@vitejs/plugin-react`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) and modular feature stylesheets under `src/styles/`
- **Formatting**: `oxfmt` (`oxfmt src`)
- **Authentication & API Client**:
  - Typed fetch wrapper in `src/lib/api.ts` (`apiFetch`)
  - Sends `credentials: "include"` on all requests for `HttpOnly` session cookie authentication (`session_token`)
  - Decodes standard backend JSON error envelopes (`{ error: { code, message, details } }`) into typed `ApiError` instances

---

## 2. Directory Structure

```text
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/          # Shared modals (BookingModal, CheckoutModal) & layout/UI primitives
│   ├── data/                # Static fallback/reference data structures
│   ├── features/            # Domain modules
│   │   ├── appointments/    # Appointment directory, filtering, status actions
│   │   ├── auth/            # AuthContext, LoginPage, multi-shop selector, ChangePasswordModal
│   │   ├── money/           # Financial overview, ledger, commissions, payouts, DailyClose
│   │   ├── operations/      # Live operations board, OpsCalendar, QueuePanel, AppointmentDrawer
│   │   ├── overview/        # Shop dashboard & live chair status
│   │   ├── settings/        # Shop profile, operating hours, service catalog, payroll settings
│   │   └── team/            # Staff roster, StaffModal, BarberCompensationModal, TeamSchedule
│   ├── hooks/               # Custom React hooks (useToast)
│   ├── lib/                 # API client (api.ts), currency/date formatting (format.ts), timeline math (timeline.ts)
│   ├── styles/              # Feature and layout CSS modules
│   ├── App.tsx              # Application shell, session gate, and page router
│   ├── main.tsx             # React DOM entrypoint
│   └── types.ts             # Shared UI domain types
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Cross-Repository Backend & Proxy Configuration

This frontend does not require custom `.env` variables for local development. All API requests use relative paths (`/api/*` and `/healthz`).

In [`vite.config.ts`](./vite.config.ts):
- The Vite development server listens on **port `3000`** (`http://localhost:3000`).
- Requests to `/api` and `/healthz` are automatically proxied to the Go backend at **`http://localhost:8080`** with `changeOrigin: true`.

### Backend Prerequisites for Full-Stack Local Development
1. The Barvato Go backend must be running on `http://localhost:8080` (with Docker PostgreSQL running on host port **`5433`**; never port `5432`).
2. The backend `ALLOWED_ORIGINS` environment variable must include `http://localhost:3000` (e.g., `ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`) so CORS and CSRF origin checks succeed.

---

## 4. Available Scripts & Commands

Install dependencies using `npm`:

```powershell
npm install
```

### Development Server
Starts Vite on `http://localhost:3000`:
```powershell
npm run dev
```

### Type Checking
Runs TypeScript compiler validation (`tsc --noEmit`):
```powershell
npm run typecheck
```

### Production Build & Preview
Builds production assets into `dist/` and previews the bundle:
```powershell
npm run build
npm run preview
```

### Code Formatting
Formats `src/` using `oxfmt`:
```powershell
npm run format
```

### Unit Tests
Runs the timeline calculation unit test suite (`src/lib/timeline.test.ts`) using Node's built-in test runner:
```powershell
node --experimental-strip-types --test src/lib/timeline.test.ts
```

