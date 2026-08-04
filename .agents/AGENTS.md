# Project Rules & Guidelines

## Holistic Multi-File Tracing
Whenever addressing a bug, feature update, or UI change:
- **Never fix in isolation**: Do NOT only inspect the immediate file where the issue was reported.
- **Trace the full dependency tree**: Always inspect every connected file across the entire end-to-end stack (frontend HTML templates, JS controllers, shared utilities/DataBus, CSS stylesheets, and backend PHP/API endpoints).
- **Run automated checks across all related modules**: Ensure all related files pass syntax, linting, and structural validation before concluding a task.

---

## ⚡ High-Density Architecture Reference (Token-Efficient Context)

### 1. Stack & System Topology
- **Frontend:** Vue 3 (CDN progressive enhancement) + `DataBus.js` event stream + HSL dark-mode CSS tokens.
- **Backend Services:** PHP 8.x Dual-Gateway (REST Controllers in `api/controllers/` + Modular Station Services in `stations/backend/services/`).
- **Database:** MariaDB 10.x (`gncp_portal`) using 14 `ENGINE=InnoDB` tables. Unified connection singleton in `shared/backend/config/database.php`.

### 2. Key File Map
- **Shared DB Driver:** [`shared/backend/config/database.php`](file:///c:/xampp/htdocs/systemtest/shared/backend/config/database.php) (`Database::getInstance()`).
- **Workstation API Router:** [`stations/backend/api.php`](file:///c:/xampp/htdocs/systemtest/stations/backend/api.php) (Delegates to modular services).
- **Services Layer:**
  - Queue Compilation & Scoping: [`stations/backend/services/QueueService.php`](file:///c:/xampp/htdocs/systemtest/stations/backend/services/QueueService.php)
  - Atomic Student Updates & IT Promotion: [`stations/backend/services/EnrollmentService.php`](file:///c:/xampp/htdocs/systemtest/stations/backend/services/EnrollmentService.php)
  - Cashier Payment Eligibility & Rules: [`stations/backend/services/PaymentService.php`](file:///c:/xampp/htdocs/systemtest/stations/backend/services/PaymentService.php)
- **REST API Router:** [`api/index.php`](file:///c:/xampp/htdocs/systemtest/api/index.php) $\rightarrow$ `api/controllers/*` (`AuthController`, `StudentController`, `AdminController`).
- **Database Schema:** [`database/schema.sql`](file:///c:/xampp/htdocs/systemtest/database/schema.sql) (14 tables: `pre_enrollments`, `students`, `subject_sections`, `sections`, `curriculum`, `programs`, `subjects`, `academic_periods`, `fee_schedule`, `departments`, `station_users`, `enrollments`).

### 3. Core Business Rules & Invariants

#### Student Lifecycle & State Machine
- **Lifecycle Pipeline:**
  `PRE_REGISTERED` (Staging queue) $\rightarrow$ `VERIFIED` (Registrar) $\rightarrow$ `MEDICAL_CLEARED` (Clinic) $\rightarrow$ `ADVISED` (Sectioning) $\rightarrow$ `PAID` (Cashier OR) $\rightarrow$ `ENROLLED / ACTIVE` (IT Center Account Promotion).
- **Dual-Table Querying:** Applications begin in `pre_enrollments`. Upon IT Center promotion, official accounts are established in `students`. Station queries (e.g., Medical Clearances, Status Trackers) must join or query both tables as appropriate to cover both pending applicants and active students.

#### Backend Database & Query Invariants
- **ACID Transactions:** All multi-table mutations MUST be enclosed in `$pdo->beginTransaction()`, `$pdo->commit()`, and `$pdo->rollBack()`.
- **PDO Parameter Uniqueness:** PDO parameter names MUST be unique within a single SQL statement (e.g., do NOT reuse `:id` in both `SET` and `WHERE` clauses; use distinct identifiers like `:set_id` and `:where_id`).
- **Payment Eligibility:** Cashier payments CANNOT be accepted for applicants with status `PRE_REGISTERED` or `REJECTED`.
- **Single Entry-Point REST Gateway (`api/index.php`):** All API operations (Station, Registrar, Admin, Student) MUST route through `api/index.php`. Standalone station or module `api.php` files must delegate to centralized controllers and services.
- **Unified Database Connection Singleton:** All database access across the entire codebase MUST strictly consume `Database::getInstance()` in `shared/backend/config/database.php`. Re-declaring alternative database connection classes (e.g. `ApiDatabase`) is strictly prohibited.
- **Modular Service Decomposition & Token-Efficiency Bounds:** Service classes (in `shared/backend/services/` or `stations/backend/services/`) MUST adhere to Single-Responsibility principles with file sizes kept under 250 lines. Large monolithic API scripts (e.g. `registrar/backend/api.php`) must be refactored into modular domain services.
- **Centralized Error Logging & Request Tracking:** All API gateways and services MUST log errors to `shared/backend/logs/app_errors.log` and propagate `X-Request-ID` correlation headers across frontend requests and backend error traces.

#### Workstation UI & Sorting Conventions
- **Vue 3 Station Pattern:** Use progressive enhancement with Vue 3 mount targets, maintaining UI responsiveness via `DataBus.js` custom events.
- **Interactive Sorting:** Workstation tables must support interactive column headers and sorting toolbars adhering to standard station layout classes (`station-toolbar`, `station-table`).
- **Single-Line Vue Mustache Expressions**: In Vue progressive enhancement HTML templates, all template mustache interpolations (`{{ ... }}`) MUST be strictly formatted on a single line without raw line breaks inside string literals to prevent Vue template compiler `SyntaxError: Invalid or unexpected token` errors.
- **Unified Theme CSS Token Inheritance**: Workstation stylesheets (`registrar/assets/css/style.css` and `stations/*/assets/css/style.css`) MUST NOT hardcode `.sidebar` background gradients or colors. They MUST consume `background: var(--sidebar-bg);` from `shared/css/admin_workstation_theme.css` to ensure single-source-of-truth theme inheritance across all station portals.

#### User Account Provisioning & Security Invariants
- **Password Hashing Mandatory:** All station user password creations or updates MUST use PHP `password_hash($password, PASSWORD_DEFAULT)` and NEVER store unhashed or MD5/SHA1 text.
- **Admin Privilege Enforcement:** Endpoints performing station user creation (`admin/save_user`) MUST verify that the active session user possesses the `ADMIN` role.
- **Unique Username Safeguards:** User creation handlers must catch duplicate key exceptions (`23000` SQLSTATE) and return a standard `400 Bad Request` API response.
- **Admin Role Exclusion in Operator Listings:** The operator management endpoint (`fetch_users`) must maintain the `WHERE role NOT IN ('ADMIN','SUPER_ADMIN')` filter to isolate staff operators from administrative accounts. Admin user accounts must be managed via dedicated super-admin provisioning workflows.
- **Account Status Authentication Enforcement:** All staff authentication handlers (`shared/backend/login.php`) MUST strictly enforce `status === 'ACTIVE'` checks before establishing session states (`gncp_admin_user` / `gncp_station_user`).
- **Domain Separation Invariant:** Staff accounts reside in `station_users` (`REGISTRAR`, `HELPDESK`, `MEDICAL`, `CASHIER`, `IT_CENTER`), while student records reside in `pre_enrollments` and `students`. UI components and APIs must query the correct table according to account type.
- **Centralized SMTP Configuration:** All mail operations (account creation notifications, password resets, system alerts) MUST consume `shared/backend/config/mail.php` configuration.
- **Native Socket SMTP Dispatch & Dual-Port Fallback:** All email dispatch logic in `EmailService.php` MUST use native PHP socket streams (`stream_socket_client`) with automatic fallback between Port 587 (TLS via `STARTTLS`) and Port 465 (Direct SSL via `ssl://`). Mail configurations MUST be centralized in `shared/backend/config/mail.php`.
- **Temporary Password Flag (`must_change_password`):** New staff user accounts created via admin workflows MUST default `must_change_password = 1` and require password update on first login.
- **Password Reset Safeguards:** Reset tokens MUST be securely hashed, time-limited, and invalidated immediately upon successful password updating.

#### 🔄 Zero-Page-Refresh AJAX & Live Sync Invariants
- **No Manual Page Refresh Required**: All frontend modules (Student Portal, Application Tracker, Registrar Station, Station Workstations, Admin Portal) MUST render state updates dynamically using AJAX (`fetch` API) and periodic background polling or event stream synchronizers (`DataBus.js` / `setInterval`).
- **Reactive Vue Lifecycle Integration**: Polling timers MUST be registered in `onMounted()` and cleared cleanly in `onUnmounted()` to prevent memory leaks or redundant network overhead.
- **Immediate Local & Sync Reflection**: UI mutations (e.g. status updates, fee submissions, section allocations) must update local reactive state immediately upon successful AJAX response and trigger queue synchronization events to propagate updates to all connected interfaces.

#### 🏢 Workstation Architecture & Multi-Station Lifecycle Invariants
- **Single Source of Truth Gateway**: All workstations interface with backend services via `/systemtest/api/index.php?action=stations/queue` (polling) and `/systemtest/api/index.php?action=stations/update` (mutations).
- **Background Event Stream**: `StationDataBus` executes a 3-second background polling cycle (`setInterval`), comparing local state (`STORAGE_KEY: gncp_enrollment_queue`) against MariaDB. If server data differs, it updates `localStorage` and fires `window.dispatchEvent(new Event('storage'))` to trigger instant, zero-refresh Vue 3 UI re-renders.
- **Multi-Station Sequential Pipeline**:
  1. `REGISTRAR` (`registrar/index.html`): Pending application review & document requirements verification (`PRE_REGISTERED` $\rightarrow$ `VERIFIED`).
  2. `HELPDESK` (`stations/tlc-helpdesk/`): Unit evaluation, NSTP lock-in, and block sectioning (`VERIFIED` $\rightarrow$ `ADVISED`).
  3. `MEDICAL` (`stations/medical-checkup/`): Doctor physical fitness exam & health clearance (`ADVISED` $\rightarrow$ `MEDICAL_CLEARED`).
  4. `CASHIER` (`stations/payment-processing/`): Downpayment collection, fee schedule validation, and Official Receipt (OR) issuance (`MEDICAL_CLEARED` $\rightarrow$ `PAID`). *Invariant: Cashier payments CANNOT be accepted for `PRE_REGISTERED` or `REJECTED` applicants.*
  5. `IT_CENTER` (`stations/it-center/`): Promotes applicant from `pre_enrollments` staging to official `students` record, generates permanent Student ID (`GNCP-YYYY-XXXX`), and provisions portal access (`PAID` $\rightarrow$ `ENROLLED / ACTIVE`).
- **Dual-Table Aggregation**: `QueueService` queries `pre_enrollments` (staging queue) and `students` (official directory), indexing by reference number, student ID, and email to ensure live student updates (e.g. medical data, payments, sectioning) merge seamlessly across all workstation views.
- **Transactional Integrity**: Account promotion in `EnrollmentService::updateStudent` MUST execute within an explicit `$pdo->beginTransaction()`, `$pdo->commit()`, and `$pdo->rollBack()` block.
- **Temporary Password Enforcement**: Any station or admin user logging in with `must_change_password: true` MUST be intercepted by `PasswordChangeGuard.js` to enforce password change before workstation access is granted.
- **Dynamic Time-of-Day Dashboard Greetings**: All workstation and portal dashboards MUST render dynamic time greetings (`Hello [User/Name]! Great Morning / Great Afternoon / Great Evening`) using local time calculation:
  - `00:00 - 11:59`: `Great Morning`
  - `12:00 - 17:59`: `Great Afternoon`
  - `18:00 - 23:59`: `Great Evening`
- **DB-Level Promotion Assertions in Automation**: End-to-end automated test pipelines (e.g., `tests/selenium/test_runner.py`) MUST NOT rely solely on HTTP status codes or visual step indicators. Critical transition steps—especially IT Center account promotion (`PAID` $\rightarrow$ `ENROLLED`)—MUST perform DB-level assertions confirming that the permanent student record (`students` table) is actually provisioned with a generated `permanentId` and institutional email.
- **Full Credential & Login Flow Verification**: Test runners MUST purge stale test accounts (`test.student.%@gncp.edu.ph`) prior to execution, perform station UI logins, and verify student portal login using generated institutional credentials to ensure full end-to-end account usability.



