# ⚡ Atlas V2 – AI-powered Warehouse Intelligence Operating System

Atlas is not a reporting application. Atlas is an AI-powered Warehouse Intelligence Operating System that can learn, collect, investigate, correlate, visualize and explain warehouse data automatically.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                         │
│  Next.js + React + TailwindCSS + Framer Motion          │
│  (Command Center, AI Chat, Automation Studio)           │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP / WebSockets
┌───────────────────▼─────────────────────────────────────┐
│              APPLICATION LAYER                          │
│  FastAPI Backend                                        │
│  Auth │ AI Engine │ Collector │ Normalizer │ Correlator │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
┌──────▼──────────────────┐  ┌────────────▼───────────────┐
│      PostgreSQL          │  │       Redis (Cache)         │
│  (Structured State)      │  │   (Sessions & Live Data)    │
└──────────────────────────┘  └─────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x or 22.x
- **Python** 3.10+
- **Docker** & Docker Compose (for PostgreSQL + Redis)
- **Playwright** browser dependencies

### Quick Start (Docker)

```bash
# 1. Clone and navigate
cd D:\antigravity\Atlas

# 2. Start PostgreSQL + Redis
docker compose up -d postgres redis

# 3. Install dependencies
pip install -r requirements.txt
cd ui-v2 && npm install && cd ..

# 4. Run Atlas V2
npm run dev:v2
```

This starts:
- **Next.js frontend** at `http://localhost:3000`
- **FastAPI backend** at `http://localhost:7411`
- **PostgreSQL** at `localhost:5432`
- **Redis** at `localhost:6379`

### Configuration

Copy `.env.v2.example` to `.env` and configure:

```bash
cp .env.v2.example .env
```

Key settings:
- `GEMINI_API_KEY` – Google Gemini API key (cloud AI)
- `CLAUDE_API_KEY` – Anthropic Claude API key (optional)
- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET_KEY` – Secret for JWT token signing

---

## 📁 Project Structure

```
D:\antigravity\Atlas\
├── backend/                      # FastAPI backend server
│   ├── api/                      # REST API routers
│   │   ├── auth_api.py           # JWT authentication
│   │   ├── ai_chat.py            # AI assistant
│   │   ├── runner.py             # Workflow execution
│   │   ├── workflows.py          # Workflow CRUD
│   │   └── ...
│   ├── auth/                     # Authentication utilities
│   ├── ai/                       # AI clients (Gemini, Claude, Ollama)
│   ├── automation/               # Playwright browser integration
│   ├── config/                   # Settings & configuration
│   ├── core/                     # Workflow engines
│   ├── extractors/               # HTML/Excel parsers
│   ├── reporting/                # Report generators
│   └── storage/                  # Database models & engine
├── ui-v2/                        # Next.js V2 frontend
│   └── src/
│       ├── app/                  # App Router pages
│       │   ├── page.tsx          # Command Center (home)
│       │   ├── chat/             # AI Assistant
│       │   ├── reports/          # Generated Reports
│       │   ├── investigations/   # Root Cause Analysis
│       │   ├── analytics/        # Warehouse KPIs
│       │   ├── automation/       # Automation Studio
│       │   ├── skills/           # Installed Skills
│       │   ├── marketplace/      # Skill Store
│       │   ├── search/           # Global Search
│       │   ├── logs/             # System Logs
│       │   └── settings/         # Configuration
│       └── components/           # Shared components
├── ui/                           # Legacy V1 Electron frontend
├── docker-compose.yml            # PostgreSQL + Redis + Backend
├── Dockerfile.backend            # Backend container
├── atlas.config.json             # Runtime configuration
├── workflows/                    # Saved workflow definitions
├── plugins/                      # Installed plugins
└── reports/                      # Generated outputs
```

---

## 🎨 Design System

Atlas V2 uses the **Milano Red** design system:

| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#A90E02` | Primary actions, brand identity |
| Background | `#0A0A0A` (dark) / `#FFFBD4` (light) | Base background |
| Text | `#F5F5F5` (dark) / `#111111` (light) | Primary text |
| Success | `#16A34A` | Positive states |
| Warning | `#D97706` | Caution states |
| Error | `#DC2626` | Error states |

---

## 🧠 AI Assistant

Users interact with Atlas using natural language:

```
> Download yesterday's reports
> Investigate location IQ1-2A17
> Generate Excel for Zone A cycle count
> Explain shortages this week
> Email today's report to the team
```

No command syntax. No code. Just plain human language.

---

## 🔒 Security & Privacy

- **JWT Authentication** with role-based access (admin, supervisor, operator, read-only)
- **AI Data Privacy Vault** — never sends raw warehouse data to external AI
- **Offline Mode** — route all AI through local Gemma/Ollama
- **Encrypted credentials** stored via system keyring
- **Audit logs** for all user actions

---

## 📋 Development Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Foundation (Architecture, Auth, UI Shell, DB) | ✅ Complete |
| 2 | Collector Engine (Playwright + Teach Mode) | ⬜ Planned |
| 3 | Normalization & Correlation | ⬜ Planned |
| 4 | Investigation Engine | ⬜ Planned |
| 5 | AI Engine & Assistant | ⬜ Planned |
| 6 | Automation Studio | ⬜ Planned |
| 7 | Analytics & Dashboards | ⬜ Planned |
| 8 | Marketplace & Skills | ⬜ Planned |
| 9 | Optimization & Enterprise Hardening | ⬜ Planned |
