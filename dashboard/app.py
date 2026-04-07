"""
Veracity AI — FastAPI Application Entry Point

Initializes the app, loads the ML model at startup, mounts static files,
and wires up all routes. Run with:

    cd dashboard
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import data_service
import database
import model_service
from config import EVALUATION_DIR, STATIC_DIR, TEMPLATES_DIR
from routes import router

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("veracity")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("═" * 50)
    logger.info("  VERACITY AI — Starting up...")
    logger.info("═" * 50)

    # 1. Load ML model
    try:
        model_service.load_model()
        logger.info("✓ Model loaded successfully")
    except Exception as exc:
        logger.error("✗ Model loading failed: %s", exc)
        logger.warning("  Prediction endpoints will return 503 errors")

    # 2. Initialize database
    await database.init_db()
    logger.info("✓ Database initialized")

    # 3. Load dataset DataFrames
    data_service.load_dataframes()
    logger.info("✓ Datasets loaded")

    logger.info("═" * 50)
    logger.info("  VERACITY AI — Ready at http://localhost:8000")
    logger.info("═" * 50)

    yield  # ── App is running ──

    logger.info("Veracity AI shutting down...")


# ── App Creation ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Veracity AI",
    description="Multimodal Fake News Detection Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS (allow all for local development) ────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Static Files ────────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount(
    "/evaluation-static",
    StaticFiles(directory=str(EVALUATION_DIR)),
    name="evaluation-static",
)

# ── Register API Routes ──────────────────────────────────────────────────────
app.include_router(router)

# ── Template Engine ───────────────────────────────────────────────────────────
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    """Serve the main SPA dashboard HTML."""
    return templates.TemplateResponse("index.html", {"request": request})
