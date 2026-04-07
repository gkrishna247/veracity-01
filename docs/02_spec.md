# Veracity AI — Specification Document

> **Version**: 2.0  
> **Last Updated**: 2026-04-07  
> **Status**: Awaiting user approval  
> **Document Purpose**: Define HOW the system behaves. Specifies all API contracts, data schemas, and interface formats.  
> **Refs**: [01_requirements.md](./01_requirements.md)

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend framework | FastAPI | ≥0.100 |
| ASGI server | Uvicorn | ≥0.20 |
| Frontend | Vanilla HTML / CSS / JavaScript | N/A |
| Charts | Plotly.js (CDN) | latest |
| Database | SQLite via aiosqlite | ≥0.19 |
| ML inference | PyTorch | ≥2.0 |
| NLP models | HuggingFace Transformers | ≥4.30 |
| Image processing | Pillow, OpenCV (headless) | ≥9.0, ≥4.8 |
| Text explanation | LIME | ≥0.2 |
| Typography | Inter (Google Fonts CDN) | N/A |

---

## 2. API Specification

**Base URL**: `http://localhost:8000`  
**Content negotiation**: All JSON endpoints return `application/json`. Image/HTML endpoints return appropriate MIME types.

---

### 2.1 `GET /` — Serve Dashboard
Returns the SPA HTML shell (`templates/index.html`).

---

### 2.2 `POST /api/predict` — Single Prediction

**Content-Type**: `multipart/form-data`

**Request fields**:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `text` | string | Conditional | Max 10,000 chars | Input text. REQUIRED for `gossipcop_text`, `weibo_text`, `weibo_both`. |
| `image` | file | Conditional | Max 10 MB; JPEG/PNG/GIF | Uploaded image. REQUIRED for `weibo_image`, `weibo_both`. |
| `input_type` | string | Yes | Enum: `gossipcop_text`, `weibo_text`, `weibo_image`, `weibo_both` | Determines which modalities and language to use. |

**Derived fields** (NOT sent by client, computed by server):

| Field | Rule |
|---|---|
| `lang` | `en` if `input_type == gossipcop_text`, else `zh` |

**Success response** (200):
```json
{
  "prediction": "Fake",
  "confidence": 87.3,
  "probability_real": 0.127,
  "probability_fake": 0.873,
  "input_type": "weibo_both",
  "lang": "zh",
  "timestamp": "2026-04-07T09:15:00Z",
  "history_id": 42,
  "explanation": {
    "text": {
      "tokens": [
        {"token": "突发", "weight": 0.23},
        {"token": "独家", "weight": 0.18}
      ],
      "html": "<div>...LIME HTML snippet...</div>"
    },
    "image": {
      "heatmap_base64": "data:image/png;base64,iVBOR..."
    }
  }
}
```

**Explanation field rules**:
- `explanation.text` is present ONLY when `input_type` is `gossipcop_text`, `weibo_text`, or `weibo_both`.
- `explanation.image` is present ONLY when `input_type` is `weibo_image` or `weibo_both`.
- `explanation.text` is `null` for `weibo_image`.
- `explanation.image` is `null` for `gossipcop_text` and `weibo_text`.

---

### 2.3 `POST /api/predict/batch` — Batch Prediction

**Content-Type**: `multipart/form-data`

**Request fields**:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `file` | file | Yes | CSV, UTF-8, column `text` | CSV with single column `text`, one row per text |
| `lang` | string | Yes | Enum: `en`, `zh` | Language for all rows |

**Success response** (200):
```json
{
  "total_rows": 50,
  "results": [
    {
      "row": 1,
      "text_preview": "Breaking: Celebrity...",
      "prediction": "Fake",
      "confidence": 87.3,
      "probability_real": 0.127,
      "probability_fake": 0.873
    }
  ],
  "summary": {
    "total": 50,
    "real_count": 30,
    "fake_count": 20,
    "real_percentage": 60.0,
    "fake_percentage": 40.0,
    "threshold": 0.5,
    "avg_confidence": 78.5
  },
  "batch_id": 15
}
```

**Batch rules**:
- `input_type` is inferred: `gossipcop_text` if `lang == en`, `weibo_text` if `lang == zh`.
- No image support in batch mode (text-only).
- Each row is saved individually to prediction history with the same `batch_id`.

---

### 2.4 `GET /api/history` — Prediction History

**Query parameters**:

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number (1-indexed) |
| `limit` | int | 20 | Items per page (max 100) |

**Response** (200):
```json
{
  "total": 142,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": 142,
      "timestamp": "2026-04-07T09:15:00Z",
      "input_type": "weibo_both",
      "prediction_type": "single",
      "batch_id": null,
      "text_preview": "突发新闻...",
      "image_filename": "42_photo.jpg",
      "prediction": "Fake",
      "confidence": 87.3,
      "lang": "zh"
    }
  ]
}
```

Items are ALWAYS sorted by `timestamp DESC` (most recent first).

---

### 2.5 `DELETE /api/history/{id}` — Delete History Entry

**Response** (200): `{"success": true}`  
**Response** (404): `{"error": true, "message": "Entry not found", "code": "NOT_FOUND"}`

---

### 2.6 `GET /api/evaluation` — Evaluation Results

Returns contents of `evaluation/evaluation_results_detailed.json` as-is.

---

### 2.7 `GET /api/adversarial` — Adversarial Results

Returns contents of `evaluation/adversarial_results.json` as-is.

---

### 2.8 `GET /api/training-log` — Training Log

Returns contents of `evaluation/training_log.json` as-is.

---

### 2.9 `GET /api/dataset/gossipcop` — GossipCop Data

**Query parameters**:

| Param | Type | Default | Allowed |
|---|---|---|---|
| `page` | int | 1 | ≥1 |
| `limit` | int | 20 | 1–100 |
| `label` | string | `all` | `all`, `real`, `fake` |

**Response** (200):
```json
{
  "total": 12252,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "gossipcop-...",
      "title": "...",
      "text_preview": "First 200 characters...",
      "description": "...",
      "label": "real"
    }
  ]
}
```

---

### 2.10 `GET /api/dataset/weibo` — Weibo Data

Same query parameters as GossipCop.

**Response** (200):
```json
{
  "total": 13272,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "tweet_id": 123456,
      "tweet_content_preview": "First 200 characters...",
      "label": 1
    }
  ]
}
```

Note: No image thumbnails. Weibo images are NOT copied into the dashboard (per requirement NFR-001).

---

### 2.11 `GET /api/dataset/stats` — Dataset Statistics

**Response** (200):
```json
{
  "gossipcop": {"real": 8168, "fake": 4084, "total": 12252},
  "weibo": {"real": 0, "fake": 0, "total": 13272}
}
```

(Weibo label values: 0 = real, 1 = fake. Actual counts computed at runtime.)

---

### 2.12 `GET /api/lime/{sample_id}` — LIME Report

**Path parameter**: `sample_id` — integer 0–19.  
**Response**: Raw HTML content of `lime_reports/lime_sample_{sample_id}.html`.  
**Error** (404): If sample_id is out of range.

---

### 2.13 `GET /api/upload-image/{filename}` — Serve Uploaded Image

Serves images from `dashboard/uploads/` directory.  
Used by the history page to display images from past predictions.

---

## 3. Database Schema

### SQLite file: `dashboard/db/history.db`

**Table: `prediction_history`**

```sql
CREATE TABLE IF NOT EXISTS prediction_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        TEXT    NOT NULL DEFAULT (datetime('now')),
    input_type       TEXT    NOT NULL,    -- gossipcop_text | weibo_text | weibo_image | weibo_both
    prediction_type  TEXT    NOT NULL,    -- single | batch
    batch_id         INTEGER DEFAULT NULL,
    text_input       TEXT    DEFAULT NULL, -- stored truncated to 500 chars
    image_filename   TEXT    DEFAULT NULL, -- filename in uploads/ folder
    lang             TEXT    NOT NULL,    -- en | zh
    prediction       TEXT    NOT NULL,    -- Real | Fake
    confidence       REAL    NOT NULL,    -- 0.0 to 100.0
    probability_real REAL    NOT NULL,    -- 0.0 to 1.0
    probability_fake REAL    NOT NULL     -- 0.0 to 1.0
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON prediction_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_batch ON prediction_history(batch_id);
```

**Column constraints**:
- `input_type` MUST be one of: `gossipcop_text`, `weibo_text`, `weibo_image`, `weibo_both`
- `prediction_type` MUST be one of: `single`, `batch`
- `lang` MUST be one of: `en`, `zh`
- `prediction` MUST be one of: `Real`, `Fake`
- `confidence` MUST be between 0.0 and 100.0
- `probability_real` + `probability_fake` MUST approximately equal 1.0

---

## 4. Explanation Algorithms

### 4.1 Text Explanation — LIME
- Library: `lime.lime_text.LimeTextExplainer`
- Perturbation count: 100 (reduced from default 5000 for speed)
- Returns: top 10 tokens with float weights
- Positive weight = token pushes toward predicted class
- Negative weight = token pushes away from predicted class
- Also returns an HTML snippet for inline rendering

### 4.2 Image Explanation — Grad-CAM
- Target layer: ResNet-50 `layer4` (last convolutional block)
- Process:
  1. Forward pass with gradient tracking on target layer
  2. Backward pass from predicted class logit
  3. Global average pool gradients → channel weights
  4. Weighted combination of feature maps → heatmap
  5. Upsample heatmap to 224×224
  6. Overlay heatmap on original image using OpenCV `applyColorMap(COLORMAP_JET)`
  7. Encode overlaid image as base64 PNG
- Red = high activation (strong contribution), Blue = low activation

---

## 5. File Formats

### 5.1 Batch Upload CSV
```
text
"Article text row 1..."
"Article text row 2..."
```
- Column name MUST be `text` (case-sensitive)
- UTF-8 encoding
- Standard CSV quoting rules

### 5.2 Test Data — `gossipcop_text_only/sample.csv`
Columns: `id`, `text`, `title`, `description`, `label`  
20 rows. `label` values: `real` or `fake`.

### 5.3 Test Data — `weibo_text_only/sample.csv`
Columns: `tweet_id`, `tweet_content`, `label`  
20 rows. `label` values: `0` (real) or `1` (fake).

### 5.4 Test Data — `weibo_text_image/{real|fake}/data.csv`
Columns: `text`, `image_filename`  
`image_filename` is the basename of an image file in the SAME directory as the CSV.

---

## 6. Error Response Format

All error responses use this structure:
```json
{
  "error": true,
  "message": "Human-readable description",
  "code": "ERROR_CODE"
}
```

| Code | HTTP | Trigger |
|---|---|---|
| `MISSING_INPUT` | 400 | Neither text nor image provided for required modality |
| `INVALID_INPUT_TYPE` | 400 | `input_type` not in allowed enum |
| `INVALID_LANG` | 400 | `lang` not `en` or `zh` |
| `INVALID_CSV` | 400 | CSV missing `text` column or has 0 data rows |
| `IMAGE_TOO_LARGE` | 400 | Image exceeds 10 MB |
| `UNSUPPORTED_FORMAT` | 400 | Image not JPEG/PNG/GIF |
| `MODEL_NOT_LOADED` | 503 | Model failed to load at startup |
| `PREDICTION_FAILED` | 500 | Internal inference error |
| `NOT_FOUND` | 404 | History entry or LIME sample not found |
