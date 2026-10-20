# UstozDaftar.uz — Admin panel

Production-ready admin panel for [UstozDaftar.uz](https://ustozdaftar-uz.web.app), built as a
separate Next.js (App Router) + TypeScript + Tailwind CSS application in `/admin`.

It connects to the **same Firebase project** (`ustozdaftar-uz`) and reuses the existing
Firestore collections and subscription/payment schemas of the main frontend — it does **not**
create duplicate collections.

```text
UstozDaftar.uz/
├── frontend/          # existing main app (unchanged by this panel)
└── admin/             # this admin panel
```

---

## Features

- 🔐 Secure admin login (email + password) via Firebase Auth, gated on the server-assigned
  `admin: true` custom claim. Sessions are stored in an httpOnly cookie created with the
  Firebase Admin SDK (`createSessionCookie`).
- 📊 Dashboard — real numbers from Firestore: total users, new users (30 days), active
  subscriptions, revenue **estimate** (sum of approved payment request amounts), pending /
  approved / rejected payments, and plan distribution. No fabricated data.
- 📈 Analytics — daily/weekly/monthly registration series, payment statistics by status,
  revenue by period, plan distribution. Filterable by 7/30/90 days or all time.
- 👥 Users — searchable, filterable, paginated list; profile detail (registration date, plan,
  expiry, class/assessment counts) and per-user payment history.
- 💳 Payments — browse all `paymentRequests`, inspect details, **approve/reject**. Approval
  updates the request **and** the correct user's `plan`/`planExpiry` in one Firestore
  transaction; self-approval is blocked server-side.
- 🗂 Subscriptions — Free/Pro/Max overview with expiry dates; safe admin management (set a
  user's plan + billing period). Prices are reused from the existing frontend and **unchanged**.
- 🧾 Audit log — server-side record of admin actions (`auditLogs` collection): payment
  approve/reject and subscription changes.
- ⚙️ Settings — only what the existing application supports (project info, security notes).
- 🌗 Dark/light theme, Uzbek (Latin) UI, loading/empty/error states, confirmations,
  responsive layout.

---

## Requirements

- Node.js ≥ 20.9
- npm

## Setup

```bash
cd admin
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open the port shown in the terminal (e.g. `http://localhost:3001` when the main frontend already
uses port 3000; pick another port with `npm run dev -- -p 3002`). You will be redirected to `/login`.

### Windows dev-server note

`npm run dev` runs **webpack** (not Turbopack) on purpose. Turbopack dev writes the `.next/dev`
manifest files (`_buildManifest.js`, `server-reference-manifest.js`, `middleware-build-manifest.js`,
`next-font-manifest.js`) from **two parallel processes** (the main server and a postcss/TS transform
worker). On Windows those concurrent renames intermittently fail with `EPERM: operation not
permitted … rename`, leaving the manifest momentarily stale — which then surfaces as the browser
error *"Missing .next/build-manifest.json entries"* and intermittent HTTP 500s on `/login` and `/`
right after startup or file edits. Webpack compiles in a single process, which eliminates the race
(verified: 0 EPERM and 0 5xx across fresh-start and edit-triggered recompile bursts). Production
builds (`npm run build`) are unaffected.

### Environment variables

See `.env.example`. The `NEXT_PUBLIC_FIREBASE_*` values are the **public web app config and are
the same ones your existing `frontend/.env.local` already uses** — copy them.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | browser | Firebase web app config (copy from `frontend/.env.local`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | browser | ditto |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | browser | ditto (`ustozdaftar-uz`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | browser | ditto |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | browser | ditto |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | browser | ditto |
| `FIREBASE_SERVICE_ACCOUNT` | server only | Full service-account JSON (single line) — **never prefix with `NEXT_PUBLIC_`** |
| `GOOGLE_APPLICATION_CREDENTIALS` | server only | Alternative: path to a service-account JSON file |
| `FIREBASE_ADMIN_PROJECT_ID` | server only | Optional; defaults to `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `ADMIN_SESSION_MAX_AGE_SECONDS` | server only | Optional; session cookie lifetime (default 604800 = 7 days) |

> Provide **one** of `FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`. Without a
> service account, token verification still works, but session-cookie login and admin Firestore
> access will fail with a clear message.

## Secure admin provisioning

The admin account is created and granted privileges **by you, outside this panel**. The panel
never registers users and never assigns admin claims from the client.

1. **Create the account**: Firebase Console → Authentication → Users → **Add user**, set the
   email/password you want for the admin.
2. **Grant the admin claim** (server-side only). Download the project's service-account JSON
   (Project settings → Service accounts → *Generate new private key*) and run once, e.g. on your
   machine or in Cloud Shell:

   ```bash
   # Install the Admin SDK locally (Node):
   npm install --no-save firebase-admin

   # Set the path to the service-account file you downloaded
   export GOOGLE_APPLICATION_CREDENTIALS="$PWD/service-account.json"
   ```

   ```js
   // make-admin.js  (server-side only — do NOT put this in a browser/CLI bundle)
   const { initializeApp, cert } = require("firebase-admin/app");
   const { getAuth } = require("firebase-admin/auth");
   const credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

   initializeApp({ credential: cert(credentials) });

   const ADMIN_UID = "PASTE_THE_ADMIN_USER_UID_HERE"; // from Firebase Console → Users

   await getAuth().setCustomUserClaims(ADMIN_UID, { admin: true });
   console.log("admin claim set for", ADMIN_UID);
   ```

   ```bash
   node make-admin.js
   ```

3. **Refresh the token**: the admin must sign in (or sign out/in) once so Firebase issues an ID
   token that contains the new claim. Then log in at the panel's `/login`.

> ⚠️ Never paste passwords, private keys, or service-account JSON into chat or into client code.
> All secrets live in server-only environment variables.

## How authentication works

1. The login page signs in with **Firebase Auth** in the browser and gets a temporary ID token.
2. `POST /api/auth/login` verifies the token with the **Admin SDK**, checks `admin === true`, and
   exchanges it for a session cookie (`createSessionCookie`) stored as an httpOnly cookie.
3. Every dashboard page (`app/(dashboard)/layout.tsx` via `requireAdminUser()`) and every admin
   API route (`lib/apiGuard.ts`) re-verifies the cookie and claim in Node.js. Non-admins are
   rejected even if they have a valid Firebase account.
4. Logout clears the cookie; the client also signs out of Firebase Auth.

Protection layers: `middleware.ts` (cookie-presence redirect, UX only) → server component guard
(real check) → per-API `requireAdminApi()` (real check) → Firestore rules + Admin SDK.

## Admin data operations

All admin reads/writes go through the **Firebase Admin SDK on the server**, which bypasses
Firestore rules like a privileged service. The existing `frontend/firestore.rules` are **not
weakened**; normal users still cannot change their own `plan` / `planExpiry` or approve payments.

- `paymentRequests` — approval uses a single `runTransaction`:
  1. request exists and is still `pending`
  2. request `uid` ≠ acting admin (self-approval blocked)
  3. target user exists
  4. request → `approved`, `processedAt`, `processedBy`; user → `plan` + `planExpiry`
     (30 days monthly / 365 days yearly — same durations as the existing frontend)
- `auditLogs` — written server-side after each action (actions, actor, target, details, timestamp).
- `users` — plan/expiry are only touched by admin operations; profiles are otherwise read-only in
  this panel.

## Build & deployment

```bash
cd admin
npm run build
npm start          # production server
```

Deployment options: Vercel, Cloud Run, or any Node 20+ host. Ensure the server-only env vars
(`FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS`) are configured on the host and
are **not** exposed to the browser. If you deploy to a host without a persistent filesystem,
prefer `FIREBASE_SERVICE_ACCOUNT` (JSON env var) over a file path.

## Limitations

- **No fabricated analytics**: the application does not record user-activity events, so "active
  users" is shown as *active paid subscriptions* (unexpired Pro/Max), and trends are limited to
  registration and payment data that actually exists.
- Lists load real data with client-side search/filter/pagination. For very large user bases,
  add server-side pagination/composite indexes later.
- Push `firestore.indexes.json` / rules changes for the main project are out of scope for this
  panel (no new indexes required by it).
- Session revocation check (`checkRevoked`) is enabled when service-account credentials are
  configured, otherwise disabled (ID-token verification still works); the cookie is short-lived
  (7 days by default).

## Related

- Main app: `../frontend` (Firebase web config, Firestore rules, schemas)
- Root `firebase.json` / `.firebaserc` — project `ustozdaftar-uz`