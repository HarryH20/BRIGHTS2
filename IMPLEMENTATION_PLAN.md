# BRIGHTS2 Platform Evolution — Implementation Plan

Based on `BRIGHTS_REFACTOR.md` and a full codebase audit. All four phases follow the blueprint structure. Email-related items are explicitly excluded per hard constraints. Items already completed in the prior refactor session are marked ✅.

---

## Hard Constraints Recap

1. **No email sending** — Postmark, Resend, SendGrid, SES, or any email library excluded entirely
2. **No Docker changes** — two-container setup, docker-compose.yml, nginx.conf, both Dockerfiles stay as-is
3. **No database provider change** — Supabase PostgreSQL, pool_size=2, max_overflow=2, port 6543
4. **Incremental frontend migration** — new components use new stack; existing touched only when already editing for another reason
5. **No broken functionality** — auth, survey flow, admin panel, all API routes must stay working

---

## Phase 1 — Foundation

### 1A — CSS Token Audit
**Files:** `frontend/src/tokens.css` (new), `frontend/src/main.jsx` (import)  
**Why:** `global.css` already defines the primary CSS variables, but many inline styles across Dashboard, SurveyForm, AdminPage, Login, Register, Profile still use hard-coded literals (`#4f7cff`, `rgba(37,99,235,0.85)`, `#0b1220`, etc.). Tokenizing these into named variables is the contract that Tailwind's `@theme inline` and future white-labeling depend on.  
**Conflicts:** None — pure additive step. global.css already has the base token set.  
**Scope:** S

### 1B — Install Tailwind v4 + shadcn/ui
**Files:** `frontend/package.json`, `frontend/vite.config.js`, `frontend/src/global.css`, `frontend/src/lib/utils.js` (new), `frontend/components.json` (new)  
**Why:** Tailwind v4's `@theme inline` lets Tailwind utilities and `style={}` inline styles share the same CSS variable values bidirectionally. shadcn/ui gives accessible Radix-backed components (Dialog, Select, Toast) we can adopt incrementally.  
**Conflicts:** None — Tailwind v4 uses a Vite plugin and CSS-first config; it doesn't conflict with existing inline styles or global.css. `style={}` props always win specificity over utility classes.  
**Scope:** M  
**Note:** shadcn/ui CLI is interactive; we configure manually by creating `components.json` and installing deps directly.

### 1C — Add TanStack Query v5
**Files:** `frontend/package.json`, `frontend/src/lib/queryClient.js` (new), `frontend/src/App.jsx`  
**Why:** The dashboard already fires 6+ concurrent fetches per load. TanStack Query v5 adds per-query caching, automatic deduplication, hierarchical invalidation, and devtools. The `apiFetch` wrapper enforces `credentials: 'include'` everywhere and converts 401 → redirect to /login.  
**Conflicts:** None — we wrap App.jsx root without touching any existing fetch() calls yet. Existing fetches continue to work.  
**Scope:** S

### 1D — react-error-boundary + localStorage Survey Draft Persistence
**Files:** `frontend/package.json`, `frontend/src/components/ErrorBoundary.jsx` (new), `frontend/src/App.jsx`, `frontend/src/home/SurveyForm.jsx`  
**Why:** A swallowed exception in a research context is lost science. The triple-safety pattern (localStorage draft + error boundary + try/catch in submit) eliminates the lost-data failure class.  
**Conflicts:** `frontend/src/ErrorBoundary.jsx` already exists as a root-level class component wrapping the whole app in main.jsx. The new component goes in `components/` and uses the react-error-boundary library's `ErrorBoundary` with a context prop for per-route/per-widget boundaries.  
**Scope:** M

### 1E — Fix Three Known Bugs ✅ (completed in prior session)
- ✅ Bug 1: `/graphs` route accessible to non-admins — `GraphsPage.jsx` deleted, route removed from App.jsx
- ✅ Bug 2: `SurveyAnalysis.jsx` empty state removed during refactor — empty state restored with `No data available for this timepoint.`
- ✅ Bug 3: `AdminDemographicBarChart` filter dropdowns fire on every keystroke — 400ms `setTimeout` debounce added
**Scope:** S (done)

### 1F — Onboarding Modal
**Files:** `frontend/src/home/OnboardingModal.jsx` (new), `frontend/src/home/Dashboard.jsx`  
**Why:** Multi-step product tours have 60–80% abandon rates; a single 3-panel welcome modal gated on first T1 visit is the evidence-backed alternative. Shows only when `surveyStatus === "due" && surveyTimepoint === 1 && !localStorage["brights2_onboarded"]`.  
**Conflicts:** Dashboard.jsx is already reading surveyStatus and surveyTimepoint — we just add one more condition off existing state.  
**Scope:** M

---

## Phase 2 — Visual Reveal

### 2A — Migrate Rose Plot to ECharts (with feature flag)
**Files:** `frontend/src/graphs/RosePlotECharts.jsx` (new), `frontend/src/graphs/RosePlot.jsx` (feature-flag gate)  
**Why:** Plotly bundle is 1–3 MB; ECharts is ~330 KB gzipped after tree-shaking. ECharts' `aria.enabled + aria.decal.show` adds pattern fills for color-blind users — a unique accessibility feature.  
**Conflicts:** Backend continues to return Plotly figure JSON; the ECharts component will accept the same backend data but render independently. Feature flag via `localStorage["brights2_echarts"] === "true"` allows A/B in development.  
**Scope:** L

### 2B — Migrate Radar Plot to ECharts
**Files:** `frontend/src/graphs/RadarPlotECharts.jsx` (new), `frontend/src/graphs/RadarPlot.jsx` (feature-flag gate)  
**Why:** Same rationale as 2A. ECharts `radar` series maps 1:1 to the Plotly radar config.  
**Scope:** L

### 2C — Skeleton Screens
**Files:** `frontend/package.json` (add react-loading-skeleton), components referencing spinner patterns  
**Why:** Skeleton screens improve perceived performance for loads >1.5s. The dashboard loads 6+ API calls before render; placeholder cards are more trustworthy than a spinner.  
**Scope:** M

### 2D — Action-Titled Chart Headers
**Files:** Dashboard.jsx, each graph component  
**Why:** "Self-efficacy rose 18%" is more legible than "Radar Plot — Goal 2". Academic credibility.  
**Scope:** S

### 2E — Chart Accessibility Table Fallback
**Files:** Each graph component  
**Why:** `<details><summary>View data table</summary>` underneath every chart is the single highest-leverage accessibility move (SVG alone is insufficient per TPGi reviews).  
**Scope:** M

### 2F — Okabe-Ito Color Palette
**Files:** `frontend/src/tokens.css`, `frontend/src/global.css`  
**Why:** Nature Methods recommends Okabe-Ito as the standard for scientific publication; it survives all common color-vision deficiencies.  
**Scope:** S

### 2G — Welcome Modal (superseded by 1F) ✅
Already implemented as OnboardingModal in Phase 1F.

---

## Phase 3 — Commercial Viability

### 3A — Three-CSV Study Import (Backend)
**Files:** `backend/routes/admin.py` (new upload route), `backend/analysis/study_import.py` (new), `backend/requirements.txt` (add pandera, pydantic[v2])  
**Why:** Replaces the hardcoded 6-week, fixed-question study with a REDCap-compatible import format. The three-CSV approach (study.csv, scales.csv, questions.csv) is the FormR insight that makes the format maintainable.  
**Conflicts:** MAJOR — existing survey schema uses hardcoded `FormResponse`, `SurveyQuestion`, etc. This requires schema migration work and cannot be done incrementally without a parallel-write strategy. See 3C.  
**Scope:** XL  
**⚠ Flag:** Safe to implement only after 3B (hybrid schema) is in place. Do NOT start this until schema migration is complete.

### 3B — Hybrid Schema (normalized questions + JSONB responses)
**Files:** New Alembic migration, `backend/models.py`, `backend/routes/survey.py`  
**Why:** The current per-form normalized tables work but cannot survive mid-study extension or multi-study support. The hybrid (normalized question metadata + JSONB response payload with schema_version) is 50,000× faster than EAV and supports append-only extension.  
**Conflicts:** HIGH — requires a parallel-write migration strategy: keep existing tables read-only, backfill into new tables with schema_version=0, switch writes, verify for 30 days, then drop old tables. This is the riskiest migration in the entire plan.  
**Scope:** XL  
**⚠ Flag:** Must run behind a feature flag. Supabase Postgres constraint: no ALTER TABLE on large tables without careful locking. Pool_size=2 means migration scripts must run outside the app process.

### 3C — White-Label Client Theming
**Files:** `backend/models.py` (new `Client` model), `backend/routes/admin.py` (new client CRUD), `frontend/src/lib/applyClientTheme.js` (new), `frontend/src/main.jsx`  
**Why:** A `clients` table with JSONB config applies per-tenant CSS variables before React mounts — no redeploy per client.  
**Conflicts:** None structurally. Custom domain mapping is excluded (requires Cloudflare/Vercel on-demand TLS beyond Azure Container Apps).  
**Scope:** L

### 3D — PDF Reports (Playwright)
**Files:** `backend/requirements.txt` (add playwright), `backend/routes/admin.py` (new `/api/admin/reports/:studyId` route), `frontend/src/home/PrintReport.jsx` (new)  
**Why:** Playwright renders an internal `/reports/:studyId/print` route, reusing React chart components. Single source of truth — screen and PDF render identical code.  
**Conflicts:** Playwright requires a Chromium install (~200–400 MB). This WILL affect the Docker image size and Azure Container Apps memory limits. Only safe if backend container memory is >= 1 GB.  
**Scope:** XL  
**⚠ Flag:** Validate Azure Container Apps memory limit before implementing. WeasyPrint is the fallback (~50 MB, but requires a separate Jinja2 print template).

### 3E — Excel Export
**Files:** `backend/requirements.txt` (add pandas, xlsxwriter), `backend/routes/admin.py` (new `/api/admin/export/excel` route)  
**Why:** Both long and wide format raw-data export; summary statistics with embedded charts. Required for the "research platform" narrative.  
**Scope:** L

---

## Phase 4 — Polish & Operationalize

### 4A — TanStack Query Migration (convert existing fetches)
**Files:** All components currently using `useEffect + fetch()`  
**Why:** Dashboard fires 6+ parallel fetches per load. TanStack Query's hierarchical invalidation (`studyKeys.detail(studyKey)`) is cleaner than the current chartCache pattern.  
**Conflicts:** chartCache in App.jsx will be removable once TanStack Query caches everything.  
**Scope:** L  
**Note:** 1C installs and configures this; 4A converts existing calls. Do not do both in one pass.

### 4B — Study Lifecycle State Machine
**Files:** `backend/models.py` (add `status` enum to study), `backend/routes/admin.py`, `frontend/src/admin/AdminPage.jsx`  
**Why:** DRAFT → TEST → ENROLLING → COLLECTING_ONLY → CLOSED → LOCKED → ARCHIVED gives audit-defensible research platform semantics.  
**Scope:** XL

### 4C — Immutable Audit Log Enforcement
**Files:** Supabase SQL (via migration), `backend/models.py`  
**Why:** `CREATE RULE no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING` on the Postgres side. The `AuditLog` model already exists — this is a DB-level constraint.  
**Conflicts:** Must run as a Supabase SQL migration, not via SQLAlchemy `create_all()`.  
**Scope:** S

### 4D — Deployment to Railway (optional, alternative to Azure)
**Files:** `railway.toml` (new), possible changes to `.github/workflows/ci.yml`  
**Why:** Railway Hobby ($5/month) has faster deploy cycles than Azure Container Apps for a capstone demo.  
**Conflicts:** HARD CONSTRAINT — cannot change Docker architecture. Railway supports docker-compose natively so this is feasible. But CI/CD currently targets Azure; switching requires workflow changes which are excluded from current scope.  
**⚠ Flag:** Skip unless user explicitly wants to change deployment target.  
**Scope:** M

### 4E — Email Reminders
**⛔ EXCLUDED** — hard constraint #1. No email sending of any kind.

---

## Items Flagged as NOT Safe Under Hard Constraints

| Item | Constraint Violated | Alternative |
|------|---------------------|-------------|
| Email reminders (all phases) | Constraint #1: no email sending | Excluded entirely |
| Subdomain-based routing | Constraint #2: Docker arch unchanged | Use path-based routing instead |
| PostgreSQL provider migration | Constraint #3: Supabase stays | N/A |
| Playwright PDF if >1 GB memory needed | Constraint #2: Docker arch | WeasyPrint fallback, or disable in Container Apps |
| Big-bang component rewrite | Constraint #4: incremental only | Per-file incremental migration |
| Changing DATABASE_URL pool settings | Constraint #3: pool_size=2, port 6543 | Keep existing engine options |

---

## Phase 1 Execution Status

| Item | Status | Files Changed |
|------|--------|---------------|
| 1A CSS Token Audit | ✅ Done | tokens.css created, main.jsx updated |
| 1B Tailwind v4 + shadcn | ✅ Done | package.json, vite.config.js, global.css, lib/utils.js, components.json |
| 1C TanStack Query | ✅ Done | package.json, lib/queryClient.js, App.jsx |
| 1D Error boundary + survey draft | ✅ Done | components/ErrorBoundary.jsx, App.jsx, SurveyForm.jsx |
| 1E Bug fixes | ✅ Done (prior session) | GraphsPage deleted, SurveyAnalysis empty state, debounce |
| 1F Onboarding Modal | ✅ Done | OnboardingModal.jsx, Dashboard.jsx |
