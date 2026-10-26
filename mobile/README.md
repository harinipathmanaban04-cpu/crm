# Eco CRM — Sales Executive Mobile App (React Native + Expo)

Android app for **Sales Executives only**. Admin / Super Admin keep using the web CRM.
It talks to the **same Express + MongoDB backend** (same login, same JWT, same Socket.IO) — no mock data.

## What's inside
| Feature | Screen | API used |
|---|---|---|
| Login / Logout / forced password change | Login, ChangePassword | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` |
| Dashboard (stats, due follow-ups, pipeline) | Home | `GET /dashboard`, `GET /mobile/followups` |
| My Assigned Leads (search, status filter, paging) | Leads | `GET /leads` |
| Lead details, customer info, Call / WhatsApp / Email / SMS | LeadDetail | `GET /leads/:id`, `GET /customers/:id` |
| Update status & priority, schedule follow-up, convert | LeadDetail | `PUT /leads/:id`, `POST /leads/:id/convert` |
| Add notes (+ optional next follow-up) | LeadDetail | `POST /leads/:id/followup` |
| Lead follow-ups (overdue / today / upcoming) | Follow-ups tab | `GET /mobile/followups` |
| My Tasks (start / complete / reopen) | Menu → My Tasks | `GET/PUT /tasks` |
| My Customers (search, filters, add / edit, full profile) | Menu → My Customers | `GET/POST/PUT /customers`, `GET /customers/:id/profile` |
| Courses & Admissions (admissions add / edit, courses list) | Menu → Courses & Admissions | `GET/POST/PUT /admissions`, `GET /courses` |
| Payment Updates (invoices, log payment for admin verification) | Menu → Payment Updates | `GET /invoices`, `GET/POST /payments` |
| My Performance (+ CSV export via share sheet) | Menu → My Performance | `GET /reports/summary`, `GET /reports/export/:type` |
| Notifications (live + history) | Alerts tab | `GET /mobile/notifications` + Socket.IO |
| Profile (edit name/phone, log out) | Profile | `PUT /auth/profile` |

**Branding:** teal/coral palette and logo copied from the website (`client/tailwind.config.js`, `client/src/assets/logo*.png`).

**Backend changes (additive only):** `server/src/routes/mobile.js` (new, sales-only: notifications feed + follow-up groups) and 2 lines in `server/src/app.js` to mount it. The web app is untouched.
Lead/task/customer restriction is enforced by the existing `scopeFor()` in the backend — a Sales Executive gets 404 for anyone else's records no matter what the app sends.

## Navigation
The ☰ button (top-left of every tab screen, top-right of every full-screen page) opens a drawer with the **same 9 options, in the same order, as the website's Sales Executive sidebar**: Dashboard, My Leads, My Tasks, My Customers, Follow-ups, Courses & Admissions, Payment Updates, My Performance, My Profile. The bottom bar keeps quick access to Dashboard, My Leads, Follow-ups, Alerts and My Profile. All icons are Ionicons (`@expo/vector-icons`). The menu list lives in `src/navItems.js`.

**Change Password** was removed from the Profile screen only. The login, forced first-login password change and the backend API are untouched.

**The floating gear / "Tools" button** you may see over the header while testing is **not part of this app** — it is the Expo Go / development-client developer button. It never appears in a release build (`eas build -p android --profile preview`, or `npx expo run:android --variant release`).

## 1. Run the backend
Put the project in a **short folder outside Downloads/OneDrive**, e.g. `C:\dev\eco-crm` (avoids Windows file-lock `EPERM` errors during `npm install`).
```bash
# from the project root (eco-crm/)
npm run install:all
npm run dev --prefix server      # API on :5000 (listens on all interfaces, so phones on your Wi-Fi can reach it)
```
(`npm run dev` in the root also starts the website; that's fine too.)

**Which database / which login?** The server uses `MONGO_URI` from `server/.env` — your **real** CRM database. Log in to the app with a **real Sales Executive account** that your Super Admin created in the website.
> Do **not** run `npm run seed:demo` against your real database — it inserts demo users and leads. Only use it with a throw-away local database (set `MONGO_URI=mongodb://127.0.0.1:27017/eco_crm_demo` in `server/.env` first); demo Sales logins are then `sales1.demo@gmail.com` / `sales2.demo@gmail.com`, password `Welcome@123`.

**Windows firewall:** allow Node.js on *Private* networks, or run once in an Administrator PowerShell:
`netsh advfirewall firewall add rule name="CRM API" dir=in action=allow protocol=TCP localport=5000`

## 2. Run the app on Android (development)
Requires Node 20.19+ (or 22 LTS). Run every command from the `mobile` folder.
```bash
cd mobile
npm install
npx expo start
```
If `npm install` fails with `ERR_SSL_CIPHER_OPERATION_FAILED`: switch to a phone hotspot / disable VPN and antivirus web-shield, delete `mobile\node_modules` (`cmd /c rmdir /s /q node_modules`), run `npm cache clean --force`, and try again. A `.npmrc` with retry settings is already included.
**A. Real phone (easiest):** install **Expo Go** from Play Store, phone on the **same Wi-Fi** as your PC, scan the QR code.
The app auto-detects your PC's IP from the Expo dev server and calls `http://<PC-IP>:5000/api`. Nothing to configure.
Check: open `http://<PC-IP>:5000/api/health` in the phone's browser → `{"ok":true}`.

**B. Android emulator:** start an emulator in Android Studio, press `a` in the Expo terminal. If the API isn't detected, create `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
```
(`10.0.2.2` is how the emulator reaches your PC's localhost.)

**C. USB debugging with a fixed address:** `adb reverse tcp:5000 tcp:5000` then `EXPO_PUBLIC_API_URL=http://localhost:5000`.

Restart `npx expo start -c` after changing `.env`. Do **not** add `/api` to the URL.

## 3. Production API URL
Deploy the backend over **HTTPS** (e.g. `https://crm.yourdomain.com`) and set in the backend `.env` as usual (`MONGO_URI`, a strong `JWT_SECRET`). The mobile app is native, so CORS doesn't apply to it.
Put the same URL in `mobile/eas.json` (`EXPO_PUBLIC_API_URL`) or in `mobile/.env` for local builds. With an `https://` URL the APK blocks cleartext HTTP automatically; with `http://` (LAN testing builds) it is allowed.
Behind nginx/Cloudflare make sure WebSocket upgrade (`/socket.io/`) is proxied.

## 4. Build a release APK
**Option 1 — EAS cloud build (no Android Studio needed):**
```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure          # first time only
eas build -p android --profile preview     # → downloadable .apk link
```
Edit `eas.json` first and replace `REPLACE-WITH-YOUR-PRODUCTION-API-DOMAIN`.

**Option 2 — Local build (needs Android Studio + JDK 17):**
```bash
cd mobile
# .env must contain EXPO_PUBLIC_API_URL=https://crm.yourdomain.com
npx expo prebuild --platform android
cd android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```
The default release build is signed with the debug key — fine for internal testing. For Play Store create your own keystore (`eas credentials` or Android docs).

## 5. Tests
```bash
cd mobile
npm run test:unit      # URL / WhatsApp helpers (no server needed)
npm test               # + 25 API integration tests; needs a backend with the DEMO data (`seed:demo` on a throw-away DB — never your real DB)
# API=http://192.168.1.5:5000/api npm test   (point at another server)
```
The integration suite covers login, wrong-password/injection, per-executive data isolation, blocked cross-access, status/priority/notes updates, follow-ups, tasks, assignment → WebSocket event → notification, reassignment, invalid-token socket, convert, profile and deactivated-session handling.

## Notes & limits
- Notifications are **in-app, live over WebSocket** (banner + Alerts tab + badge) and refresh on reconnect. They do not arrive as system push notifications when the app is fully closed — that needs Firebase (FCM) setup plus a server-side push sender; it can be added later.
- WhatsApp uses `wa.me`; 10-digit numbers get country code `91` (change `DEFAULT_COUNTRY_CODE` in `src/config.js`).
- Login tokens last 8 hours (existing backend setting); after that the app returns to the login screen.
