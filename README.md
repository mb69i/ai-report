# Atlas V2 — Warehouse Intelligence OS

> **Atlas is not a reporting application.**
> Atlas is an AI-powered Warehouse Intelligence Operating System that learns, collects, investigates, correlates, visualises, and explains warehouse data automatically.

---

## What Atlas Does

| Capability | Description |
|---|---|
| **AI Chat** | Ask anything in plain language — Atlas understands, acts, and explains |
| **Auto-Collection** | Browser automation collects reports from any WMS without API access |
| **Investigation** | Atlas detects anomalies, runs root-cause analysis, and proposes fixes |
| **Analytics** | Live charts: picking accuracy trends, inventory variance by zone |
| **Automation Studio** | Visual workflow builder — no code required |
| **Universal Search** | Full-text across SKUs, locations, investigations, workflows in one box |
| **Skills & Marketplace** | Modular plugins for any ERP, WMS, or reporting system |

---

## Tech Stack

### Frontend
- **Next.js 16** + **React 19** + **TypeScript**
- **TailwindCSS v4** + custom dark design system
- **Framer Motion** — animations and transitions
- **Recharts** — live analytics charts
- **Lucide React** — icon set

### Backend
- **FastAPI** — async Python API server
- **SQLModel** — ORM (PostgreSQL in prod, SQLite in dev)
- **Playwright** — browser automation engine
- **Jose** — JWT auth
- **Loguru** — structured logging
- **Google Gemini / OpenAI / Ollama** — AI providers (hot-reloadable)

---

## Getting Started (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- A Gemini, OpenAI, or Ollama API key

### 1. Clone

```bash
git clone https://github.com/mb69i/ai-report
cd ai-report
```

### 2. Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — add at minimum: GEMINI_API_KEY and JWT_SECRET_KEY

# Seed database with demo data
python backend/storage/seeder.py

# Start backend
python backend/main.py
# → running on http://127.0.0.1:7411
# → docs at  http://127.0.0.1:7411/docs
```

### 3. Frontend

```bash
cd ui-v2
npm install
npm run dev
# → http://localhost:3000
```

### 4. First Login

Visit `http://localhost:3000` — you will be redirected to `/login`.

Register a new account, or use the demo credentials shown on the login page.

---

## Production Deployment (Docker)

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env — set: POSTGRES_PASSWORD, JWT_SECRET_KEY, GEMINI_API_KEY

# 2. Start all services
docker compose up -d

# 3. Seed the database (first run only)
docker compose exec backend python backend/storage/seeder.py

# Services:
#   PostgreSQL  → localhost:5432
#   Redis       → localhost:6379
#   Backend     → http://localhost:7411
#   Frontend    → http://localhost:3000
#   API Docs    → http://localhost:7411/docs
```

---

## Project Structure

```
Atlas/
├── backend/
│   ├── ai/              # Gemini / OpenAI / Ollama clients + orchestrator
│   ├── api/             # FastAPI routers (dashboard, search, auth, workflows…)
│   ├── auth/            # JWT utilities, password hashing
│   ├── automation/      # Playwright browser manager
│   ├── config/          # Settings (pydantic-settings)
│   ├── core/            # Workflow engine
│   ├── reporting/       # Excel / PDF report generators
│   ├── storage/         # SQLModel schemas, migrations, seeder
│   └── main.py          # FastAPI app entrypoint
├── ui-v2/
│   └── src/
│       ├── app/         # Next.js App Router pages
│       ├── components/  # AppShell, shared components
│       └── lib/         # api.ts (typed client), auth.tsx (context)
├── workflows/           # JSON workflow definitions
├── docker-compose.yml   # Production compose
├── Dockerfile.backend   # FastAPI image
└── ui-v2/Dockerfile.frontend  # Next.js image
```

---

## API Reference

The full interactive API docs are available at `http://localhost:7411/docs` when the backend is running.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET` | `/api/dashboard/summary` | Live dashboard stats |
| `GET` | `/api/dashboard/charts/accuracy-trend` | 30-day accuracy chart |
| `GET` | `/api/dashboard/charts/variance-by-zone` | Zone variance chart |
| `GET` | `/api/search?q=...` | Universal search |
| `GET` | `/api/workflows` | List automations |
| `POST` | `/api/runner/run` | Execute a workflow |
| `GET` | `/api/reports` | List reports |
| `POST` | `/api/ai/chat` | Chat with Atlas AI |
| `GET` | `/api/settings` | Get configuration |
| `PUT` | `/api/settings/keys` | Save API keys |
| `POST` | `/api/settings/test-connection` | Test AI provider |

---

## Design Principles

1. **Zero-code experience** — the user talks to Atlas, Atlas acts
2. **AI-first** — every feature is designed to be explainable in plain language
3. **Self-healing** — Playwright retries automatically, the fallback chain handles AI provider failures
4. **Offline capable** — SQLite fallback, Ollama for local AI
5. **Modular** — every feature is a router + a page; extending Atlas means adding one file

---

## License

MIT © Atlas V2
