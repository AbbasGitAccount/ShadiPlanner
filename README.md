# 💍 ShadiPlanner - Matrimonial & Wedding Planning Platform

A modern, full-stack **Matrimonial Platform and Wedding Planning Ecosystem** built with **React (TypeScript)** on the frontend and **Node.js (TypeScript)** on the backend.

An Android React Native app is available in [`mobile/`](mobile/README.md). It reuses this backend and the web app's biodata schemas. Start it with `npm run dev:mobile`; see the mobile guide for API configuration, Expo Go and APK build instructions.

Designed to honor Indian and South Asian cultural traditions with modern security, verified credentials, smart horoscope/compatibility scoring, and integrated wedding management tools.

---

## 🌟 Key Features

### 1. 💑 Matrimonial Profiles & Biodata
- **Detailed Traditional & Modern Biodata**:
  - Personal Details (Age, Height, Mother Tongue, Languages Known, Marital Status)
  - Religious & Horoscope Details (Religion, Community/Caste, Sub-community, Gothram, Rashi, Nakshatra, Manglik status)
  - Education & Career Credentials (Degree, University, Designation, Company, Annual Income in LPA)
  - Family Values & Background (Family Type, Status, Parents' Occupations, Sibling count, Family Base)
  - Lifestyle & Habits (Dietary Preference, Smoking, Drinking, Hobbies & Passions)
  - High-resolution Photo Gallery with thumbnail switcher and zoom
- **Printable Biodata Document**: 1-click clean printable format for family discussions.

### 2. 🎯 Smart Matchmaking & Search Engine
- **Compatibility Score Algorithm**:
  - Automatically calculates percentage match based on reciprocal partner expectations (Age, Height, Faith, Diet, Education, Income, Location).
  - Highlights exact alignment points (e.g. *92% Match - Faith, Diet, Age & Location compatible*).
- **Comprehensive Search Filters**:
  - Bride / Groom toggle
  - Age range slider
  - Religion (Hindu, Muslim, Sikh, Christian, Jain)
  - Mother Tongue (Hindi, Punjabi, Tamil, Telugu, Gujarati, Bengali, Marathi, etc.)
  - Dietary preferences & Kundali/Manglik considerations
  - City/State & free-text keywords (Name, Company, College, Location)

### 3. 💌 Interactions & Connection System
- **Express Free Interest**: Send personalized connect notes with quick respectful templates.
- **Mutual Request Management**: Accept or decline received connection proposals with celebratory confetti.
- **Privacy Protection**: Direct contact details (phone, email) remain locked until an interest is mutually accepted.
- **Bookmark & Shortlist**: Save profiles to review collaboratively with family.
- **Profile Viewers**: Track which candidates have visited your profile.

### 4. 💬 Live Matrimonial Chat
- 2-way real-time messaging between connected brides and grooms.
- Built-in conversation icebreakers for polite, dignified introductions.
- Delivery status & unread count tracking.

### 5. 💒 Integrated Wedding Planner Suite
- **Milestone Checklist Tracker**: Categorized to-dos (Venue & Food, Attire & Jewelry, Ceremony & Rituals, Invitations & Gifts, Photography & Music) with due dates, cost estimates, and completion progress.
- **Interactive Budget Calculator**: Category-by-category allocation vs actual spent tracker with automatic variance calculation.
- **Curated Luxury Vendor Directory**: Verified venues, candid photographers, gourmet caterers, decorators, and bridal mehndi/makeup artists with pricing, ratings, and direct contact.

---

## 🏗️ Project Architecture

```
c:\React\ShadiPlanner\
├── package.json           # Root monorepo manager (concurrently scripts)
├── README.md              # Documentation
├── server/                # Backend API (Node.js + Express + TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example        # PostgreSQL connection and JWT settings template
│   └── src/
│       ├── server.ts      # Express app setup & route mounting
│       ├── models/
│       │   └── types.ts   # Core TypeScript interfaces
│       ├── data/
│       │   ├── mockData.ts # Initial seed profiles, vendors, checklists
│       │   ├── db.ts       # File-persisted JSON database engine (store.json)
│       │   └── authDatabase.ts # PostgreSQL user storage for registration/login
│       │   └── authDatabase.ts # PostgreSQL user storage for registration/login
│       ├── middleware/
│       │   └── auth.ts     # JWT authentication middleware
│       └── routes/
│           ├── auth.ts     # Login, Register, Me
│           ├── profiles.ts # Search, Matching algorithm, Stats, Details
│           ├── interactions.ts # Interests, Shortlists, Profile views
│           ├── messages.ts # Conversations & chat messages
│           └── wedding.ts  # Checklist, Budget & Vendor endpoints
└── client/                # Frontend (React 18 + Vite + TypeScript + Tailwind CSS)
    ├── package.json
    ├── vite.config.ts     # Vite bundler with /api proxy to localhost:5000
    ├── tailwind.config.js # Auspicious Crimson & Gold color theme
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx        # React Router routes
        ├── index.css
        ├── types/         # Client TypeScript models
        ├── context/
        │   └── AuthContext.tsx # Authentication and session management
        ├── services/
        │   └── api.ts     # Centralized API fetch layer
        ├── components/
        │   ├── Navbar.tsx
        │   ├── Footer.tsx
        │   ├── ProfileCard.tsx
        │   ├── CompatibilityBadge.tsx
        │   └── QuickConnectModal.tsx
        └── pages/
            ├── HomePage.tsx
            ├── BrowseMatchesPage.tsx
            ├── ProfileDetailPage.tsx
            ├── InterestsPage.tsx
            ├── MessagesPage.tsx
            ├── ShadiPlannerPage.tsx
            ├── MyProfilePage.tsx
            ├── LoginPage.tsx
            └── RegisterPage.tsx
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v20 or higher, tested on Node v24)
- npm
- PostgreSQL

### 1. Configure PostgreSQL
In PostgreSQL (for example, in pgAdmin's Query Tool), create the database:

```sql
CREATE DATABASE shadiplanner;
```

Then configure the backend:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server\.env` and set `DATABASE_URL` to your PostgreSQL username, password,
host, port, and database. Replace `JWT_SECRET` with a long random secret.
The backend creates the authentication table automatically and imports existing
accounts from `server/src/data/store.json` when it starts.

### 2. Start Both Frontend & Backend (Recommended)
From the root directory `c:\React\ShadiPlanner`, run:

```bash
npm run dev
```

This starts:
- **Backend API Server**: `http://localhost:5000`
- **React Frontend**: `http://localhost:3000`

Passwords are hashed with bcrypt before storage. Login accounts are stored in
PostgreSQL's `auth_users` table. Full biodata is stored in `matrimonial_profiles`,
with named columns for personal, education, family, lifestyle, location, and contact
details. Partner preferences are stored in its `partner_preferences` JSONB column.
The `member_registration_details` view shows accounts, biodata, and individual
partner preference columns together, without password hashes.

Existing profiles from `server/src/data/store.json` are imported automatically on
startup without overwriting PostgreSQL profiles. Registration saves the account
and biodata in one transaction; profile edits and admin reviews also save to
PostgreSQL. The JSON file remains a local copy for profiles and stores other app
features such as messages and wedding planning. Development and compiled builds
use the same JSON path.

In your database tool, refresh the schema and open **Views →
member_registration_details → View/Edit Data** to see all registration fields.
For example:

```sql
SELECT * FROM member_registration_details;
```

---

## Account sign-in

### Local Redis cache

Profile reads use a Redis cache when it is available, with PostgreSQL as the saved
source. Password hashes, sessions, password checks, test codes, and security limits
continue to use PostgreSQL. Redis does not hold login credentials.

With Docker Desktop installed and running, start the local cache from the project root:

```powershell
npm run redis:up
npm run redis:check
```

The local connection is `REDIS_URL=redis://127.0.0.1:6379` in `server/.env`.
Restart the backend after changing that setting. To stop the local cache, run
`npm run redis:down`. The Docker configuration binds Redis to the local machine,
limits it to 128 MB, and treats cached values as disposable.

Cached profile snapshots expire after 60 seconds. A PostgreSQL trigger changes
the revision in the same transaction as any profile insert, update, or delete,
including direct SQL changes; each request checks this revision before looking up its cache key.
New revisions immediately select new keys instead of reusing older snapshots.
User-specific filtering and visibility checks run separately on every request.
Profiles and accounts use a database-specific Redis namespace.

Redis connection and command timeouts are bounded. If Redis is not installed,
stops, or is unreachable, profile reads use PostgreSQL and retry Redis after a
short cooldown. `/api/health` reports `cache` as `connected`, `unavailable`, or
`disabled`, without exposing the connection URL. Remove `REDIS_URL` to disable
Redis entirely. A stopped Redis service does not stop password changes or test
phone updates.

The in-process profile list and JSON file are retained only as a legacy local
mirror. Profile-dependent requests load a fresh snapshot through the
PostgreSQL/Redis path instead of treating server memory as the source.

Legacy accounts and profiles are imported once, tracked in `app_migrations`.
Corrupt local stores stop startup rather than replacing existing data. See
[the architecture review](docs/architecture-review.md) for implemented corrections,
verification, and remaining deployment limits.

Members register their own account and sign in with their email and password. Returning members with a valid saved session stay signed in.

Search Matches and profile details require login in both the UI and API. Signed-out
visitors see a login prompt; opening a saved match-search link returns them to that
search, including its filters, after login. Aggregate platform statistics remain public.

### Password and phone settings

Signed-in administrators and members can open **Account settings** from the menu,
or visit `/account-settings`. The admin dashboard and member profile also link to
this page. Change Password requires the current password, a new password of at
least 8 characters, and matching confirmation. Passwords are hashed with bcrypt.
A successful change ends all previous sessions, including the current one, and
returns the user to sign-in. Administrator recovery through the terminal also
ends earlier sessions.

Choose **Change password** or **Change phone number** to show one task at a time.
Phone updates have a country-code selector and two steps: enter the number, then
enter the code and save. The test screen includes an expiry countdown, an option
to fill the test code, and clear explanations of what each step changes.

Phone updates currently use the requested **free local test mode**. No Firebase
account, external verification service, or SMS charge is involved. Set
`PHONE_VERIFICATION_MODE=test` in `server/.env`, then restart the backend if needed.
Use a fictional international phone number, enter the current account password,
and select **Create free test code**. Enter the code displayed on screen and
select **Complete test & update number**. The existing number stays unchanged
until the code is accepted.

Test codes expire in 5 minutes, can be used once, and allow at most 5 incorrect
attempts. New codes have a 60-second cooldown. Current-password checks are also
rate limited. Codes are stored as keyed hashes and bound to the account, phone
number, and challenge. Completing a test updates the account and its profile in
one transaction and leaves `phone_verified` false. Member biodata returns for
admin review after a phone update. A test does **not** prove phone ownership.

Test endpoints are disabled whenever `NODE_ENV=production`, even if test mode is
enabled. Live SMS verification has not been enabled or connected to a paid
provider. Existing profile-update endpoints cannot change phone verification
flags or bypass the test-code flow.

The account columns are `auth_users.phone`, `phone_verified`, and `auth_version`.
Profile phone details remain in `matrimonial_profiles`; the combined registration
view also exposes the account phone and its verification flag.

After the backend has initialized the database schema, run the focused security
checks from `server/` with `node --test tests/accountSecurity.test.mjs`. These use
temporary test accounts and remove them afterward; they never change the actual
administrator password. Frontend validation tests are in
`client/tests/accountSecurity.test.mjs`.

## 🛠️ Build Commands

To verify TypeScript compilations:

```bash
# Build both server and client
npm run build

# Build backend only
npm run build:server

# Build frontend only
npm run build:client
```


## Admin profile verification

Administrators can select **Message** on any profile in the review dashboard,
or open **Messages** and choose a profile. Approved and pending profiles are both
available, and an administrator does not need a matrimonial profile or an accepted
connection. These conversations are stored in PostgreSQL's
`admin_profile_messages`, separately from member-to-member chats.

Members see incoming administrator conversations in Messages and can reply even
while their profile is awaiting approval. They cannot start an administrator
thread before an administrator contacts them, impersonate an administrator, or
read another member's thread. Ordinary member chats still require approval and
an accepted connection. Administrator conversations support unread counts and
refresh while the Messages page is open. This feature enables individual messages;
it does not send bulk messages automatically.

On a new demo database, the initial administrator account is `admin@shadi.com` / `password123`. Existing PostgreSQL accounts retain their saved passwords; restarting the server does not reset them to the demo password. Administrators sign in at `/login` and are redirected to `/admin`, where they can review full biodata, approve profiles, or hide an approved profile.

If you have forgotten an administrator password, run these commands from `server/` using the email of the account to recover:

```powershell
npm run admin:reset-password -- admin@shadi.com --check
npm run admin:reset-password -- admin@shadi.com
```

The first command only checks whether the administrator exists. The second replaces that account's password with a randomly generated password shown once in the terminal. Save it in your password manager and use it to sign in. This command does not create accounts or give administrator permissions to members. Recovery requires access to the backend configuration and its database credentials.

New registrations remain hidden until approved. Members can view and edit their own pending biodata. Any biodata edit sends the profile back for review. Search, recommendations, public details, shortlists, and conversations exclude unapproved profiles. Approval endpoints require an administrator account, and members cannot change verification fields through profile updates.

Existing member profiles that were automatically verified by the old registration flow are submitted for review on server startup. Demo seed profiles remain approved.
