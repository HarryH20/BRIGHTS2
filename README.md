# BRIGHTS2

A Flask + React web application with PostgreSQL database.

## Prerequisites

- Docker Desktop installed and running
- Git installed
- GitHub account

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
   Then generate a secret key and add it to `.env`:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Start all services**
   ```bash
   docker compose up --build -d
   ```

4. **Access the app**

   **Open http://localhost:3000** (this is the main app)

   | Service | URL | Notes |
   |---------|-----|-------|
   | Frontend | http://localhost:3000 | **Use this one** |
   | Backend API | http://localhost:5000 | API only (frontend proxies here) |
   | Database | localhost:5432 | Internal use |

   > **Note:** Your IDE may show a link to port 5000 or a 172.x.x.x IP - ignore that. Always use **localhost:3000** for the full app.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│    Database     │
│  (React/Nginx)  │     │     (Flask)     │     │  (PostgreSQL)   │
│   Port: 3000    │     │   Port: 5000    │     │   Port: 5432    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up --build -d` | Build and start all containers |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f` | View logs from all services |
| `docker compose logs -f web` | View backend logs only |
| `docker compose ps` | Check container status |
| `docker compose down -v` | Stop and remove containers + data |

## Git Workflow

1. Checkout master and pull latest
   ```bash
   git checkout master
   git pull origin master
   ```

2. Create your feature branch
   ```bash
   git checkout -b your_name_feature
   ```

3. Make changes, commit, push
   ```bash
   git add .
   git commit -m "your message"
   git push origin your_name_feature
   ```

4. Create a Pull Request on GitHub

## Project Structure

```
BRIGHTS2/
├── backend/
│   ├── app.py          # Flask application entry point
│   ├── models.py       # Database models (User)
│   ├── routes/
│   │   └── auth.py     # Authentication endpoints
│   ├── Dockerfile      # Backend container config
│   └── requirements.txt# Python dependencies
├── frontend/
│   ├── src/            # React source code
│   ├── Dockerfile      # Frontend container config
│   └── nginx.conf      # Nginx proxy config
├── docker-compose.yml  # Multi-container orchestration
└── .env.example        # Environment template
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create new user |
| `/auth/login` | POST | Login and get session |
| `/auth/logout` | GET/POST | Clear session |
| `/auth/me` | GET | Get current user info |
| `/auth/change-password` | POST | Update password |

## Troubleshooting

**Containers won't start:**
```bash
docker compose down -v
docker compose up --build -d
```

**Database connection issues:**
- Check `.env` file has correct `DATABASE_URL`
- Ensure db container is healthy: `docker compose ps`

**Frontend not loading:**
- Check frontend container is running: `docker compose logs frontend`
- Verify nginx config if getting 502 errors

## Questions?

Ask Harrison or ChatGPT.
