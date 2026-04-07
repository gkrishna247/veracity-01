"""
Veracity AI — API Routes

All REST endpoint handlers organized by feature area.
Each handler performs input validation, delegates to the appropriate service,
and returns a structured JSON response.
"""

from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from PIL import Image

import data_service
import database
import model_service
from config import (
    ALLOWED_IMAGE_EXTENSIONS,
    CLASSIFICATION_THRESHOLD,
    HISTORY_TEXT_STORE_LENGTH,
    INPUT_TYPE_CONFIG,
    LIME_DIR,
    MAX_BATCH_ROWS,
    MAX_IMAGE_SIZE_BYTES,
    MAX_TEXT_LENGTH,
    UPLOADS_DIR,
    VALID_INPUT_TYPES,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _error(status: int, message: str, code: str) -> JSONResponse:
    """Build a standardized error response."""
    return JSONResponse(
        status_code=status,
        content={"error": True, "message": message, "code": code},
    )


async def _read_image(file: UploadFile) -> Image.Image:
    """Validate and read an uploaded image file into a PIL Image."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Unsupported image format: {ext}")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(400, f"Image exceeds {MAX_IMAGE_SIZE_BYTES // (1024*1024)} MB limit")

    return Image.open(io.BytesIO(contents))


async def _save_uploaded_image(file_bytes: bytes, history_id: int, filename: str) -> str:
    """Save uploaded image to the uploads directory. Returns the stored filename."""
    ext = Path(filename).suffix.lower() or ".jpg"
    stored_name = f"{history_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOADS_DIR / stored_name
    path.write_bytes(file_bytes)
    return stored_name


# ═══════════════════════════════════════════════════════════════════════════════
#  Prediction Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/predict")
async def predict_single(
    input_type: Annotated[str, Form()],
    text: Annotated[str | None, Form()] = None,
    image: UploadFile | None = File(None),
):
    """Single prediction endpoint supporting all 4 input types."""
    # ── Validate input_type ───────────────────────────────────────────────
    if input_type not in VALID_INPUT_TYPES:
        return _error(400, f"Invalid input_type: {input_type}", "INVALID_INPUT_TYPE")

    if not model_service.is_model_loaded():
        return _error(503, "Model not loaded", "MODEL_NOT_LOADED")

    config = INPUT_TYPE_CONFIG[input_type]

    # ── Validate required fields ──────────────────────────────────────────
    if config["requires_text"] and (not text or not text.strip()):
        return _error(400, "Text is required for this input type", "MISSING_INPUT")

    if config["requires_image"] and (image is None or image.filename == ""):
        return _error(400, "Image is required for this input type", "MISSING_INPUT")

    if text and len(text) > MAX_TEXT_LENGTH:
        return _error(400, f"Text exceeds {MAX_TEXT_LENGTH} character limit", "MISSING_INPUT")

    # ── Process inputs ────────────────────────────────────────────────────
    pil_image = None
    image_bytes = None
    if image and image.filename:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes))

    # ── Run prediction ────────────────────────────────────────────────────
    try:
        result = model_service.predict(
            text=text.strip() if text else None,
            image=pil_image,
            input_type=input_type,
        )
    except Exception as exc:
        logger.exception("Prediction failed")
        return _error(500, str(exc), "PREDICTION_FAILED")

    # ── Save to history ───────────────────────────────────────────────────
    history_data = {
        "input_type": input_type,
        "prediction_type": "single",
        "text_input": (text or "")[:HISTORY_TEXT_STORE_LENGTH],
        "lang": config["lang"],
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "probability_real": result["probability_real"],
        "probability_fake": result["probability_fake"],
    }
    history_id = await database.insert_prediction(history_data)

    # Save uploaded image if present
    if image_bytes and image and image.filename:
        stored_name = await _save_uploaded_image(image_bytes, history_id, image.filename)
        history_data["image_filename"] = stored_name

    result["history_id"] = history_id
    result["timestamp"] = history_data.get("timestamp", "")

    return JSONResponse(content=result)


@router.post("/api/predict/batch")
async def predict_batch(
    lang: Annotated[str, Form()],
    file: UploadFile = File(...),
):
    """Batch prediction endpoint. Accepts CSV with 'text' column."""
    if lang not in ("en", "zh"):
        return _error(400, "Language must be 'en' or 'zh'", "INVALID_LANG")

    if not model_service.is_model_loaded():
        return _error(503, "Model not loaded", "MODEL_NOT_LOADED")

    # ── Parse CSV ─────────────────────────────────────────────────────────
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception:
        return _error(400, "Could not parse CSV file", "INVALID_CSV")

    if "text" not in df.columns:
        return _error(400, "CSV must have a 'text' column", "INVALID_CSV")

    df = df.dropna(subset=["text"])
    if len(df) == 0:
        return _error(400, "CSV has no valid text rows", "INVALID_CSV")

    if len(df) > MAX_BATCH_ROWS:
        return _error(400, f"CSV exceeds max {MAX_BATCH_ROWS} rows", "INVALID_CSV")

    # ── Run predictions ───────────────────────────────────────────────────
    batch_id = await database.get_next_batch_id()
    results = []
    real_count = 0
    fake_count = 0
    total_conf = 0.0

    for idx, row in df.iterrows():
        text_val = str(row["text"]).strip()
        if not text_val:
            continue

        try:
            pred = model_service.predict_text_only(text_val, lang)
        except Exception:
            pred = {
                "prediction": "Error",
                "confidence": 0.0,
                "probability_real": 0.0,
                "probability_fake": 0.0,
            }

        row_result = {
            "row": len(results) + 1,
            "text_preview": text_val[:200],
            "prediction": pred["prediction"],
            "confidence": pred["confidence"],
            "probability_real": pred["probability_real"],
            "probability_fake": pred["probability_fake"],
        }
        results.append(row_result)

        if pred["prediction"] == "Real":
            real_count += 1
        elif pred["prediction"] == "Fake":
            fake_count += 1
        total_conf += pred["confidence"]

        # Save each row to history
        input_type = "gossipcop_text" if lang == "en" else "weibo_text"
        await database.insert_prediction({
            "input_type": input_type,
            "prediction_type": "batch",
            "batch_id": batch_id,
            "text_input": text_val[:HISTORY_TEXT_STORE_LENGTH],
            "lang": lang,
            "prediction": pred["prediction"],
            "confidence": pred["confidence"],
            "probability_real": pred["probability_real"],
            "probability_fake": pred["probability_fake"],
        })

    total = len(results)
    summary = {
        "total": total,
        "real_count": real_count,
        "fake_count": fake_count,
        "real_percentage": round((real_count / total) * 100, 1) if total else 0,
        "fake_percentage": round((fake_count / total) * 100, 1) if total else 0,
        "threshold": CLASSIFICATION_THRESHOLD,
        "avg_confidence": round(total_conf / total, 2) if total else 0,
    }

    return JSONResponse(content={
        "total_rows": total,
        "results": results,
        "summary": summary,
        "batch_id": batch_id,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  History Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/history")
async def get_history(page: int = 1, limit: int = 20):
    """Return paginated prediction history (most recent first)."""
    page = max(1, page)
    limit = max(1, min(limit, 100))
    data = await database.get_history(page=page, limit=limit)
    return JSONResponse(content=data)


@router.delete("/api/history/{record_id}")
async def delete_history(record_id: int):
    """Delete a single prediction history entry."""
    deleted = await database.delete_prediction(record_id)
    if not deleted:
        return _error(404, "Entry not found", "NOT_FOUND")
    return JSONResponse(content={"success": True})


# ═══════════════════════════════════════════════════════════════════════════════
#  Evaluation & Training Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/evaluation")
async def get_evaluation():
    """Return detailed evaluation metrics."""
    return JSONResponse(content=data_service.get_evaluation())


@router.get("/api/adversarial")
async def get_adversarial():
    """Return adversarial robustness results."""
    return JSONResponse(content=data_service.get_adversarial())


@router.get("/api/training-log")
async def get_training_log():
    """Return training log (epoch-level metrics)."""
    return JSONResponse(content=data_service.get_training_log())


# ═══════════════════════════════════════════════════════════════════════════════
#  Dataset Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/dataset/gossipcop")
async def get_gossipcop(page: int = 1, limit: int = 20, label: str = "all"):
    """Return paginated GossipCop data."""
    return JSONResponse(content=data_service.get_gossipcop(page, limit, label))


@router.get("/api/dataset/weibo")
async def get_weibo(page: int = 1, limit: int = 20, label: str = "all"):
    """Return paginated Weibo data (text only, no image thumbnails)."""
    return JSONResponse(content=data_service.get_weibo(page, limit, label))


@router.get("/api/dataset/stats")
async def get_dataset_stats():
    """Return label distribution counts for both datasets."""
    return JSONResponse(content=data_service.get_dataset_stats())


# ═══════════════════════════════════════════════════════════════════════════════
#  Explainability Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/lime/{sample_id}")
async def get_lime_report(sample_id: int):
    """Serve a pre-generated LIME HTML report."""
    if not (0 <= sample_id <= 19):
        return _error(404, f"LIME sample {sample_id} not found", "NOT_FOUND")

    filepath = LIME_DIR / f"lime_sample_{sample_id}.html"
    if not filepath.exists():
        return _error(404, f"LIME file not found: {filepath.name}", "NOT_FOUND")

    html = filepath.read_text(encoding="utf-8")
    return HTMLResponse(content=html)


# ═══════════════════════════════════════════════════════════════════════════════
#  Uploaded Image Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/upload-image/{filename}")
async def get_uploaded_image(filename: str):
    """Serve an image from the uploads directory (past predictions)."""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        return _error(404, "Image not found", "NOT_FOUND")
    return FileResponse(filepath)
