# BRIGHTS2

A full-stack web application for visualising and tracking "beyond-the-self" goal progression data from a research study. Participants can view their goals, track progress across survey timepoints (T2–T6), and explore their data through interactive visualisations.

Built with Flask (backend), React/Vite (frontend), PostgreSQL via Supabase (database), running in Docker.

---

## Prerequisites

- Docker Desktop installed and running
- Git installed
- GitHub account

---

## Quick Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/HarryH20/BRIGHTS2.git
   cd BRIGHTS2
   ```

2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```
   Fill in the values — get `DATABASE_URL` from your team lead, generate a secret key:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```
   For profile picture uploads, also add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service role key from Supabase dashboard → Settings → API).

3. **Start all services**
   ```bash
   docker compose up --build -d
   ```

4. **Access the app**

   | Service | URL | Notes |
   |---------|-----|-------|
   | Frontend | http://localhost:3000 | **Use this one** |
   | Backend API | http://localhost:5000 | API only |

   > Your IDE may show a link to port 5000 — ignore it. Always use **localhost:3000**.

---

## Demo Accounts

Three demo accounts are pre-seeded, each linked to a real participant in the research dataset:

| Username | Password | Goals |
|----------|----------|-------|
| demo1 | BrightsDemo2026! | lose weight / make money / be available to children |
| demo2 | BrightsDemo2026! | get into masters / get interview / get hired |
| demo3 | BrightsDemo2026! | fix car / make extra money / read Bible |

---

## Features

- **Authentication** — register, login, logout, change password, account lockout after 5 failed attempts
- **Profile picture** — upload via Supabase Storage, displayed across the app
- **Dashboard** — per-goal cards with real goal names and latest survey scores, live timepoint list
- **Goal pages** — T2–T6 score breakdown (progress, confidence, importance) per goal
- **Survey results** — all goals' scores for a selected timepoint
- **Survey analysis** — score changes vs Week 2 baseline, with directional arrows
- **Rose plot** — Plotly polar chart of goal progression across all timepoints
- **Audit logging** — all auth events written to database with IP and request ID

---

## Database Options

| Option | Use Case | Data Persistence |
|--------|----------|------------------|
| **Supabase** (default) | Team development | Shared across all devs |
| Local Docker | Offline work | Per-machine only |

To switch, edit `.env` and comment/uncomment the appropriate `DATABASE_URL`.

### New team member setup
1. Get `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` from your team lead
2. Add them to your `.env`
3. Tables already exist — no migration needed

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│    Frontend     │────▶│     Backend     │────▶│  PostgreSQL/Supabase │
│  (React/Nginx)  │     │     (Flask)     │     │  + Supabase Storage  │
│   Port: 3000    │     │   Port: 5000    │     │                      │
└─────────────────┘     └─────────────────┘     └──────────────────────┘
```

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
│   ├── Dockerfile
│   └── nginx.conf
├── docs/
│   ├── CLAUDE.md                     # Project standards for AI-assisted development
│   ├── sprint3.md                    # Sprint 3 deliverables
│   ├── SECURITY_ROADMAP.md
│   └── TASKS.md
├── anaylsis/                         # Data science work
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
| `docker compose ps` | Check container status |

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
3. Commit and push
   ```bash
   git add <files>
   git commit -m "your message"
   git push origin your_name_feature
   ```
4. Open a Pull Request on GitHub targeting `master`

---

## Troubleshooting

**Containers won't start:**
```bash
docker compose down -v && docker compose up --build -d
```

**Database connection issues:**
- Check `.env` has correct `DATABASE_URL`
- Run `docker compose ps` to verify containers are healthy

**Frontend not loading / 502 errors:**
- Check `docker compose logs frontend`
- Verify nginx config

**Avatar uploads failing:**
- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in `.env`
- Confirm the `avatars` bucket exists in Supabase Storage and is set to **Public**

---

## Questions?

Ask Harrison or Derek.
