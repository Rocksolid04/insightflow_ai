# InsightFlow — AI Data Analyst

InsightFlow is an AI-assisted analytics workspace for exploring CSV and Excel datasets and asking questions about PostgreSQL data in natural language. It combines Python-based analysis with a Groq-powered LangGraph agent so answers can be supported by data inspection, statistics, aggregations, time-series analysis, and chart data.

> **Project status:** Local development is supported. Public deployment is still being prepared. Uploaded files currently live on the backend filesystem; a cloud deployment needs persistent/object storage configured before it can safely host real users' files.

## Features

- **Authentication and workspace isolation** — users can register and sign in; datasets, saved PostgreSQL connections, and conversation histories are associated with the authenticated user.
- **Dataset management** — upload CSV or XLSX files up to 10 MB, preview rows, inspect column profiles, export data, and delete datasets.
- **AI Analyst** — ask questions about trends, distributions, missing data, outliers, relationships, or general dataset summaries in plain English.
- **Analytics tools** — use Pandas/NumPy-backed operations for summaries, aggregations, grouping, distributions, correlations, time-series summaries, anomaly detection, and chart specifications.
- **Full reports** — create structured, evidence-based reports with an executive summary, findings, trend analysis when supported, data-quality notes, recommendations, and limitations.
- **PostgreSQL connections** — save and test external PostgreSQL connections, inspect schemas, preview and profile tables, ask natural-language questions, run validated read-only SQL, and export query results.
- **Conversation history** — save, reopen, rename, and delete dataset/database analysis conversations.
- **Interactive visualizations** — display charts and tables in the React interface.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Axios, Recharts, Lucide React |
| Backend API | Python, FastAPI, Uvicorn, Pydantic Settings |
| Data analysis | Pandas, NumPy, OpenPyXL |
| AI and agent workflow | Groq API, LangChain, LangGraph |
| Application database | PostgreSQL 16, SQLAlchemy asyncio, asyncpg |
| Migrations | Alembic |
| Authentication and secrets | JWT bearer tokens, password hashing, Fernet encryption for saved database passwords |
| Tooling | `uv`, npm, Docker Compose, Git |

## Architecture

```text
Browser (React + Vite)
        │ HTTP / JSON + bearer token
        ▼
FastAPI application
  ├── User authentication
  ├── Dataset upload, preview, profiling, analysis, export, deletion
  ├── External PostgreSQL connection management and read-only queries
  ├── Saved analysis conversations
  └── Analytics and reporting services
        ├── Pandas / NumPy analysis tools
        └── LangGraph agent + Groq API
        │
        ▼
Application PostgreSQL database

External PostgreSQL databases can also be analysis sources.
```

## Requirements

- Python 3.13 or newer
- [uv](https://docs.astral.sh/uv/)
- Node.js and npm
- Docker Desktop or Docker Engine with Docker Compose
- A [Groq API key](https://console.groq.com/keys)
- Git

## Run locally

### 1. Clone the repository

```powershell
git clone https://github.com/Rocksolid04/insightflow_ai.git
cd insightflow_ai
```

Run backend commands from the repository root, containing `pyproject.toml`, `alembic.ini`, and `Docker-compose.yaml`.

### 2. Install backend dependencies

```powershell
uv sync --group dev
```

The committed `uv.lock` file records the Python dependency resolution.

### 3. Configure the backend environment

Create a `.env` file in the repository root.

```dotenv
DATABASE_URL=postgresql+asyncpg://analyst_user:replace_me@127.0.0.1:5433/data_analyst
POSTGRES_PASSWORD=replace_me

SECRET_KEY=replace_with_a_long_random_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30

GROQ_API_KEY=your_groq_api_key

DATABASE_ENCRYPTION_KEY=replace_with_a_fernet_key
```

Replace every placeholder. Use the same password in `POSTGRES_PASSWORD` and `DATABASE_URL`.

Generate an application secret:

```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Generate a Fernet encryption key:

```powershell
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Keep `DATABASE_ENCRYPTION_KEY` stable and backed up securely. It encrypts saved external database passwords; losing or changing it can make stored credentials unreadable.

**Never commit `.env` files, API keys, passwords, or encryption keys.**

### 4. Start PostgreSQL

The included `Docker-compose.yaml` defines PostgreSQL 16, exposed on host port `5433`.

```powershell
docker compose -f Docker-compose.yaml up -d db
```

Check the service:

```powershell
docker compose -f Docker-compose.yaml ps
```

If port `5433` is already in use, update the Compose port mapping and the host port in `DATABASE_URL` to match.

### 5. Apply database migrations

```powershell
uv run alembic upgrade head
```

### 6. Start FastAPI

Run from the repository root:

```powershell
uv run uvicorn ai_analtytics_models.main:app --reload
```

The API is available at `http://127.0.0.1:8000`.

- Interactive API documentation: `http://127.0.0.1:8000/docs`
- Health endpoint: `http://127.0.0.1:8000/health`

### 7. Configure and start the frontend

Open a second terminal:

```powershell
cd frontend
npm ci
```

Create `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start Vite:

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 8. Use the application

Register an account and sign in. Upload a CSV or XLSX file, inspect its preview and profile, and ask questions in the AI Analyst. You can also add an external PostgreSQL connection, test it, and explore its tables.

## Workspace pages

- **Overview** — workspace summary and recent datasets.
- **My datasets** — upload, preview, profile, export, and delete datasets.
- **Database connections** — manage external PostgreSQL sources, inspect schemas, preview/profile tables, run read-only queries, and export results.
- **AI Analyst** — ask natural-language questions and review answers, charts, and analysis steps.
- **Full reports** — generate structured reports for selected datasets.
- **Conversation history** — reopen, rename, and delete saved analysis conversations.

## API overview

The OpenAPI page at `/docs` lists the live routes and schemas.

| Route group | Purpose |
|---|---|
| `/users` | Registration, login, and current-user information |
| `/datasets` | Upload, list, preview, profile, analyze, report, export, and delete datasets |
| `/database-connections` | Manage PostgreSQL sources, inspect schemas, query, analyze, and export |
| `/conversations` | List, create, retrieve, rename, append messages to, and delete conversations |
| `/health` | Application database health check |

Most data endpoints require an authenticated bearer token. The SQL runner is intended for validated read-only queries. Only connect to databases you own or are authorized to access.

## Development checks

Compile backend Python modules from the project root:

```powershell
uv run python -m compileall src
```

Check the frontend:

```powershell
cd frontend
npm run lint
npm run build
```

The project includes live Groq smoke-test scripts. They require a working `GROQ_API_KEY`:

```powershell
cd ..
uv run python test_groq.py
uv run python test_tool_calling.py
```

Results can vary with API availability, credentials, and provider usage limits.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Async connection URL for the application PostgreSQL database |
| `POSTGRES_PASSWORD` | Password for local Docker Compose PostgreSQL |
| `SECRET_KEY` | Secret used for application authentication tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime; defaults to `30` |
| `GROQ_API_KEY` | API key for the Groq-powered agent |
| `DATABASE_ENCRYPTION_KEY` | Fernet key for saved external database passwords |
| `VITE_API_BASE_URL` | Frontend API base URL; defaults to `http://127.0.0.1:8000` |

For hosted environments, configure secrets in the hosting provider's settings rather than committing `.env` files.

## Deployment status and file persistence

The application is currently configured for local development. Before deploying publicly, update backend CORS settings to allow the deployed frontend origin and set `VITE_API_BASE_URL` to the public API URL.

**Important:** uploads are currently saved under `uploads/datasets` on the backend filesystem. Some free hosting services use ephemeral filesystems, so files may disappear after redeployment or restart. Before using such a host for public users, migrate uploads to persistent/object storage, such as a private Supabase Storage bucket, and update upload, preview, profile, analysis, export, and deletion flows to use that storage.

The local Docker PostgreSQL configuration must also be replaced by a hosted PostgreSQL database for a public deployment.

Other production considerations:

- Keep API keys, passwords, JWT secrets, and encryption keys out of Git.
- Preserve `DATABASE_ENCRYPTION_KEY` between deployments and store a secure backup.
- Restrict CORS to intended frontend origins.
- Add usage limits and rate controls before opening signup broadly.
- Secure external database connections and use least-privilege credentials.
- Back up application data and verify data retention and deletion behavior.

## Security and data handling

- Keep `.env` and `frontend/.env` local and out of Git.
- Review `git status` before each commit to ensure credentials and uploaded datasets aren't staged.
- Use strong, unique secrets outside development.
- Connect only to databases you are authorized to access.
- Treat uploaded datasets, query results, and conversations as potentially sensitive.
- Validate important AI-generated findings against the underlying data and analytical evidence.

## License

No license is currently included in the repository. Unless a license is added, do not assume reuse, modification, or redistribution is permitted under an open-source license.