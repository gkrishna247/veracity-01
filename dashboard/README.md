# Veracity AI — Multimodal Fake News Detection Dashboard

A premium web dashboard for interactive fake news detection using a multimodal
model combining mBERT (text), ResNet-50 (image), and cross-attention fusion.

## Features

| Page | Description |
|---|---|
| **Overview** | KPI cards, training curves, model architecture summary |
| **Predict** | Live prediction with 4 input types + LIME/Grad-CAM explanations |
| **Batch** | CSV upload for bulk text prediction with summary statistics |
| **History** | Persistent prediction history (SQLite), paginated, deletable |
| **Evaluation** | Metrics table, comparison charts, confusion matrices, ROC curves |
| **Adversarial** | FGSM/PGD attack robustness comparison |
| **XAI** | 20 LIME sample reports, SHAP summary, method descriptions |
| **Datasets** | Browse GossipCop (12,252) & Weibo (13,272) with label filtering |
| **Training** | Epoch-by-epoch charts with best model annotation |

## Prerequisites

- Python 3.9+
- ~4 GB RAM (for model loading)
- pip

## Installation

```bash
cd dashboard
pip install -r requirements.txt
```

## Running

```bash
cd dashboard
uvicorn app:app --host 0.0.0.0 --port 8000
```

Then open http://localhost:8000 in your browser.

## Test Data

Pre-prepared test samples are in `test_data/`:

| Folder | Contents | Use For |
|---|---|---|
| `gossipcop_text_only/sample.csv` | 20 GossipCop articles | Type 1: English text prediction |
| `weibo_text_only/sample.csv` | 20 Weibo posts | Type 2: Chinese text prediction |
| `weibo_image_only/real/` + `fake/` | 10 images (5+5) | Type 3: Image-only prediction |
| `weibo_text_image/real/` + `fake/` | 20 text+image pairs | Type 4: Multimodal prediction |

## Troubleshooting

| Issue | Solution |
|---|---|
| Model load fails | Ensure `model/best_model.pt` exists (~818 MB) |
| Out of memory | Need ~4 GB free RAM for model loading |
| Slow first startup | HuggingFace models download on first run (~500 MB) |
| LIME is slow | Normal — LIME perturbs text 100 times per explanation |

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **Frontend**: Vanilla HTML/CSS/JS + Plotly.js
- **Database**: SQLite (aiosqlite)
- **ML**: PyTorch + HuggingFace Transformers + LIME
