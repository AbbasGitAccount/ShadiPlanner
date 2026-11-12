# ShadiPlanner for Android

Native React Native / TypeScript app built with Expo SDK 58 and Expo Router. It uses the existing Express API, PostgreSQL accounts, profile review, matching permissions and subscription catalogue. It contains native screens, not an embedded website. Android is the only configured platform.

## Run on your phone

From the repository root, start the existing backend:

```powershell
npm run dev:server
```

In another terminal:

```powershell
cd mobile
npm install
Copy-Item .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env`:

- Physical Android: `http://YOUR_PC_LAN_IP:5000/api`. Connect the phone and PC to the same Wi-Fi and allow the backend through your local firewall if necessary.
- Android Studio emulator: `http://10.0.2.2:5000/api`.
- Deployed backend: your real HTTPS API URL.

Start Metro:

```powershell
npm start
```

Open the QR code using an Expo Go build compatible with SDK 58. If your installed Expo Go uses another SDK, use the development-build instructions below. With a configured Android emulator, `npm run android` starts Expo Go on it. Do not use `localhost` for the backend on a physical phone: it refers to the phone itself. Restart Metro after editing environment variables.

Alternatively, `npm run dev:mobile` from the repository root starts Metro. Existing website scripts continue to work.

## Features

- Existing-account sign-in, secure session restoration and logout. Only the JWT is persisted with Expo SecureStore; account/profile data stays in memory. Expired or revoked sessions return to sign-in.
- Registration with the website's seven biodata sections, native selection controls, server validation and field-error navigation.
- Profile discovery, basic filters, plan-gated search, profiles/photos/preferences, shortlists and profile reports.
- Received/sent/accepted interests and independent, revocable consent for admin-assisted introductions.
- Conversation list, unread counts, support conversations and message sending. Threads refresh every 12 seconds while focused; this uses the current REST API rather than inventing a real-time service.
- Profile editing, including partner preferences and an existing HTTPS photo URL. The existing backend has no upload endpoint, so the app does not pretend to upload device photos.
- Current subscription status and the live Free/Gold/Platinum catalogue. No payment provider exists, and Android purchasing is not implemented. Plans cannot be activated through mobile success flags. Any future Play Billing integration must verify purchases server-side before activation.
- Personal wedding checklist and budget CRUD, plus the existing vendor directory. The backend now authenticates planning access and checks ownership for every read/update/delete. Guests and new users no longer receive someone else's planning data.
- Email/password changes with session revocation.
- Admin overview with database KPIs and interactive daily charts, user review/verification/hiding/suspension, assisted introductions, editable plan pricing/features, subscriptions/cancellation/history, payment records, reports and audit history. CSV exports open Android's share sheet as CSV text and remain subject to server-side audit and export limits.

Profile contact details are shown only when the backend's `isContactUnlocked` flag permits them. An administrator role alone does not unlock phone/email access. No backend secrets belong in `EXPO_PUBLIC_*` variables; those values are bundled into the application.

## Shared code and deployment layout

`src/types.ts` reuses the web app's TypeScript contracts. Registration and profile editing directly reuse the pure modules in `client/src/forms/`. Metro watches that source directory while resolving native dependencies from `mobile/node_modules`. Keep `mobile` alongside `client` in this repository. Do not copy the mobile folder out by itself.

For cloud builds, initialize/retain Git at the **repository root**, not inside `mobile`, so the archive includes the shared `client/src` modules. Existing ignore rules exclude server environment secrets. Never add `server/.env` or private keys to a build archive.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npx expo install --check
npm run export:android
```

The final command creates the Android Hermes bundle and assets in ignored `mobile/dist/`; it is **not an installable APK**. Transport tests verify HTTPS release requirements, bearer authentication, expired-session handling, late-response isolation, validation errors, CSV responses and network/proxy failures. From `server/`, `npm run test:admin` also checks planner ownership/validation against temporary PostgreSQL accounts without writing to the real JSON store.

## Installable APK / Play Store bundle

Build profiles are prepared in `eas.json`. Set your real HTTPS backend URL through the corresponding Expo build environment before creating preview/release builds. They intentionally reject insecure or missing production API configuration.

From `mobile/`, after signing into your own Expo account:

```powershell
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

- Development creates an APK with the development client. Start Metro with `npx expo start --dev-client --lan`. Local HTTP is enabled only for this profile.
- Preview creates an installable internal APK using your HTTPS API.
- Production creates a signed Android App Bundle for Google Play using your account's signing configuration.

Confirm the application identifier (`com.shadiplanner.mobile`), replace the starter launcher assets with your final brand assets, and test on an Android device before distributing. This implementation does not upload source, create signing credentials, submit to Google Play or claim device testing. No Android SDK/emulator was available in the coding environment.

Official references: [Expo setup](https://docs.expo.dev/get-started/create-a-project/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Android development builds](https://docs.expo.dev/develop/development-builds/create-a-build/).
