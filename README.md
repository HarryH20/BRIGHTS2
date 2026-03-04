# BRIGHTS2

A full-stack web application for a psychology research study on "beyond-the-self" goal progression. Participants complete 6 weekly surveys (T1–T6), view their goals, track progress across timepoints, and explore their data through interactive visualisations.

Built with **Flask** (backend), **React/Vite** (frontend), **PostgreSQL via Supabase** (database), running in **Docker**. Deployed on **Azure Container Apps**.

---

## Live App

**https://brights-frontend.purplesmoke-6b0cc5a0.southcentralus.azurecontainerapps.io**

---

## Table of Contents

1. [Quick Start (Local)](#quick-start-local)
2. [Accounts](#accounts)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Database Tables](#database-tables)
7. [API Reference](#api-reference)
8. [Survey System](#survey-system)
9. [Visualization System](#visualization-system)
10. [Security](#security)
11. [Common Commands](#common-commands)
12. [Git Workflow](#git-workflow)
13. [Azure Deployment](#azure-deployment)
14. [Troubleshooting](#troubleshooting)

---

## Quick Start (Local)

### Prerequisites

- Docker + Docker Compose
- `.env` file (see below)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/HarryH20/BRIGHTS2.git
   cd BRIGHTS2
   ```

2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```
   Fill in the values. Get `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` from your team lead. Generate a secret key:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Start all services**
   ```bash
   docker compose up --build -d
   ```

4. **Access the app**

   | Service | URL |
   |---------|-----|
   | Frontend | http://localhost:3000 |
   | Backend API | http://localhost:5000 |
   | Dev (hot reload) | http://localhost:3001 |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string — **must use port 6543** (Supabase transaction mode) |
| `FLASK_SECRET_KEY` | Random hex string for session signing |
| `FLASK_ENV` | `development` or `production` |
| `SUPABASE_URL` | Supabase project URL (for Storage uploads) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for Storage uploads) |

> **Important:** `DATABASE_URL` must point to port **6543**, not 5432. Port 5432 is Supabase's session-mode pooler and will cause `MaxClientsInSessionMode` errors with multiple Gunicorn workers.

---

## Accounts

### Admin

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| admin | BrightsAdmin2026! | admin | Full admin — question management, audit logs |
| demo_admin | DemoAdmin2026! | admin | Demo admin — same access as admin, safe to share for demos |

Both accounts have access to all `/api/admin/*` endpoints including the admin panel, rose plot aggregations, audit log, and survey question editor.

> **Creating accounts:** These are created directly in Supabase (one-time setup). If you need to recreate `demo_admin` run `python create_demo_admin.py` from inside the `web` container — it is idempotent.

### Demo Participants

| Username | Password | Goals |
|----------|----------|-------|
| demo1 | BrightsDemo2026! | lose weight / make money / be available to children |
| demo2 | BrightsDemo2026! | get into masters / get interview / get hired |
| demo3 | BrightsDemo2026! | fix car / make extra money / read Bible |

### Research Participants (904 accounts)

All 904 real research participants from the `GoalIntervention` dataset have been created as user accounts.

- **Username:** first 12 characters of participant ID (lowercased)
- **Password (initial):** full 32-character participant ID
- **Participant ID linked:** yes — `users.participant_id` links to `GoalIntervention."ID"`, so visualisation data loads automatically

A full credentials list is stored in `data/participant_credentials.csv` (not committed to git — kept locally/shared securely).

---

## Features

- **Authentication** — register, login, logout, change password, account lockout after 5 failed attempts (15-minute cooldown)
- **Display name** — set a display name shown on the dashboard welcome header instead of username
- **Profile picture** — upload a JPEG/PNG/GIF/WebP avatar (max 2MB) stored in Supabase Storage
- **Weekly survey form** — T1–T6 built-in survey replacing Qualtrics; one form per week, auto-unlocking 7 days after each submission
- **Dashboard** — per-goal cards showing real goal names, latest Likert scores, radar chart per goal, and a survey prompt banner when a form is due
- **Goal pages** — per-goal T2–T6 score breakdown (progress, confidence, importance)
- **Survey results** — full question-by-question responses for a timepoint
- **Survey analysis** — score changes vs baseline (T1) for each timepoint
- **Rose plot** — Plotly polar bar chart of goal progression across T2–T6; filterable by goal and week range
- **Radar plot** — Plotly spider chart per goal showing T2–T6 scores
- **Audit logging** — all auth events (login, logout, register, password change, lockout) written to `audit_log` with IP and request ID
- **Session logging** — login/logout pairs with session duration tracked in `session_log`

---

## Architecture

```
┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  brights-frontend    │────▶│  brights-backend     │────▶│  PostgreSQL/Supabase │
│  React/Nginx         │     │  Flask/Gunicorn      │     │  + Supabase Storage  │
│  ACA external        │     │  ACA internal        │     │                      │
└──────────────────────┘     └─────────────────────┘     └──────────────────────┘
```

**Nginx** (in the frontend container) proxies `/auth/*` and `/api/*` requests to the backend. The browser only ever talks to the frontend host — the backend has no public URL, it only accepts traffic from within the Azure Container Apps environment.

**Session-based auth** — Flask uses server-side sessions (30-minute timeout). Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

**Connection pooling** — SQLAlchemy is configured with `pool_size=2, max_overflow=2` to stay within Supabase's transaction-mode pooler limits. Never raise these values significantly without upgrading the Supabase plan.

---

## Project Structure

```
BRIGHTS2/
├── backend/
│   ├── app.py                        # Flask entry point — config, middleware, security headers, error handlers
│   ├── models.py                     # SQLAlchemy ORM models (see Database Tables section)
│   ├── logging_config.py             # Centralised structured logging setup
│   ├── routes/
│   │   ├── auth.py                   # /auth/* — login, register, logout, password, avatar, display name
│   │   ├── visualizations.py         # /api/visualizations/* — goals data + auto-discovery graph server
│   │   ├── survey.py                 # /api/survey/* — participant survey routes + /api/admin/survey/* admin routes
│   │   ├── admin.py                  # /api/admin/* — general admin endpoints
│   │   └── logs.py                   # /api/logs/* — audit/session log access
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Top-level router, auth state, logout handler
│   │   ├── auth/
│   │   │   ├── Login.jsx             # Login form
│   │   │   └── Register.jsx          # Registration form
│   │   ├── home/
│   │   │   ├── HomeLayout.jsx        # Shared nav/layout wrapper used by all authenticated pages
│   │   │   ├── Dashboard.jsx         # Main dashboard — goal cards, survey prompt, rose plot, radar plots
│   │   │   ├── SurveyForm.jsx        # Weekly survey form (T1–T6) with goal tabs and progress bar
│   │   │   ├── GoalPage.jsx          # Per-goal T2–T6 score table
│   │   │   ├── GraphsPage.jsx        # Graphs overview page
│   │   │   ├── OverviewPage.jsx      # Full-screen rose plot view
│   │   │   ├── SurveyResults.jsx     # All goals' raw scores for a timepoint
│   │   │   ├── SurveyAnalysis.jsx    # Score changes vs baseline (T1) per timepoint
│   │   │   ├── Profile.jsx           # Account settings — password, avatar, display name
│   │   │   └── LoadingScreen.jsx     # Shared loading screen component
│   │   └── graphs/
│   │       ├── RosePlot.jsx          # Plotly rose plot wrapper component
│   │       └── RadarPlot.jsx         # Plotly radar plot wrapper component
│   ├── nginx.conf                    # Nginx config — proxies /auth/* and /api/* to backend
│   └── Dockerfile
├── analysis/                         # Python data science modules — auto-discovered by the viz endpoint
│   ├── roseplot.py                   # Rose plot: fetch_data() + build_figure()
│   └── radarplot.py                  # Radar plot: fetch_data() + build_figure()
├── data/                             # Local data files (gitignored)
│   └── participant_credentials.csv   # 904 participant usernames + initial passwords
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts — `username`, `email`, `password_hash`, `role` (`user`/`admin`), `participant_id`, `display_name`, `avatar_url`, `failed_attempts`, `locked_until` |
| `audit_log` | Immutable auth event log — event type, user, IP, request ID, timestamp |
| `session_log` | Login/logout pairs with session duration in seconds |
| `GoalIntervention` | Historical research data imported from CSV — 910 participants, goals at T1, scores at T2–T6 for Q39/Q40/Q41 per goal |
| `survey_questions` | Admin-editable question bank — seeded with Q1–Q43 per form type; questions are never deleted (soft-deactivated) |
| `survey_submissions` | Tracks which timepoints each user has submitted and when the next one unlocks |
| `survey_responses` | Normalized per-question responses — one row per user/goal/timepoint/question |

### Key relationships

- `users.participant_id` → `GoalIntervention."ID"` — links a user account to their historical research data for visualisations
- `survey_responses.question_id` → `survey_questions.id`
- `survey_responses.user_id` → `users.id`
- `survey_submissions.user_id` → `users.id`

### User roles

| Role | Access |
|------|--------|
| `user` | All participant-facing routes |
| `admin` | All participant routes + `/api/admin/*` endpoints |

---

## API Reference

All endpoints return JSON. Auth state is maintained via HTTP-only session cookies.

### Auth (`/auth/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | — | Create new user. Body: `{username, email, password}` |
| `/auth/login` | POST | — | Login. Body: `{username, password}` or `{email, password}`. Returns user object. Locks account after 5 failures. |
| `/auth/logout` | POST | Required | Clear session. |
| `/auth/me` | GET | Required | Returns current user: `{id, username, email, role, participant_id, avatar_url, display_name, created_at, last_login}` |
| `/auth/change-password` | POST | Required | Body: `{current_password, new_password}` (min 8 chars) |
| `/auth/display-name` | POST | Required | Body: `{display_name}` (max 100 chars). Updates welcome header on dashboard. |
| `/auth/avatar` | POST | Required | Multipart `file` field. Uploads to Supabase Storage `avatars/` bucket. Returns `{avatar_url}`. |

### Survey — Participant (`/api/survey/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/survey/next` | GET | Required | Returns the current survey state for the logged-in user (see below). |
| `/api/survey/submit` | POST | Required | Submit survey responses. Body: `{timepoint, responses: [{question_id, goal_index, response_value}]}` |
| `/api/survey/dev/unlock-all` | POST | Required | **Dev only** — sets `next_unlocks_at` to now, skipping the 7-day lock. Returns 403 in production. |
| `/api/survey/dev/reset` | POST | Required | **Dev only** — deletes all survey data for current user so they can restart from T1. Returns 403 in production. |

#### `/api/survey/next` response shapes

```jsonc
// Survey is due — includes questions and goal texts
{
  "status": "due",
  "timepoint": 2,
  "form_type": "t2",
  "goals": ["lose weight", "make money", "be available to children"],
  "questions": [
    { "id": 1, "question_number": 1, "question_text": "...", "scale_type": "likert7", "display_order": 1 },
    ...
  ]
}

// Locked — waiting for 7-day window
{ "status": "locked", "timepoint": 3, "next_unlocks_at": "2026-01-15T10:30:00+00:00" }

// All 6 timepoints complete
{ "status": "complete" }
```

### Survey — Admin Questions (`/api/admin/survey/*`)

All admin routes require `role = admin`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/survey/questions?form_type=t1` | GET | List active questions for a form type (`t1`, `t2`, `t3t5`, `t6`) |
| `/api/admin/survey/questions/history?form_type=t1` | GET | All questions including inactive (full history) |
| `/api/admin/survey/questions` | POST | Add a new question. Body: `{form_type, question_text, scale_type, question_number}` |
| `/api/admin/survey/questions/<id>` | PUT | Edit question wording in-place. Body: `{question_text}` |
| `/api/admin/survey/questions/<id>/deactivate` | POST | Soft-remove — sets `status = inactive`, kept in history |
| `/api/admin/survey/questions/<id>/replace` | POST | Replace a question. Body option A: `{activate_question_id: N}` (reactivate from history). Body option B: `{question_text, scale_type}` (create new) |

**Why soft-delete?** Questions are never hard-deleted because `survey_responses` rows reference them. Deactivating a question removes it from new surveys but keeps all historical responses valid.

### Visualisations (`/api/visualizations/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/visualizations/goals` | GET | Required | Returns goal text and T2–T6 scores (Q39/Q40/Q41) for current user from `GoalIntervention` |
| `/api/visualizations/roseplot` | GET | Required | Rose plot Plotly figure dict. Params: `goal_id` (GoalID int or "all"), `weeks` ("2-6", "3-6", "4-6", "5-6", "all") |
| `/api/visualizations/radarplot` | GET | Required | Radar plot Plotly figure dict. Param: `goal_index` (0-based int) |

---

## Survey System

The app replaces Qualtrics with a built-in survey. Participants complete 6 weekly surveys (T1–T6), one per week.

### Form types

| Form type | Used at | Questions |
|-----------|---------|-----------|
| `t1` | T1 (Week 1) | 3 goal-text questions + Q1–Q22 Likert per goal |
| `t2` | T2 (Week 2) | Q1–Q43 Likert per goal |
| `t3t5` | T3, T4, T5 | Q1–Q43 Likert per goal (same set) |
| `t6` | T6 (Week 6) | Q1–Q43 Likert per goal |

**T1 is special** — it has 3 `goal_text` questions (stored with `display_order` -9/-8/-7) where the participant types their 3 goals. These goal texts are then shown on all future surveys and used to label cards in the dashboard.

### Survey flow

1. On first login the dashboard shows a **"Week 1 survey is ready"** prompt
2. Participant clicks → `/survey` page, fills in form per goal (tabs for Goal 1 / 2 / 3)
3. Submit → backend saves one `SurveyResponse` row per question per goal, plus a `SurveySubmission` row with `next_unlocks_at = now + 7 days`
4. T2–T6 forms show real goal names from T1 responses (or from `GoalIntervention` for historical participants)
5. After all 6 timepoints the form shows a completion screen

### Question scale types

| `scale_type` | Rendered as |
|-------------|-------------|
| `likert7` | 7 labelled buttons (Strongly Disagree → Strongly Agree) |
| `goal_text` | Free-text textarea for entering a goal description (T1 only) |

### Dev testing — bypassing the 7-day lock

When `FLASK_ENV=development`, call these from the browser console while logged in:

**Unlock all surveys immediately** (run after submitting one to skip the 7-day wait):
```js
fetch('/api/survey/dev/unlock-all', { method: 'POST', credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

**Reset all survey data** (start the entire flow from T1 again):
```js
fetch('/api/survey/dev/reset', { method: 'POST', credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

Both return 403 in production.

### Seeding / verifying questions

The `survey_questions` table should have **151 rows** after seeding:
- 22 active questions for `t1` (3 goal_text + 19 likert7... adjust to match actual seed)
- 43 active questions each for `t2`, `t3t5`, `t6`

Check from the browser network tab by calling `/api/survey/next` while logged in.

---

## Visualization System

Charts are auto-discovered from `analysis/`. To add a new chart:

1. Create `analysis/<name>.py`
2. Implement two functions:
   ```python
   def fetch_data(user_id, engine, **kwargs):
       # Query DB, return data dict (or None if no data)
       ...

   def build_figure(data):
       # Build and return a Plotly figure as a dict (fig.to_dict())
       ...
   ```
3. Add the module name to `_ALLOWED_GRAPHS` in `backend/routes/visualizations.py`
4. It's then available at `/api/visualizations/<name>` — no other backend changes needed

**How it works:** `visualizations.py` uses `importlib.import_module(f"analysis.{graph_name}")` to dynamically load whichever module matches the URL path segment, then calls `fetch_data(user_id, engine, **request.args)` and `build_figure(data)` in sequence.

**Current charts:**

| Module | Endpoint | Description |
|--------|----------|-------------|
| `roseplot.py` | `/api/visualizations/roseplot` | 6×3 polar bar grid — one polar bar per timepoint (T2–T6) per question (Q39/Q40/Q41) |
| `radarplot.py` | `/api/visualizations/radarplot` | Spider chart per goal. Full mode (5 traits, T1 baseline) for in-app survey participants; simple mode (Progress/Confidence/Importance from Q39/40/41, T2 baseline) for historical participants. |

**Data source:** All charts read from `survey_responses`. Historical research data (formerly in `GoalIntervention`) was migrated into `survey_responses` so historical participants are treated identically to new in-app users.

---

## Security

- **Password hashing** — Werkzeug `generate_password_hash` (PBKDF2-HMAC-SHA256 with salt)
- **Account lockout** — 5 failed login attempts → 15-minute lockout. Attempts counter resets on successful login.
- **Session security** — HttpOnly, SameSite=Lax cookies; Secure flag in production; 30-minute idle timeout
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `Strict-Transport-Security` (production only)
- **Audit logging** — every auth event written to `audit_log` with user ID, IP, and request ID
- **Admin protection** — `admin_required` decorator checks `role == "admin"` from DB on every admin route, not just the session
- **Proxy trust** — `ProxyFix` middleware trusts one layer of `X-Forwarded-For` from nginx/Azure load balancer for accurate IP logging

---

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up --build -d` | Build and start all containers in background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f web` | Stream backend logs |
| `docker compose logs -f frontend` | Stream frontend logs |
| `docker compose down -v && docker compose up --build -d` | Full reset (removes volumes) |

---

## Git Workflow

1. Pull latest master
   ```bash
   git checkout master && git pull origin master
   ```
2. Create your branch
   ```bash
   git checkout -b your_name_feature
   ```
3. Commit and push, open a PR targeting `master`
4. After merge to master, merge `master` → `prod` to trigger auto-deploy to Azure

> **Note:** `docs/` is in `.gitignore` and will not be committed. Only `backend/` and `frontend/` changes deploy.

---

## Azure Deployment

The app is deployed on **Azure Container Apps** with images stored in **Azure Container Registry**.

### Resources

| Resource | Name |
|----------|------|
| Resource group | `brights-rg` |
| Container registry | `brightsregistry.azurecr.io` |
| ACA environment | `brights-env` (southcentralus) |
| Frontend app | `brights-frontend` (external ingress — public URL) |
| Backend app | `brights-backend` (internal ingress — only reachable from within the ACA environment) |

### CI/CD — Auto-Deploy on Push to `prod`

Every push to `prod` automatically:
1. Builds and verifies frontend + backend
2. Builds both Docker images tagged with the commit SHA
3. Pushes to Azure Container Registry
4. Rolls out new images to both Container Apps (zero downtime rolling update)

Uses OIDC (Workload Identity Federation) — no stored Azure credentials in GitHub.

### Manual Deploy (if needed)

```bash
az acr login --name brightsregistry

docker build -t brightsregistry.azurecr.io/brights-backend:vN ./backend
docker push brightsregistry.azurecr.io/brights-backend:vN

docker build -t brightsregistry.azurecr.io/brights-frontend:vN ./frontend
docker push brightsregistry.azurecr.io/brights-frontend:vN

az containerapp update --name brights-backend --resource-group brights-rg \
  --image brightsregistry.azurecr.io/brights-backend:vN

az containerapp update --name brights-frontend --resource-group brights-rg \
  --image brightsregistry.azurecr.io/brights-frontend:vN
```

> Always use versioned tags — `:latest` won't trigger a new revision in Azure if the digest hasn't changed.

---

## Troubleshooting

**Containers won't start:**
```bash
docker compose down -v && docker compose up --build -d
```

**Backend connection pool exhausted (`MaxClientsInSessionMode`):**
- `DATABASE_URL` must use port **6543** (Supabase transaction mode pooler), not 5432
- Check `SQLALCHEMY_ENGINE_OPTIONS` in `app.py` has `pool_size: 2, max_overflow: 2`
- Do not increase these values without a Supabase plan upgrade

**Login fails on Azure:**
```bash
az containerapp logs show --name brights-backend --resource-group brights-rg --tail 50
az containerapp logs show --name brights-frontend --resource-group brights-rg --tail 50
```

**Avatar uploads failing:**
- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in environment
- Confirm the `avatars` bucket exists in Supabase Storage and is set to **Public**

**Survey form not showing questions:**
- Confirm `survey_questions` table is seeded — check `/api/survey/next` in the browser network tab
- Should return `status: "due"` with a `questions` array for a user who hasn't submitted T1 yet

**Dashboard shows "No survey data available" for all goals:**
- Goal cards are populated from `survey_responses`. A user must have either submitted the T1 survey (in-app) or have historical data migrated into `survey_responses` for their `user_id`
- Demo accounts (demo1/demo2/demo3) have historical data already migrated and will show goal cards automatically
- New self-registered accounts will see an empty dashboard until they complete the T1 survey

**Graph endpoint returns 404:**
- The URL path segment must match a filename in `analysis/` exactly (e.g. `/api/visualizations/roseplot` → `analysis/roseplot.py`)

**Admin routes return 403:**
- Must be logged in as a user with `role = "admin"` in the database
- Use `admin` / `BrightsAdmin2026!` or `demo_admin` / `DemoAdmin2026!`

---

## Questions?

Ask Harrison or Derek.
