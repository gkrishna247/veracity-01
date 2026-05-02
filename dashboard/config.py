"""
Veracity AI — Configuration Module

Centralizes all filesystem paths and application constants.
All paths are resolved relative to this file's directory (dashboard/).
"""

from pathlib import Path

# ── Base Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent

MODEL_DIR = BASE_DIR / "model"
MODEL_PATH = MODEL_DIR / "best_model.pt"

DATA_DIR = BASE_DIR / "data"
DATASETS_DIR = DATA_DIR / "datasets"
GOSSIPCOP_CSV = DATASETS_DIR / "gossipcop_final.csv"
WEIBO_CSV = DATASETS_DIR / "weibo_final.csv"

EVALUATION_DIR = BASE_DIR / "evaluation"
LIME_DIR = BASE_DIR / "lime_reports"
UPLOADS_DIR = BASE_DIR / "uploads"
TEST_DATA_DIR = BASE_DIR / "test_data"

DB_DIR = BASE_DIR / "db"
DB_PATH = DB_DIR / "history.db"

STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# ── Model Configuration ──────────────────────────────────────────────────────
MAX_SEQ_LENGTH = 128
IMAGE_SIZE = 224
KG_DIM = 300  # Knowledge graph embedding dimension (zero-vector)

# ── Image Preprocessing (ImageNet normalization) ─────────────────────────────
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# ── Prediction Constants ─────────────────────────────────────────────────────
CLASSIFICATION_THRESHOLD = 0.5
LABEL_MAP = {0: "Real", 1: "Fake"}
LABEL_MAP_REVERSE = {"Real": 0, "Fake": 1}

# ── Input Type Definitions ───────────────────────────────────────────────────
VALID_INPUT_TYPES = frozenset({
    "gossipcop_text",
    "weibo_text",
    "weibo_image",
    "weibo_both",
})

INPUT_TYPE_CONFIG = {
    "gossipcop_text": {"requires_text": True, "requires_image": False, "lang": "en"},
    "weibo_text":     {"requires_text": True, "requires_image": False, "lang": "zh"},
    "weibo_image":    {"requires_text": False, "requires_image": True, "lang": "zh"},
    "weibo_both":     {"requires_text": True, "requires_image": True, "lang": "zh"},
}

# ── LIME Explanation Settings ────────────────────────────────────────────────
LIME_NUM_FEATURES = 10
LIME_NUM_SAMPLES = 100  # Reduced from 5000 for speed

# ── API / Upload Limits ──────────────────────────────────────────────────────
MAX_TEXT_LENGTH = 10_000
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif"})
MAX_BATCH_ROWS = 500

# ── Pagination Defaults ──────────────────────────────────────────────────────
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
TEXT_PREVIEW_LENGTH = 200
HISTORY_TEXT_STORE_LENGTH = 500

# ── Ensure runtime directories exist ─────────────────────────────────────────
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DB_DIR.mkdir(parents=True, exist_ok=True)
