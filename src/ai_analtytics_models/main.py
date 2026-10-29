import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from ai_analtytics_models.database import engine
from ai_analtytics_models.routers.database_connection import (
    router as database_connections_router,
)
from ai_analtytics_models.routers.datasets import (
    router as datasets_router,
)
from ai_analtytics_models.routers.users import (
    router as users_router,
)
from ai_analtytics_models.routers.conversations import (
    router as conversations_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="AI Data Analyst Agent",
    version="0.1.0",
    lifespan=lifespan,
)


# Frontend origins allowed to communicate with this API.
# Keep the production Cloudflare URL exactly as deployed.
DEFAULT_FRONTEND_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://insightflow-ai-data-analyst.pages.dev",
}

# Allow additional origins through Render environment variables.
configured_origins = {
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
}

allowed_origins = sorted(
    DEFAULT_FRONTEND_ORIGINS | configured_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers.
app.include_router(users_router)
app.include_router(datasets_router)
app.include_router(database_connections_router)
app.include_router(conversations_router)


@app.get("/")
async def root():
    return {
        "message": "AI Data Analyst Agent API",
        "status": "running",
    }


@app.get("/health")
async def health():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "database": "connected",
    }