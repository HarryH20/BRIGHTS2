# BRIGHTS2

A full-stack web application for visualising and tracking "beyond-the-self" goal progression data from a research study. Participants can view their goals, track progress across survey timepoints (T2–T6), and explore their data through interactive visualisations.

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
- **Profile picture** — upload via Supabase Storage, displayed across the app
- **Dashboard** — per-goal cards with real goal names and latest survey scores
- **Goal pages** — T2–T6 score breakdown (progress, confidence, importance) per goal
- **Survey results** — all goals' scores for a selected timepoint
- **Survey analysis** — score changes vs Week 2 baseline with directional arrows
- **Rose plot** — Plotly polar chart of goal progression across all timepoints
- **Audit logging** — all auth events written to database with IP and request ID

---

## Architecture

```
┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  brights-frontend    │────▶│  brights-backend     │────▶│  PostgreSQL/Supabase │
│  React/Nginx         │     │  Flask/Gunicorn      │     │  + Supabase Storage  │
│  ACA external        │     │  ACA internal        │     │                      │
└──────────────────────┘     └─────────────────────┘     └──────────────────────┘
```

nginx proxies `/auth/*` and `/api/*` to the backend via ACA's internal network. The browser only ever talks to the frontend — the backend has no public URL.

---

## Project Structure

```
BRIGHTS2/
├── backend/
│   ├── app.py                        # Flask entry point, middleware, error handlers
│   ├── models.py                     # SQLAlchemy models (User, AuditLog, SessionLog)
│   ├── logging_config.py             # Centralised logging setup
│   ├── routes/
│   │   ├── auth.py                   # Auth endpoints (/auth/*)
│   │   └── visualizations.py        # Visualisation endpoints (/api/visualizations/*)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Router + auth state
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── home/
│   │   │   ├── Dashboard.jsx         # Main dashboard with goal cards
│   │   │   ├── GoalPage.jsx          # Per-goal T2–T6 score table
│   │   │   ├── OverviewPage.jsx      # Rose plot full view
│   │   │   ├── SurveyResults.jsx     # All goals' scores for a timepoint
│   │   │   ├── SurveyAnalysis.jsx    # Score changes vs baseline
│   │   │   ├── Profile.jsx           # Account settings, password, avatar
│   │   │   └── HomeLayout.jsx        # Shared nav/layout wrapper
│   │   └── graphs/
│   │       └── RosePlot.jsx          # Plotly rose plot component
│   ├── nginx.conf
│   └── Dockerfile
├── analysis/                         # Data science work
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints

### Auth (`/auth/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create new user |
| `/auth/login` | POST | Login and create session |
| `/auth/logout` | GET/POST | Clear session |
| `/auth/me` | GET | Current user info (includes `avatar_url`, `participant_id`) |
| `/auth/change-password` | POST | Update password |
| `/auth/avatar` | POST | Upload profile picture to Supabase Storage |

### Visualisations (`/api/visualizations/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/visualizations/goals` | GET | Goal text + T2–T6 scores for current user |
| `/api/visualizations/roseplot` | GET | Plotly rose plot figure for current user |

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

The app is deployed on **Azure Container Apps** with images in **Azure Container Registry**. The database stays on Supabase.

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

> Always use versioned tags (`:vN` or commit SHA) — `:latest` won't trigger a new revision if the digest hasn't changed.

### New Team Member Setup

1. Get `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` from your team lead
2. Add to `.env`
3. `docker compose up --build -d`
4. Tables already exist — no migration needed

---

## Troubleshooting

**Containers won't start:**
```bash
docker compose down -v && docker compose up --build -d
```

**Login fails on Azure:**
```bash
az containerapp logs show --name brights-backend --resource-group brights-rg --tail 50
az containerapp logs show --name brights-frontend --resource-group brights-rg --tail 50
```

**Avatar uploads failing:**
- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
- Confirm the `avatars` bucket exists in Supabase Storage and is set to **Public**

---

## Questions?

Ask Harrison or Derek.
