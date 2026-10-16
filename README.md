# CuyoTech University — Student Services Information System (SSIS)

Working prototype for the Final Project (Task 5).
**Stack:** React 18 (Vite) · PHP 8 REST API (no framework, PDO) · MySQL / MariaDB
**Database:** your `cuyotech_ssis` 3NF schema (25 tables), unchanged, plus demo data.

---

## 1. Folder structure

```
cuyotech-ssis/
├── database/
│   ├── 01_schema.sql            ← your 3NF schema (unchanged)
│   ├── 02_seed.sql              ← demo data (roles, permissions, users, courses, grades…)
│   └── cuyotech_ssis_full.sql   ← 01 + 02 in one file (easiest for phpMyAdmin)
├── backend/                     ← PHP REST API
│   ├── index.php                ← entry point / router
│   ├── .htaccess                ← Apache (XAMPP) rewrite rules
│   ├── config/config.php        ← DATABASE SETTINGS + security settings
│   ├── lib/                     ← db, http/validation, auth, business helpers
│   └── routes/                  ← auth, student, registrar, cashier, clearance, department, admin
└── frontend/                    ← React app
    ├── dist/                    ← prebuilt app for XAMPP (no Node.js needed)
    ├── src/
    │   ├── styles/app.css       ← THE ONE SHARED STYLESHEET
    │   ├── components/          ← Layout (sidebar/topbar) + reusable UI
    │   ├── pages/               ← student/ registrar/ cashier/ department/ admin/ shared/
    │   ├── api.js  auth.jsx  nav.js  utils.js  App.jsx
    └── vite.config.js
```

---

## 2. Setup with XAMPP (recommended)

1. **Copy** the whole `cuyotech-ssis` folder into `C:\xampp\htdocs\`
   → you should have `C:\xampp\htdocs\cuyotech-ssis\backend\index.php`
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Open **phpMyAdmin** → *Import* → choose `database/cuyotech_ssis_full.sql` → *Go*.
   (It creates the `cuyotech_ssis` database by itself.)
4. Check `backend/config/config.php` — XAMPP default is user `root` with an empty password, which is already set.
5. Open **http://localhost/cuyotech-ssis/frontend/dist/** — done.
   Test the API: http://localhost/cuyotech-ssis/backend/api/auth/me should show `{"user":null}`.

> If you put the folder under a different name, rebuild the frontend (section 3) with
> `VITE_API_BASE=/<your-folder>/backend/api`.

## 3. Development mode (edit React with live reload)

Needs **Node.js 18+**.

```bash
# Terminal 1 – backend (skip if you use XAMPP Apache)
cd backend
php -S localhost:8000 index.php

# Terminal 2 – frontend
cd frontend
copy .env.example .env      # (macOS/Linux: cp .env.example .env)
npm install
npm run dev                  # open http://localhost:5173
```

In `frontend/.env` set `VITE_API_TARGET` to where the backend runs:
`http://localhost:8000` (PHP built-in server) or `http://localhost/cuyotech-ssis/backend` (XAMPP).

To rebuild `dist/` for XAMPP after changes:

```bash
cd frontend
set VITE_API_BASE=/cuyotech-ssis/backend/api&& set VITE_BASE_PATH=./&& npm run build     # Windows cmd
VITE_API_BASE=/cuyotech-ssis/backend/api VITE_BASE_PATH=./ npm run build                # macOS/Linux
```

### MySQL 8 note
The schema was tested on MariaDB (XAMPP). Oracle **MySQL 8** rejects a CHECK constraint on a column that also
has `ON DELETE CASCADE` (error 3823, table `course_prerequisites`). If you use MySQL 8 instead of XAMPP, remove the line
`CONSTRAINT chk_course_prerequisites_1 CHECK (course_id <> prerequisite_course_id),` — the API already blocks a
course from being its own prerequisite.

---

## 4. Demo accounts (password for all: `password123`)

| Username | Role | Notes for the demo |
|---|---|---|
| `2023-00001` | Student – Juan Dela Cruz (BSIT 3) | Finalized enrollment, clearance in progress (CCS pending), TOR request waiting |
| `2023-00002` | Student – Maria Santos (BSIT 3) | **Not yet enrolled** – failed IT201, so prerequisite checks show; has an approved, unpaid certification |
| `2026-00003` | Student – Jose Mercado (BSIT 1) | New student, not enrolled |
| `2024-00004` | Student – Ana Reyes (BSBA 2) | Enrollment **Submitted**, waiting for Registrar |
| `2023-00005` | Student – Carlo Mendoza (BSIT 3) | Completed clearance, approved Good Moral certificate (free) |
| `registrar` | Registrar | Enrollment review/finalize, grade encoding/publishing, documents, Registrar clearance |
| `cashier` | Cashier | Payment verification, receipts, financial clearance |
| `dept.ccs` | Department (CCS) | CCS clearance, courses & offerings |
| `dept.cba` | Department (CBA) | CBA clearance, courses & offerings |
| `admin` | Administrator | Users, roles & permissions, policies, audit logs |

To reset the demo data, re-import `cuyotech_ssis_full.sql`.

---

## 5. What the prototype covers

| Case-study requirement | Where in the system |
|---|---|
| **Student Portal** – profile, grades, subjects | Dashboard, My Profile (edit contact details only), Grades (per term + GWA), current subjects |
| **Registrar Module** – enrollment, grade encoding | Enrollment Review (eligibility checks, approve / return for correction / reject, finalize → COR), Grade Encoding (encode → publish) |
| **Cashier Module** – payments, receipts | Payment Verification (confirm / unconfirm), Official Receipts (only for confirmed payments), printable OR |
| **Department Module** – clearance processing | Office Clearance (approve / record pending requirements), Courses & Offerings |
| **Admin Module** – user account management | User Accounts (create, activate/deactivate, unlock, reset password), Roles & Permissions matrix, Service Policies, Audit Logs |
| **Document Request System** – TOR, COR, certifications | Student Document Requests → Registrar review (clearance check when required) → payment → release |

### Business rules implemented (from your draft)
- Account must be **Active** and have the right **permission** before any workflow (checked on every API call).
- Enrollment: Draft → Submitted → Approved / For Correction / Rejected → (payment when fees are due) → **Finalized + COR number**. Corrected applications return for review. Students may cancel while pending.
- Prerequisites, already-passed subjects, section capacity and unit limit are validated (student side and registrar side).
- **No-fee path:** if fees are zero/inactive (Admin → Service Policies), payment is skipped.
- Unconfirmed payment does **not** authorize finalization or release; receipt only after confirmation; one receipt per payment.
- Clearance: routed to the student's department + Registrar + Cashier; each office decides only for itself; pending items go back **to the same office** after resubmission; **Completed only when every office approves**.
- Documents: clearance checked **only** when the document type requires it (TOR); release needs approval + confirmed payment if fees apply; delivery channel recorded.
- Students only see **published** grades; published grades are locked.
- Every status change, decision, receipt, grade publication and release is stored in `audit_logs` with user and time; notifications are sent to the affected users.

### Security features (useful for Task 4 – Security Testing)
| Vulnerability | Countermeasure in the prototype |
|---|---|
| SQL injection | PDO prepared statements everywhere (`backend/lib/db.php`), no string-built queries with user input |
| Brute-force login | Account auto-**Locked** after 5 failed attempts in 15 min; admin unlocks it (`config.php`) |
| Unauthorized access / privilege escalation | Server-side permission check on every endpoint (`require_perm`), students can only read their own `student_id` from the session |
| Session hijacking / fixation | HttpOnly + SameSite cookie, session ID regenerated at login, 30-min inactivity timeout |
| CSRF | All POST/PUT requests must carry the `X-SSIS-Request` header |
| XSS | React escapes all output; API returns JSON only with `X-Content-Type-Options: nosniff` |
| Password storage | `password_hash()` (bcrypt), min 8 chars with letters + numbers |
| Forgery of documents | COR and OR numbers are system-generated and verifiable; audit trail of who released what |

---

## 6. Suggested walkthrough for the video (≈8 min)

1. **Login** as `2023-00002` (Maria) → wrong password once to show validation/attempts.
2. **Enrollment**: show IT202/IT302 blocked (*Prereq not met*), select IT201, IT304, BA102 → Submit.
3. Login `registrar` → **Enrollment Review** → open Maria → eligibility checks → Approve. (Also open Ana → *Return for correction* to show the loop.)
4. Login `2023-00002` → **Payments** → Pay via E-Wallet with a reference number.
5. Login `cashier` → **Payment Verification** → Confirm → *Receipt to issue* → Issue receipt → view printable OR.
6. Login `registrar` → Approved tab → **Finalize & generate COR** → open printable COR.
7. Registrar → **Grade Encoding** → IT302 → encode → Save → Publish. Login `2023-00001` → **Grades** shows it (Integration test: Registrar ↔ Student Portal).
8. Juan → **Clearance** → Resubmit to CCS → login `dept.ccs` → approve → `cashier` → Office Clearance → approve → clearance **Completed**.
9. `registrar` → **Document Requests** → approve Juan's TOR (now allowed because clearance is complete) → Juan pays → cashier confirms → registrar **Release**.
10. Login `admin` → create a user, show **Roles & Permissions**, **Service Policies** (set fees inactive = no-fee path), **Audit Logs**.

---

## 7. Customizing the look (one shared stylesheet)

Theme: **CuyoTech Heritage**, dark brown, gold and maroon, matching the group's Figma mockups.

All styling is in **`frontend/src/styles/app.css`**. There are no other CSS files or CSS-in-JS.

- **Section 1, design tokens** (`:root`):
  - `--brown-*`, `--gold-*` and `--maroon` hold the palette.
  - `--primary` sets the button color, `--accent` the active tab/step color.
  - `--bg`, `--surface` and `--sidebar-bg` set the page, card and sidebar colors.
  - Everything else reads from these variables.
- **Dashboard status cards** ("dynamic colors"): the `--tone-red-*`, `--tone-green-*`, `--tone-blue-*` and `--tone-gold-*` tokens.
  The Enrollment card turns **red** when not enrolled and **green** when enrolled (`Stat tone="red|green|blue|gold"`).
- **Images** are in `frontend/src/assets/`:
  - `campus.jpg`: the login and dashboard banner photo. **Replace it with the original high-resolution photo from your Figma file**, using the same file name. The current one was taken from the mockup screenshot, so it is low resolution.
  - `logo-crest.png`: the logo used in the sidebar, the login page and the printed COR/OR. `logo-torch.png` is the alternate logo.
- Components use plain class names: `.btn .btn-primary`, `.card`, `.table`, `.badge-success`, `.alert-warning`, `.modal`, `.stat.tone-green`, `.hero`, `.glass-card`, `.timeline`, `.note-box`, and so on.

After editing in dev mode, the page updates instantly. For XAMPP, rebuild `dist/` (see section 3).

## 8. API reference (all under `/backend/api`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Common | `GET /dashboard`, `GET /terms`, `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /print/cor/{enrollmentId}`, `GET /print/receipt/{receiptId}` |
| Student | `GET/PUT /student/profile`, `GET /student/grades`, `GET /student/subjects`, `GET/POST /student/enrollment`, `POST /student/enrollment/{id}/submit`, `POST /student/enrollment/{id}/cancel`, `GET/POST /student/documents`, `PUT /student/documents/{id}`, `POST /student/documents/{id}/cancel`, `GET/POST /student/clearances`, `POST /student/clearances/{id}/decisions/{did}/resubmit`, `POST /student/clearances/{id}/cancel`, `GET/POST /student/payments` |
| Registrar | `GET /registrar/enrollments`, `GET /registrar/enrollments/{id}`, `POST /registrar/enrollments/{id}/decision`, `POST /registrar/enrollments/{id}/finalize`, `GET /registrar/offerings`, `GET/POST /registrar/offerings/{id}/grades`, `POST /registrar/offerings/{id}/publish`, `GET /registrar/documents`, `POST /registrar/documents/{id}/decision`, `POST /registrar/documents/{id}/release` |
| Cashier | `GET /cashier/payments`, `POST /cashier/payments/{id}/verify`, `POST /cashier/payments/{id}/receipt`, `GET /cashier/receipts` |
| Clearance (any office) | `GET /clearance/queue`, `POST /clearance/decisions/{id}` |
| Department | `GET/POST /department/courses`, `PUT /department/courses/{id}`, `GET/POST /department/offerings`, `PUT /department/offerings/{id}` |
| Admin | `GET /admin/lookups`, `GET/POST /admin/users`, `PUT /admin/users/{id}`, `GET /admin/roles`, `PUT /admin/roles/{id}/permissions`, `GET /admin/policies`, `PUT /admin/fees/{id}`, `PUT /admin/document-types/{id}`, `POST /admin/terms`, `PUT /admin/terms/{id}`, `PUT /admin/offices/{id}`, `GET /admin/audit-logs` |

Errors return JSON `{ "error": "...", "details": {...} }` with proper status codes (401, 403, 404, 409, 422, 423).
