# Eco Friendly Tech Solutions — Real-Time CRM (MERN + Socket.IO)

Roles: **Super Admin · Admin · Sales Executive** — shared MongoDB, live updates over WebSockets.

## Run in VS Code (3 steps)
Prerequisites: Node.js 18+ and MongoDB running locally (or put an Atlas URI in `server/.env` → `MONGO_URI`).

```bash
npm run install:all     # installs root, server and client packages
npm run seed:demo       # creates Super Admin, 8 courses + demo team/users/leads
npm run dev             # API on :5000, web app on http://localhost:5173
```
(`npm run seed` creates only the Super Admin + courses, no demo data.)

## Logins
| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@gmail.com | Admin@12345 |
| Admin (demo) | admin.demo@gmail.com | Welcome@123 |
| Sales Exec (demo) | sales1.demo@gmail.com / sales2.demo@gmail.com | Welcome@123 |

Super Admin sets each Admin/Sales Executive password when creating the account and can edit it any time (Accounts → key icon or Edit).
Change `JWT_SECRET` and the seed credentials in `server/.env` before any real use.

## Try the real-time flow
Open two browsers (e.g. normal + incognito): log in as Super Admin and as `sales1.demo@gmail.com`.
Create a lead as Super Admin and assign it to Karthik → it appears in his **My Leads** instantly.
Transfer a member between teams in **Teams** → the Admin/Sales dashboards and permissions update instantly.

## Structure
- `server/src/models.js` – User, Team, Lead, Task, Customer, Course, Admission, Invoice, Payment, ActivityLog
- `server/src/scope.js` – record-level permissions used by every query (Admin = own team, Sales = own records)
- `server/src/realtime.js` – authenticated Socket.IO, server-decided rooms, events after DB writes
- `server/src/routes/*` – REST API · `client/src/pages/*` – role-aware UI

## Notes
- Payments are manual entries (no gateway integrated). Sales Executives can only log *Pending* payment updates; Admin/Super Admin verify them.
- Passwords: bcrypt. Sessions: JWT (8h) invalidated on deactivation, password reset, or role change.
