# BRIGHTS2

A full-stack web application for visualising and tracking "beyond-the-self" goal progression data from a research study. Participants complete weekly surveys, view their goals, track progress across timepoints (T1–T6), and explore their data through interactive visualisations.

Built with Flask (backend), React/Vite (frontend), PostgreSQL via Supabase (database), running in Docker. Deployed on Azure Container Apps.

---

## Live App

**https://brights-frontend.purplesmoke-6b0cc5a0.southcentralus.azurecontainerapps.io**

---

## Quick Start (Local)

1. **Clone the repo**
   ```bash
   git clone https://github.com/HarryH20/BRIGHTS2.git
   cd BRIGHTS2
   ```

2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```
   Fill in the values — get `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` from your team lead. Generate a secret key:
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

---

## Demo Accounts

| Username | Password | Goals |
|----------|----------|-------|
| demo1 | BrightsDemo2026! | lose weight / make money / be available to children |
| demo2 | BrightsDemo2026! | get into masters / get interview / get hired |
| demo3 | BrightsDemo2026! | fix car / make extra money / read Bible |

---

## Features

- **Authentication** — register, login, logout, change password, account lockout after 5 failed attempts
- **Display name** — set a display name shown on the dashboard instead of username
- **Profile picture** — upload via Supabase Storage
- **Weekly survey form** — T1–T6 survey forms served in sequence, one per week, auto-unlocking 7 days after each submission
- **Dashboard** — per-goal cards with real goal names, latest scores, and survey prompt when a form is due
- **Goal pages** — T2–T6 score breakdown (progress, confidence, importance) per goal
- **Survey results & analysis** — scores per timepoint and change vs baseline
- **Rose plot / Radar plot** — Plotly interactive charts from real participant data
- **Audit logging** — all auth events written to database with IP and request ID

---

## Survey System

The app replaces Qualtrics with a built-in survey form. Participants complete 6 weekly surveys (T1–T6).

### Flow

1. On first login the dashboard shows a **"Week 1 survey is ready"** prompt
2. Participant clicks through to `/survey` and fills out the form (goal texts at T1, then Q1–Q22 Likert items per goal)
3. On submit the next survey unlocks **7 days later** automatically
4. T2–T6 forms show Q1–Q43 per goal
5. After all 6 are complete the form shows a completion screen

### Question bank

Questions live in the `survey_questions` table. Each question has:
- `form_type` — `t1`, `t2`, `t3t5`, or `t6`
- `status` — `active` or `inactive` (never deleted, kept for history)
- `scale_type` — `likert7`, `goal_text`

Admins can add, remove, and replace questions via the admin API without touching code.

### Development testing — bypassing the 7-day lock

When `FLASK_ENV=development`, two dev-only endpoints are available. Call from browser console while logged in:

**Unlock next survey immediately** (after submitting one, run this to skip the 7-day wait):
```js
fetch('/api/survey/dev/unlock-all', { method: 'POST', credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

**Reset all survey data for your account** (start from T1 again):
```js
fetch('/api/survey/dev/reset', { method: 'POST', credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

Both endpoints return 403 in production.

---

## Architecture

```
┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  brights-frontend    │────▶│  brights-backend     │────▶│  PostgreSQL/Supabase │
│  React/Nginx         │     │  Flask/Gunicorn      │     │  + Supabase Storage  │
│  ACA external        │     │  ACA internal        │     │                      │
└──────────────────────┘     └─────────────────────┘     └──────────────────────┘
```

nginx proxies `/auth/*` and `/api/*` to the backend. The browser only ever talks to the frontend — the backend has no public URL.

---

## Project Structure

```
BRIGHTS2/
├── backend/
│   ├── app.py                        # Flask entry point, middleware, error handlers
│   ├── models.py                     # SQLAlchemy models (User, AuditLog, SessionLog,
│   │                                 #   SurveyQuestion, SurveySubmission, SurveyResponse)
│   ├── logging_config.py             # Centralised logging setup
│   ├── routes/
│   │   ├── auth.py                   # /auth/* endpoints
│   │   ├── visualizations.py         # /api/visualizations/* endpoints
│   │   ├── survey.py                 # /api/survey/* and /api/admin/survey/* endpoints
│   │   ├── admin.py                  # /api/admin/* endpoints
│   │   └── logs.py                   # /api/logs/* endpoints
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Router + auth state
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── home/
│   │   │   ├── Dashboard.jsx         # Main dashboard with goal cards + survey prompt
│   │   │   ├── SurveyForm.jsx        # Weekly survey form (T1–T6)
│   │   │   ├── GoalPage.jsx          # Per-goal T2–T6 score table
│   │   │   ├── GraphsPage.jsx        # Graphs page (placeholder)
│   │   │   ├── OverviewPage.jsx      # Rose plot full view
│   │   │   ├── SurveyResults.jsx     # All goals' scores for a timepoint
│   │   │   ├── SurveyAnalysis.jsx    # Score changes vs baseline
│   │   │   ├── Profile.jsx           # Account settings, password, avatar, display name
│   │   │   └── HomeLayout.jsx        # Shared nav/layout wrapper
│   │   └── graphs/
│   │       ├── RosePlot.jsx          # Plotly rose plot component
│   │       └── RadarPlot.jsx         # Plotly radar plot component
│   ├── nginx.conf
│   └── Dockerfile
├── analysis/                         # Python data science modules
│   ├── radarplot.py                  # Radar chart generator
│   └── roseplot.py                   # Rose plot generator
├── docker-compose.yml
└── .env.example
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts — username, email, password hash, role, participant_id, display_name, avatar_url |
| `audit_log` | Immutable auth event log — login, logout, register, password change, lockout |
| `session_log` | Login/logout pairs with session duration |
| `GoalIntervention` | Historical research data imported from CSV (910 participants, T1–T6) |
| `survey_questions` | Admin-editable question bank — seeded with Q1–Q43 per form type |
| `survey_submissions` | Tracks which timepoints each user has completed and when the next unlocks |
| `survey_responses` | Normalized per-question responses from form submissions |

---

## API Endpoints

### Auth (`/auth/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create new user |
| `/auth/login` | POST | Login and create session |
| `/auth/logout` | GET/POST | Clear session |
| `/auth/me` | GET | Current user info |
| `/auth/change-password` | POST | Update password |
| `/auth/avatar` | POST | Upload profile picture to Supabase Storage |
| `/auth/display-name` | POST | Set or update display name |

### Survey (`/api/survey/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/survey/next` | GET | Current due survey + questions for logged-in user |
| `/api/survey/submit` | POST | Submit responses, record completion, set next unlock |
| `/api/survey/dev/unlock-all` | POST | **Dev only** — immediately unlock next survey |
| `/api/survey/dev/reset` | POST | **Dev only** — delete all survey data for current user |

### Admin — Survey Questions (`/api/admin/survey/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/survey/questions?form_type=` | GET | Active questions for a form type |
| `/api/admin/survey/questions/history?form_type=` | GET | All questions including inactive |
| `/api/admin/survey/questions` | POST | Add new question |
| `/api/admin/survey/questions/<id>` | PUT | Edit question wording in-place |
| `/api/admin/survey/questions/<id>/deactivate` | POST | Soft-remove (kept in history) |
| `/api/admin/survey/questions/<id>/replace` | POST | Swap with a historical or new question |

### Visualisations (`/api/visualizations/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/visualizations/goals` | GET | Goal text + T2–T6 scores for current user |
| `/api/visualizations/roseplot` | GET | Rose plot figure |
| `/api/visualizations/radarplot` | GET | Radar plot figure (`?goal_index=N`) |

---

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up --build -d` | Build and start all containers |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f web` | Backend logs |
| `docker compose logs -f frontend` | Frontend logs |

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
4. Merge `master` → `prod` to trigger auto-deploy to Azure

---

## Azure Deployment

The app is deployed on **Azure Container Apps** with images in **Azure Container Registry**.

### Resources

| Resource | Name |
|----------|------|
| Resource group | `brights-rg` |
| Container registry | `brightsregistry.azurecr.io` |
| ACA environment | `brights-env` (southcentralus) |
| Frontend app | `brights-frontend` (external ingress) |
| Backend app | `brights-backend` (internal ingress) |

### CI/CD — Auto-Deploy on Push to `prod`

Every push to `prod` automatically:
1. Builds and verifies frontend + backend
2. Builds both Docker images tagged with the commit SHA
3. Pushes to Azure Container Registry
4. Rolls out new images to both Container Apps (zero downtime)

Uses OIDC (Workload Identity Federation) — no stored Azure credentials.

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

> Always use versioned tags — `:latest` won't trigger a new revision if the digest hasn't changed.

---

## Troubleshooting

**Containers won't start:**
```bash
docker compose down -v && docker compose up --build -d
```

**Backend connection pool exhausted (MaxClientsInSessionMode):**
- The `DATABASE_URL` must use port **6543** (transaction mode), not 5432
- Check `SQLALCHEMY_ENGINE_OPTIONS` has `pool_size: 2, max_overflow: 2`

**Login fails on Azure:**
```bash
az containerapp logs show --name brights-backend --resource-group brights-rg --tail 50
az containerapp logs show --name brights-frontend --resource-group brights-rg --tail 50
```

**Avatar uploads failing:**
- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
- Confirm the `avatars` bucket exists in Supabase Storage and is set to **Public**

**Survey form not showing questions:**
- Confirm `survey_questions` table is seeded — should have 151 rows (22 for t1, 43 each for t2/t3t5/t6)
- Check `/api/survey/next` response in the browser network tab

---

## Questions?

Ask Harrison or Derek.
