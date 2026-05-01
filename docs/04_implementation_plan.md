# Veracity AI — Implementation Plan

> **Version**: 2.0  
> **Last Updated**: 2026-04-07  
> **Status**: Awaiting user approval  
> **Document Purpose**: Define the BUILD ORDER — phases, steps, dependencies, and verification approach.  
> **Refs**: [01_requirements.md](./01_requirements.md), [02_spec.md](./02_spec.md), [03_design.md](./03_design.md)

---

## Phase Overview

| Phase | Name | Goal | Depends On |
|---|---|---|---|
| 1 | Scaffolding & Data Preparation | Folder structure, copy files, generate test data | Nothing |
| 2 | Backend Core | Working FastAPI server with all API endpoints | Phase 1 |
| 3 | Frontend Shell | SPA shell with sidebar, routing, theme toggle | Phase 1 |
| 4 | Frontend Pages | All 9 page implementations | Phase 2 + Phase 3 |
| 5 | Polish & Testing | Bug fixes, visual review, documentation | Phase 4 |

**Phases 2 and 3 can run in parallel** since backend and frontend shell are independent.

---

## Phase 1: Scaffolding & Data Preparation

**Goal**: Create the complete `dashboard/` folder with all required files in place.

### Steps

1. **Create directory tree** — All folders as specified in [03_design.md § Folder Structure](./03_design.md)

2. **Copy model** — `outputs/best_model.pt` → `dashboard/model/best_model.pt` (~818 MB)

3. **Copy dataset CSVs** — `input/datasets/gossipcop_final.csv` and `weibo_final.csv` → `dashboard/data/datasets/`

4. **Copy evaluation artifacts** (8 files) — All JSONs and PNGs from `outputs/` → `dashboard/evaluation/`:
   - `evaluation_results_detailed.json`
   - `evaluation_table.csv`
   - `adversarial_results.json`
   - `training_log.json`
   - `confusion_matrices_all.png`
   - `roc_curves_all.png`
   - `shap_summary.png`
   - `training_curves.png`

5. **Copy LIME reports** (20 files) — `outputs/lime_sample_*.html` → `dashboard/lime_reports/`

6. **DO NOT copy `input/images/`** — The full Weibo image directory is excluded.

7. **Generate test data** using a Python script that reads the source datasets:
   - `test_data/gossipcop_text_only/sample.csv` — 20 random rows (10 real + 10 fake) from `gossipcop_final.csv`
   - `test_data/weibo_text_only/sample.csv` — 20 random rows (10 real + 10 fake) from `weibo_final.csv` (columns: tweet_id, tweet_content, label)
   - `test_data/weibo_image_only/real/` — 5 images: pick 5 Weibo rows where `label == 0`, copy their first image from `input/images/`
   - `test_data/weibo_image_only/fake/` — 5 images: pick 5 Weibo rows where `label == 1`, copy their first image from `input/images/`
   - `test_data/weibo_text_image/real/` — 10 Weibo rows where `label == 0` and have valid images: create `data.csv` (text, image_filename) + copy 10 images
   - `test_data/weibo_text_image/fake/` — 10 Weibo rows where `label == 1` and have valid images: create `data.csv` (text, image_filename) + copy 10 images

8. **Create `requirements.txt`**:
   ```
   fastapi>=0.100.0
   uvicorn[standard]>=0.20.0
   torch>=2.0.0
   torchvision>=0.15.0
   transformers>=4.30.0
   Pillow>=9.0.0
   pandas>=2.0.0
   numpy>=1.24.0
   lime>=0.2.0
   python-multipart>=0.0.5
   jinja2>=3.1.0
   aiosqlite>=0.19.0
   opencv-python-headless>=4.8.0
   ```

9. **Create `config.py`** — All path constants relative to `dashboard/` root.

### Verification
- [ ] `dashboard/` directory tree matches design doc exactly
- [ ] `model/best_model.pt` exists and is ~818 MB
- [ ] Both CSV files exist in `data/datasets/`
- [ ] 8 evaluation files exist in `evaluation/`
- [ ] 20 LIME files exist in `lime_reports/`
- [ ] Test data CSVs have correct columns and row counts
- [ ] Test images exist in correct real/fake folders
- [ ] `data/images/` directory does NOT exist

---

## Phase 2: Backend Core

**Goal**: All 13 API endpoints working and returning correct data.

### Steps

1. **`model.py`** — Copy `UnifiedMultimodalFakeNewsDetector` class from notebook verbatim. Include all layer definitions.

2. **`model_service.py`**:
   - `load_model(path)` — Load `best_model.pt`, set `model.eval()`, move to device (CPU/GPU)
   - `preprocess_text(text, lang)` — Use `bert-base-multilingual-cased` tokenizer, max_length=128, return `input_ids` + `attention_mask`
   - `preprocess_image(pil_image)` — Resize to 224×224, ToTensor, ImageNet normalize
   - `create_zero_kg_embedding()` — Return `torch.zeros(1, 300)` (simplified KG)
   - `predict(text, image, input_type)` — Full pipeline: preprocess → forward → softmax → label + confidence + explanation
   - `explain_text_lime(text, model, ...)` — LIME with 100 perturbations, return top 10 tokens
   - `explain_image_gradcam(image, model, ...)` — Grad-CAM on ResNet layer4, return base64 PNG

3. **`database.py`**:
   - `init_db()` — Create table + indexes using schema from [02_spec.md § Database Schema](./02_spec.md)
   - `insert_prediction(data)` → `history_id` (int)
   - `get_history(page, limit)` → `{total, page, limit, items}`
   - `delete_prediction(id)` → `bool`

4. **`data_service.py`**:
   - `load_dataframes()` — Read both CSVs at startup, cache in memory
   - `get_gossipcop(page, limit, label)` → paginated dict
   - `get_weibo(page, limit, label)` → paginated dict (text only, no image paths)
   - `get_dataset_stats()` → label counts
   - `get_evaluation_json()` → dict
   - `get_adversarial_json()` → dict
   - `get_training_log_json()` → dict

5. **`routes.py`** — Implement all 13 endpoints from [02_spec.md](./02_spec.md)

6. **`app.py`**:
   - Create FastAPI instance
   - Lifespan context manager: load model → init DB → load dataframes
   - Mount `static/` at `/static`
   - Mount `evaluation/` at `/evaluation-static` (for PNG images)
   - Register all routes
   - Jinja2 template response for `GET /`

### Verification
- [ ] `uvicorn app:app` starts without error
- [ ] Model loads successfully (logged to console)
- [ ] `curl GET /` returns HTML
- [ ] `curl POST /api/predict` with text returns prediction JSON
- [ ] `curl POST /api/predict/batch` with CSV returns batch results
- [ ] `curl GET /api/history` returns paginated list
- [ ] `curl GET /api/evaluation` returns JSON
- [ ] `curl GET /api/dataset/stats` returns label counts

---

## Phase 3: Frontend Shell

**Goal**: SPA loads in browser with working sidebar, routing, and theme toggle.

### Steps

1. **`templates/index.html`**:
   - Meta tags, title "Veracity AI"
   - CDN imports: Inter font, Plotly.js
   - Top bar: hamburger `☰`, "VERACITY AI" branding, theme toggle `🌙/☀️`
   - Sidebar: 9 nav items with icons and labels, collapse button
   - Content area: `<div id="page-content"></div>`
   - Footer
   - Script imports: all JS files in correct order

2. **`static/css/style.css`**:
   - CSS custom properties for dark (default) + light themes
   - Base reset and body styles
   - Layout grid (sidebar + main)
   - Sidebar styles: expanded/collapsed, nav items, active state, transition
   - Top bar styles
   - All component styles from [03_design.md § Component Styles](./03_design.md)
   - Responsive rules
   - Animations (@keyframes for spinner, fade-in, slide-in)

3. **`static/js/app.js`** — DOMContentLoaded init, sidebar toggle event listener

4. **`static/js/router.js`** — Listen for `hashchange`, call appropriate page render function

5. **`static/js/theme.js`** — Toggle `body.light-mode` class, save to localStorage, update toggle icon

6. **`static/js/api.js`** — `api.get(url)`, `api.post(url, body)`, `api.postForm(url, formData)`, `api.delete(url)` — all return parsed JSON

7. **`static/js/charts.js`** — `getPlotlyLayout(title)` returns layout config using current theme colors, `getPlotlyConfig()` returns config with responsive=true

### Verification
- [ ] Page loads at `http://localhost:8000`
- [ ] Sidebar shows 9 items
- [ ] Sidebar collapses/expands with smooth animation
- [ ] Content area adjusts width when sidebar toggles
- [ ] Clicking nav items changes URL hash
- [ ] Theme toggle switches dark ↔ light mode
- [ ] Theme persists on page reload

---

## Phase 4: Frontend Pages

**Goal**: All 9 pages fully functional with real data.

### Steps (one per page)

1. **`pages/overview.js`** — Fetch `/api/evaluation` + `/api/training-log`. Render: KPI cards (accuracy, F1, AUC-ROC, MCC with animated counters), training curves (Plotly line chart), model architecture card (static text), per-dataset bar chart.

2. **`pages/predict.js`** — Input type dropdown (4 options). Dynamic form visibility based on selection. Image upload with drag-and-drop + preview thumbnail. Submit → `POST /api/predict` → show result card (label badge + SVG gauge + meta info). Text explanation: horizontal token bars. Image explanation: Grad-CAM heatmap img. Loading spinner during processing.

3. **`pages/batch.js`** — File upload zone for CSV. Language dropdown (EN/ZH). Submit → `POST /api/predict/batch` → results table (row #, text preview, label, confidence). Summary cards: total, real count/%, fake count/%, threshold (0.5), avg confidence. Distribution donut chart (Plotly).

4. **`pages/history.js`** — Fetch `/api/history?page=N`. Table: ID, timestamp (formatted), input type badge, text preview (truncated), prediction badge (Real=green, Fake=red), confidence %. Delete button per row with confirmation dialog. Pagination prev/next buttons. Empty state if no history.

5. **`pages/evaluation.js`** — Fetch `/api/evaluation`. Sortable metrics table. Grouped bar chart (Plotly) comparing accuracy, F1, AUC across groups. Confusion matrix PNG display. ROC curves PNG display.

6. **`pages/adversarial.js`** — Fetch `/api/adversarial`. Horizontal bar chart: clean accuracy, FGSM accuracy, PGD accuracy. Drop % annotations. Info cards with descriptions of each attack type.

7. **`pages/explainability.js`** — Grid of 20 LIME cards (sample 0–19). Click → fetch `/api/lime/{id}` → render in full-width modal iframe. SHAP summary PNG display. Text descriptions of LIME and SHAP methods.

8. **`pages/dataset.js`** — Tab toggle: GossipCop / Weibo. Label filter: All / Real / Fake dropdown. Data cards: text preview + label badge (no images for Weibo). Donut chart: label distribution (Plotly). Pagination controls. Fetch `/api/dataset/gossipcop` or `/api/dataset/weibo`.

9. **`pages/training.js`** — Fetch `/api/training-log`. Plotly line chart: train_loss (blue), val_loss (red), val_acc (green) per epoch. Annotation on epoch 3 ("Best Model Saved"). Scrollable log entries section.

### Verification
- [ ] Each page loads without JS errors
- [ ] Each page displays real data from API
- [ ] Plotly charts render with correct dark theme
- [ ] Prediction form validation works
- [ ] All 4 prediction types work with test data
- [ ] Batch upload processes CSV correctly

---

## Phase 5: Polish & Testing

**Goal**: Production-quality finish.

### Steps

1. **Visual review** — Check every page: alignment, spacing, color consistency, glassmorphism effects
2. **Functional testing** — Test all 4 prediction types using test data files
3. **Batch testing** — Create a CSV from test data and upload
4. **History testing** — Verify ordering, pagination, delete, image display
5. **Sidebar testing** — Toggle on every page, verify content reflow
6. **Theme testing** — Toggle on every page, verify Plotly charts update
7. **Error testing** — Submit invalid inputs, verify error messages
8. **Create `README.md`** — Prerequisites, install, run, feature overview, test data usage, troubleshooting
9. **Browser walkthrough recording** — Record video demonstrating all features

### Verification
- [ ] All 14 functional requirements verified
- [ ] All 6 non-functional requirements verified
- [ ] README.md is complete and accurate
- [ ] Walkthrough recording captured

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Model too large for available RAM | Server crash at startup | Medium | Log clear error message; document 4 GB min requirement |
| HuggingFace model download on first run | 5+ min startup delay | Medium | Note in README; models cached after first download |
| LIME explanation very slow on CPU | 15+ sec per prediction | High | Reduce perturbation count to 100; show loading spinner |
| Grad-CAM needs gradient tracking | Slightly slower inference | Low | Use `torch.enable_grad()` only during explanation |
| Large CSVs slow to page on first load | API latency on first request | Low | Pre-cache DataFrames at startup |
| SQLite concurrency under batch | Rare write conflicts | Low | Use async `aiosqlite` with proper connection handling |
