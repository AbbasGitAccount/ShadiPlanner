# Architecture review and implemented corrections

The backend uses PostgreSQL for accounts, biodata, password changes and phone-test
state. Redis is an optional profile read cache. Each request receives its own
profile snapshot. The remaining interaction and wedding-planning collections are
still stored in the local JSON file.

## Findings addressed

| Finding | Correction |
| --- | --- |
| Public lists and nested interest/shortlist/view results exposed raw phone numbers and emails. | A shared profile presenter applies contact access consistently. Only the owner, an administrator, or an approved, accepted connection can unlock contact details. |
| Approved profiles could message other approved profiles without an accepted connection. | Reading and sending messages now require an accepted connection. Conversation summaries apply the same rule. |
| Repeated interest responses could change an already answered request and create repeated welcome messages. | Only pending requests can be answered. New interaction/message identifiers use UUIDs. |
| An edit built from a cached snapshot could overwrite a later phone change or review. | Profile edits acquire a PostgreSQL row lock and merge a validated patch with the current row. Identity, phone, and verification flags cannot be edited through that endpoint. Income display text is derived on the server. |
| Admin approval could approve details edited after the reviewer opened the page. | The client supplies the reviewed `updatedAt` value. The locked database row must still match, otherwise the server returns HTTP 409 and asks the administrator to refresh. PostgreSQL updates the timestamp even for direct SQL changes. |
| Cache invalidation depended on every writer remembering to increment a counter. | A PostgreSQL trigger advances the cache revision in the same transaction for inserts, updates, and deletes, including direct SQL changes. Redis uses revision-specific keys with a finite TTL. |
| Every restart attempted to reimport legacy accounts and profiles. | Named, transaction-protected migration markers import each legacy collection once. Restarting no longer restores records deleted from PostgreSQL. |
| Database outages during authentication were reported as bad passwords/tokens. | JWT validation and database lookup errors are handled separately. Invalid sessions return 401, unavailable authentication storage returns 503, and admin access uses the current database role loaded by authentication. |
| A damaged JSON store silently reset to demo data, and file writes could be truncated. | Invalid stores stop startup without replacement. JSON writes use a temporary file and atomic rename; write failures propagate. |
| A failed local profile mirror could report an error after PostgreSQL had already committed a registration or review. | The optional mirror is updated separately; mirror failures are logged without turning a committed PostgreSQL operation into a false failure. JSON-authoritative feature writes still report failures. |
| Home-page statistics included invented counts and unconditional verification claims. | Counts and rates are calculated from stored, visible profiles and accepted connections. Unsupported marriage totals were replaced with actual phone-verification counts. Loading/error states do not show sample numbers. |

## Boundaries and remaining work

- PostgreSQL is authoritative for account and profile data. Redis is disposable;
  authentication credentials and password/session checks are never cached there.
- Redis is configured for local Docker use but is not installed/running on this
  machine. PostgreSQL fallback has been exercised. Live Redis operation still
  requires starting the configured service.
- The JSON-backed messages, interests, views, shortlists and planner collections
  still require a single backend process. Atomic replacement prevents partial
  files; it does not provide cross-process transactions or shared storage. Move
  these collections to PostgreSQL before running multiple backend instances.
- Profile reads currently load the full snapshot. SQL filtering/pagination and
  separate media/object storage are the next scaling changes as the dataset grows.
- Phone verification remains the explicitly requested local test flow. It sends
  no SMS, leaves phone ownership unverified, and is disabled in production.
- Schema setup still runs at startup. A separately deployed migration command,
  production monitoring/backups, and public login abuse controls should accompany
  a production rollout.

## Verification

The test suite checks contact access, patch validation, concurrent edit protection,
stale admin reviews, direct-SQL cache invalidation, JSON corruption preservation,
profile visibility, password/session changes, OTP test limits, and Redis fallback.
Database integration tests use temporary accounts/profiles and remove them afterward.
