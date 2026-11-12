# Matrimonial administration

Open `/admin` using an existing administrator account. The existing login redirects administrators here. Administrator creation and password recovery remain server operations (`npm --prefix server run admin:reset-password`); the API cannot grant roles.

The panel reuses React Router, Lucide, Express, PostgreSQL and Redis. No dependencies, hosted services, analytics fixtures or payment providers were added. Charts aggregate PostgreSQL records. Existing application data is preserved, including any previously imported demo records.

## Configuration and migrations

Restart the backend to apply the idempotent startup migrations. These add account suspension/activity, profile review status, audit and account activity tables, reports, assisted introductions, subscription snapshots, cancellation timestamps, payment capture timestamps and subscription history. No tables or existing accounts are deleted. Existing paid entitlements receive a one-time snapshot of the available catalogue; earlier feature configurations cannot be reconstructed. History begins with this migration.

Environment prices and limits initialize missing plans only. Use **Subscriptions → Edit plan** afterward. Free remains ₹0 and enabled; Gold and Platinum require positive prices and a duration before saving. Features and limits are validated server-side. A row lock plus the expected previous configuration prevents concurrent overwrites. Audit entries preserve before/after pricing and features.

Purchases snapshot the price, duration and entitlements before contacting the provider. Activation copies that snapshot after server verification. Editing/disabling a plan does not change an existing paid subscription or pending purchase. Upgrades are explicit purchases; expired/cancelled memberships may purchase again. There is no automatic renewal. Previous subscription states are retained and available through **View history**. Cancellation ends access immediately and does not issue a refund.

There is currently **no payment provider**. Paid checkout stays unavailable. The existing provider adapter must be implemented and its verified return/webhook flow completed before accepting real payments; see [SUBSCRIPTIONS.md](../server/SUBSCRIPTIONS.md). No admin endpoint marks an order paid or grants unpaid access. Historical orders with an unknown capture date remain undated rather than receiving invented payment dates.

## Privacy and analytics

- Every admin API checks the current database role; tokens cannot assert administrator privileges. Suspended users cannot log in or use existing sessions. React routing also guards the workspace.
- Admin lists and exports omit passwords, emails, phone numbers and payment-provider identifiers. Profile inspection also withholds birth dates. The shared profile presenter requires ownership or a paid entitlement plus an accepted interest for private contact access; an admin role alone never unlocks contacts.
- Profile views, moderation, pricing, reports, introductions, exports and cancellations are audited. Login activity and last activity are recorded. Sign-in budgets use atomic PostgreSQL counters across processes.
- Both members accept an assisted introduction independently. Either may withdraw. Suggestions never grant contact access: the regular interest/plan/approval policy still applies. Reports are submitted from member profiles and reviewed in **Reports**.
- Dashboard daily/monthly buckets and date filters use India time. Total/active/gender/subscription counts describe current platform state; new registrations, accepted matches and verified revenue use the selected period. Active means an authenticated request within 30 days. Accepted interests represent connections, not confirmed marriages.
- Revenue uses captured, server-verified orders and recorded payment dates. Reports summarize revenue by plan and month. Empty data produces zeroes/empty states. CSV exports neutralize spreadsheet formula prefixes, are audited and are capped at 10,000 records per date range.

## Verification

From the project root: `npm run build`.

From `server/`:

```text
npm run test:admin
npm run test:subscriptions
npm run test:profiles
node --test tests/architecture.test.mjs tests/profileUpdate.test.mjs tests/registration.test.mjs
```

The three integration scripts create unique temporary PostgreSQL schemas and remove only those schemas. Admin checks cover role enforcement/revocation, login throttling, private-data redaction, pagination, stale edits, snapshot preservation, restart-safe plans, revocable two-party consent, reports, suspension/session revocation, CSV injection, database analytics, cancellation history and audit logging. Subscription tests cover quotas, expiry and captured-payment verification using a server-only test adapter. Profile tests cover biodata, ownership, protected fields and account-security regression flows. Browser visual verification has not been performed.

## Changed files

Frontend:

```text
client/src/App.tsx
client/src/components/Navbar.tsx
client/src/components/MemberLayout.tsx
client/src/components/SubscriptionSummary.tsx
client/src/components/AssistedSuggestions.tsx
client/src/components/ReportProfile.tsx
client/src/pages/AdminPage.tsx
client/src/pages/admin.css
client/src/pages/InterestsPage.tsx
client/src/pages/ProfileDetailPage.tsx
client/src/services/api.ts
client/src/services/admin.ts
client/src/types/subscriptions.ts
```

Backend and tests:

```text
server/.env.example
server/package.json
server/SUBSCRIPTIONS.md
server/src/server.ts
server/src/data/adminDatabase.ts
server/src/data/authDatabase.ts
server/src/data/profileDatabase.ts
server/src/data/subscriptionDatabase.ts
server/src/middleware/auth.ts
server/src/middleware/loginLimit.ts
server/src/middleware/profileSnapshot.ts
server/src/models/types.ts
server/src/models/subscriptions.ts
server/src/models/profilePresentation.ts
server/src/routes/admin.ts
server/src/routes/adminPanel.ts
server/src/routes/auth.ts
server/src/routes/matchConsent.ts
server/src/routes/profiles.ts
server/src/routes/subscriptions.ts
server/src/services/subscriptionPayments.ts
server/scripts/test-admin.mjs
server/scripts/test-subscriptions.mjs
server/scripts/test-profile-edit.mjs
server/tests/architecture.test.mjs
docs/ADMIN.md
```

Build outputs are regenerated by the build command.
