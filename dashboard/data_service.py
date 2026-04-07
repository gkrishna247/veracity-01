"""
Veracity AI — Data Service

Provides read-only access to datasets (CSV), evaluation results (JSON),
and pre-computed artifacts. DataFrames are cached in memory at startup
for fast pagination.
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any

import pandas as pd

from config import (
    DEFAULT_PAGE_SIZE,
    EVALUATION_DIR,
    GOSSIPCOP_CSV,
    MAX_PAGE_SIZE,
    TEXT_PREVIEW_LENGTH,
    WEIBO_CSV,
)

logger = logging.getLogger(__name__)

# ── Module-level DataFrame cache ──────────────────────────────────────────────
_gc_df: pd.DataFrame | None = None
_wb_df: pd.DataFrame | None = None


# ═══════════════════════════════════════════════════════════════════════════════
#  Initialization
# ═══════════════════════════════════════════════════════════════════════════════

def load_dataframes() -> None:
    """Load and cache dataset CSVs into memory."""
    global _gc_df, _wb_df

    _gc_df = pd.read_csv(GOSSIPCOP_CSV)
    logger.info("GossipCop loaded: %d rows", len(_gc_df))

    _wb_df = pd.read_csv(WEIBO_CSV)
    _wb_df["tweet_content"] = _wb_df["tweet_content"].fillna("")
    logger.info("Weibo loaded: %d rows", len(_wb_df))


# ═══════════════════════════════════════════════════════════════════════════════
#  Dataset Access
# ═══════════════════════════════════════════════════════════════════════════════

def _paginate(
    df: pd.DataFrame,
    page: int,
    limit: int,
    transform_fn,
) -> dict[str, Any]:
    """Generic pagination helper.

    Args:
        df:           Filtered DataFrame to paginate.
        page:         1-indexed page number.
        limit:        Items per page (capped at MAX_PAGE_SIZE).
        transform_fn: Callable that converts a row to a dict.

    Returns:
        Dict with 'total', 'page', 'limit', and 'items'.
    """
    limit = min(limit, MAX_PAGE_SIZE)
    total = len(df)
    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    items = [transform_fn(row) for _, row in page_df.iterrows()]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items,
    }


def get_gossipcop(
    page: int = 1,
    limit: int = DEFAULT_PAGE_SIZE,
    label: str = "all",
) -> dict[str, Any]:
    """Return paginated GossipCop data, optionally filtered by label."""
    df = _gc_df
    if label != "all":
        df = df[df["label"] == label]

    def transform(row):
        text = str(row.get("text", ""))
        return {
            "id": str(row["id"]),
            "title": str(row.get("title", "")),
            "text_preview": text[:TEXT_PREVIEW_LENGTH],
            "description": str(row.get("description", "")),
            "label": str(row["label"]),
        }

    return _paginate(df, page, limit, transform)


def get_weibo(
    page: int = 1,
    limit: int = DEFAULT_PAGE_SIZE,
    label: str = "all",
) -> dict[str, Any]:
    """Return paginated Weibo data, optionally filtered by label.

    Note: No image thumbnails are returned because the full image directory
    is NOT copied into the dashboard (per NFR-001).
    """
    df = _wb_df
    if label != "all":
        label_val = 0 if label == "real" else 1
        df = df[df["label"] == label_val]

    def transform(row):
        content = str(row.get("tweet_content", ""))
        return {
            "tweet_id": int(row["tweet_id"]) if pd.notna(row["tweet_id"]) else 0,
            "tweet_content_preview": content[:TEXT_PREVIEW_LENGTH],
            "label": int(row["label"]),
        }

    return _paginate(df, page, limit, transform)


def get_dataset_stats() -> dict[str, dict[str, int]]:
    """Return label distribution counts for both datasets."""
    gc_counts = _gc_df["label"].value_counts()
    wb_counts = _wb_df["label"].value_counts()

    return {
        "gossipcop": {
            "real": int(gc_counts.get("real", 0)),
            "fake": int(gc_counts.get("fake", 0)),
            "total": len(_gc_df),
        },
        "weibo": {
            "real": int(wb_counts.get(0, 0)),
            "fake": int(wb_counts.get(1, 0)),
            "total": len(_wb_df),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Evaluation & Training Artifacts
# ═══════════════════════════════════════════════════════════════════════════════

def _load_json(filename: str) -> Any:
    """Read a JSON file from the evaluation directory.

    Handles non-standard NaN/Infinity values that Python's json module
    rejects by default (training_log.json contains NaN from unstable epochs).
    """
    path = EVALUATION_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    # Python's json.loads handles NaN/Infinity with parse_constant
    def _parse_constant(c: str):
        if c == "NaN":
            return None  # Convert NaN → null for JSON-safe serialization
        if c == "Infinity":
            return None
        if c == "-Infinity":
            return None
        raise ValueError(c)

    return json.loads(text, parse_constant=_parse_constant)


def get_evaluation() -> Any:
    """Return the detailed evaluation results JSON."""
    return _load_json("evaluation_results_detailed.json")


def get_adversarial() -> Any:
    """Return the adversarial robustness results JSON."""
    return _load_json("adversarial_results.json")


def get_training_log() -> Any:
    """Return the training log JSON (epoch-level metrics)."""
    return _load_json("training_log.json")
