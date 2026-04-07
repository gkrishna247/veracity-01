"""
Veracity AI — Database Service

Async SQLite CRUD for the prediction history table.
Uses aiosqlite for non-blocking database access within the FastAPI async runtime.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from config import DB_PATH, DEFAULT_PAGE_SIZE

logger = logging.getLogger(__name__)

# ── SQL Statements ────────────────────────────────────────────────────────────

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS prediction_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        TEXT    NOT NULL DEFAULT (datetime('now')),
    input_type       TEXT    NOT NULL,
    prediction_type  TEXT    NOT NULL,
    batch_id         INTEGER DEFAULT NULL,
    text_input       TEXT    DEFAULT NULL,
    image_filename   TEXT    DEFAULT NULL,
    lang             TEXT    NOT NULL,
    prediction       TEXT    NOT NULL,
    confidence       REAL    NOT NULL,
    probability_real REAL    NOT NULL,
    probability_fake REAL    NOT NULL
);
"""

_CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_timestamp ON prediction_history(timestamp DESC);",
    "CREATE INDEX IF NOT EXISTS idx_batch ON prediction_history(batch_id);",
]

_INSERT = """
INSERT INTO prediction_history
    (timestamp, input_type, prediction_type, batch_id, text_input, image_filename,
     lang, prediction, confidence, probability_real, probability_fake)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

_SELECT_HISTORY = """
SELECT id, timestamp, input_type, prediction_type, batch_id,
       text_input, image_filename, lang, prediction, confidence
FROM prediction_history
ORDER BY timestamp DESC
LIMIT ? OFFSET ?
"""

_COUNT_HISTORY = "SELECT COUNT(*) FROM prediction_history"

_DELETE_BY_ID = "DELETE FROM prediction_history WHERE id = ?"


# ═══════════════════════════════════════════════════════════════════════════════
#  Initialization
# ═══════════════════════════════════════════════════════════════════════════════

async def init_db() -> None:
    """Create the history table and indexes if they don't exist."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.execute(_CREATE_TABLE)
        for idx_sql in _CREATE_INDEXES:
            await db.execute(idx_sql)
        await db.commit()
    logger.info("Database initialized at %s", DB_PATH)


# ═══════════════════════════════════════════════════════════════════════════════
#  CRUD Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def insert_prediction(data: dict[str, Any]) -> int:
    """Insert a single prediction record.

    Args:
        data: Dict with keys matching column names.

    Returns:
        The auto-generated row ID.
    """
    now = datetime.now(timezone.utc).isoformat()
    params = (
        now,
        data["input_type"],
        data["prediction_type"],
        data.get("batch_id"),
        data.get("text_input"),
        data.get("image_filename"),
        data["lang"],
        data["prediction"],
        data["confidence"],
        data["probability_real"],
        data["probability_fake"],
    )
    async with aiosqlite.connect(str(DB_PATH)) as db:
        cursor = await db.execute(_INSERT, params)
        await db.commit()
        return cursor.lastrowid


async def get_history(
    page: int = 1,
    limit: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """Retrieve paginated prediction history, most recent first.

    Returns:
        Dict with 'total', 'page', 'limit', and 'items' list.
    """
    offset = (page - 1) * limit
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row

        # Total count
        cursor = await db.execute(_COUNT_HISTORY)
        row = await cursor.fetchone()
        total = row[0]

        # Paginated results
        cursor = await db.execute(_SELECT_HISTORY, (limit, offset))
        rows = await cursor.fetchall()

    items = [
        {
            "id": r["id"],
            "timestamp": r["timestamp"],
            "input_type": r["input_type"],
            "prediction_type": r["prediction_type"],
            "batch_id": r["batch_id"],
            "text_preview": (r["text_input"] or "")[:200],
            "image_filename": r["image_filename"],
            "prediction": r["prediction"],
            "confidence": r["confidence"],
            "lang": r["lang"],
        }
        for r in rows
    ]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items,
    }


async def delete_prediction(record_id: int) -> bool:
    """Delete a prediction history entry by ID.

    Returns:
        True if a row was deleted, False if not found.
    """
    async with aiosqlite.connect(str(DB_PATH)) as db:
        cursor = await db.execute(_DELETE_BY_ID, (record_id,))
        await db.commit()
        return cursor.rowcount > 0


async def get_next_batch_id() -> int:
    """Return the next available batch_id for grouping batch predictions."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        cursor = await db.execute(
            "SELECT COALESCE(MAX(batch_id), 0) + 1 FROM prediction_history"
        )
        row = await cursor.fetchone()
        return row[0]
