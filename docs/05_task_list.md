# Veracity AI — Task List

> **Version**: 2.0  
> **Last Updated**: 2026-04-07  
> **Status**: Awaiting user approval  
> **Document Purpose**: Granular, ordered checklist of every task to complete. Each item maps to a specific requirement and design element.  
> **Refs**: [04_implementation_plan.md](./04_implementation_plan.md)

---

## Phase 1: Scaffolding & Data Preparation

### 1.1 Create Directory Tree
- [ ] Create `dashboard/` root
- [ ] Create `dashboard/model/`
- [ ] Create `dashboard/data/datasets/`
- [ ] Create `dashboard/evaluation/`
- [ ] Create `dashboard/lime_reports/`
- [ ] Create `dashboard/static/css/`
- [ ] Create `dashboard/static/js/pages/`
- [ ] Create `dashboard/templates/`
- [ ] Create `dashboard/test_data/gossipcop_text_only/`
- [ ] Create `dashboard/test_data/weibo_text_only/`
- [ ] Create `dashboard/test_data/weibo_image_only/real/`
- [ ] Create `dashboard/test_data/weibo_image_only/fake/`
- [ ] Create `dashboard/test_data/weibo_text_image/real/`
- [ ] Create `dashboard/test_data/weibo_text_image/fake/`
- [ ] Create `dashboard/db/`
- [ ] Create `dashboard/uploads/`

### 1.2 Copy Model
- [ ] Copy `outputs/best_model.pt` → `dashboard/model/best_model.pt`

### 1.3 Copy Dataset CSVs
- [ ] Copy `input/datasets/gossipcop_final.csv` → `dashboard/data/datasets/gossipcop_final.csv`
- [ ] Copy `input/datasets/weibo_final.csv` → `dashboard/data/datasets/weibo_final.csv`

### 1.4 Copy Evaluation Artifacts
- [ ] Copy `outputs/evaluation_results_detailed.json` → `dashboard/evaluation/`
- [ ] Copy `outputs/evaluation_table.csv` → `dashboard/evaluation/`
- [ ] Copy `outputs/adversarial_results.json` → `dashboard/evaluation/`
- [ ] Copy `outputs/training_log.json` → `dashboard/evaluation/`
- [ ] Copy `outputs/confusion_matrices_all.png` → `dashboard/evaluation/`
- [ ] Copy `outputs/roc_curves_all.png` → `dashboard/evaluation/`
- [ ] Copy `outputs/shap_summary.png` → `dashboard/evaluation/`
- [ ] Copy `outputs/training_curves.png` → `dashboard/evaluation/`

### 1.5 Copy LIME Reports
- [ ] Copy all 20 `outputs/lime_sample_*.html` files → `dashboard/lime_reports/`

### 1.6 Generate Test Data
- [ ] Write and run Python script to generate all test data
- [ ] Verify `test_data/gossipcop_text_only/sample.csv` has 20 rows (10 real + 10 fake), columns: id, text, title, description, label
- [ ] Verify `test_data/weibo_text_only/sample.csv` has 20 rows (10 real + 10 fake), columns: tweet_id, tweet_content, label
- [ ] Verify `test_data/weibo_image_only/real/` has 5 images, all from real-labeled (label=0) Weibo rows
- [ ] Verify `test_data/weibo_image_only/fake/` has 5 images, all from fake-labeled (label=1) Weibo rows
- [ ] Verify `test_data/weibo_text_image/real/data.csv` has 10 rows with columns: text, image_filename
- [ ] Verify `test_data/weibo_text_image/real/` has 10 corresponding image files
- [ ] Verify `test_data/weibo_text_image/fake/data.csv` has 10 rows with columns: text, image_filename
- [ ] Verify `test_data/weibo_text_image/fake/` has 10 corresponding image files

### 1.7 Create Config Files
- [ ] Create `dashboard/requirements.txt` — all Python dependencies with minimum versions
- [ ] Create `dashboard/config.py` — BASE_DIR, MODEL_PATH, DB_PATH, DATASETS_DIR, EVALUATION_DIR, LIME_DIR, UPLOADS_DIR, TEST_DATA_DIR

### 1.8 Phase 1 Verification
- [ ] Confirm `data/images/` directory does NOT exist inside dashboard
- [ ] Confirm total test images ~30 files
- [ ] Confirm all paths in config.py resolve to existing locations (except db/history.db and uploads/ contents which are runtime)

---

## Phase 2: Backend Core

### 2.1 Model Layer
- [ ] Create `dashboard/model.py` — extract `UnifiedMultimodalFakeNewsDetector` class verbatim from notebook cell 14
- [ ] Verify class imports: `torch.nn`, `transformers.BertModel`, `torchvision.models`

### 2.2 Model Service
- [ ] Create `dashboard/model_service.py`
- [ ] Implement `load_model(model_path, device)` — load state_dict, set eval mode, return model + device
- [ ] Implement `get_tokenizer()` — load `bert-base-multilingual-cased` tokenizer (cached)
- [ ] Implement `preprocess_text(text, lang, tokenizer, max_length=128)` — return dict with input_ids, attention_mask tensors
- [ ] Implement `preprocess_image(pil_image)` — Resize(224), ToTensor, Normalize(ImageNet), return tensor
- [ ] Implement `create_dummy_image()` — return zero tensor of shape (1, 3, 224, 224) for text-only modes
- [ ] Implement `create_zero_kg()` — return `torch.zeros(1, 300)` for simplified KG
- [ ] Implement `predict(text, image_pil, input_type, model, device, tokenizer)` — full pipeline:
  - Preprocess text if present, else use empty string tokenization
  - Preprocess image if present, else use dummy
  - Set `has_image` flag (1 if image present, 0 otherwise)
  - Forward pass → softmax → label + confidence + probabilities
  - Call explain functions
  - Return complete result dict
- [ ] Implement `explain_text_lime(text, predict_fn, num_features=10, num_samples=100)` — LIME text explainer, return token weights + HTML
- [ ] Implement `explain_image_gradcam(image_pil, model, device, target_class)` — hook layer4, forward+backward, heatmap overlay, return base64 PNG

### 2.3 Database Layer
- [ ] Create `dashboard/database.py`
- [ ] Implement `init_db()` — connect to `db/history.db`, execute CREATE TABLE + CREATE INDEX
- [ ] Implement `insert_prediction(data_dict)` — INSERT row, return `lastrowid`
- [ ] Implement `get_history(page, limit)` — SELECT with ORDER BY timestamp DESC, LIMIT, OFFSET, also get COUNT for total
- [ ] Implement `delete_prediction(id)` — DELETE by id, return True/False

### 2.4 Data Service
- [ ] Create `dashboard/data_service.py`
- [ ] Implement `load_dataframes()` — read both CSVs into pandas DataFrames, store as module-level variables
- [ ] Implement `get_gossipcop(page, limit, label_filter)` — filter + paginate DataFrame, return dict with items + total
- [ ] Implement `get_weibo(page, limit, label_filter)` — filter + paginate DataFrame, return dict with items + total (text only, no image fields)
- [ ] Implement `get_dataset_stats()` — return label counts for both datasets
- [ ] Implement `get_evaluation()` — read and return `evaluation/evaluation_results_detailed.json`
- [ ] Implement `get_adversarial()` — read and return `evaluation/adversarial_results.json`
- [ ] Implement `get_training_log()` — read and return `evaluation/training_log.json`

### 2.5 API Routes
- [ ] Create `dashboard/routes.py`
- [ ] Implement `GET /` — Jinja2 template response for index.html
- [ ] Implement `POST /api/predict` — validate inputs, call model_service.predict(), save to DB, save uploaded image to uploads/, return JSON
- [ ] Implement `POST /api/predict/batch` — parse CSV, validate `text` column, loop predictions, save all to DB with shared batch_id, return JSON
- [ ] Implement `GET /api/history` — call database.get_history(), return JSON
- [ ] Implement `DELETE /api/history/{id}` — call database.delete_prediction(), return JSON
- [ ] Implement `GET /api/evaluation` — call data_service.get_evaluation(), return JSON
- [ ] Implement `GET /api/adversarial` — call data_service.get_adversarial(), return JSON
- [ ] Implement `GET /api/training-log` — call data_service.get_training_log(), return JSON
- [ ] Implement `GET /api/dataset/gossipcop` — call data_service.get_gossipcop(), return JSON
- [ ] Implement `GET /api/dataset/weibo` — call data_service.get_weibo(), return JSON
- [ ] Implement `GET /api/dataset/stats` — call data_service.get_dataset_stats(), return JSON
- [ ] Implement `GET /api/lime/{sample_id}` — read lime_reports/lime_sample_{id}.html, return HTML response
- [ ] Implement `GET /api/upload-image/{filename}` — serve file from uploads/ directory

### 2.6 App Entry Point
- [ ] Create `dashboard/app.py`
- [ ] FastAPI app with title "Veracity AI"
- [ ] Lifespan context: load_model → init_db → load_dataframes
- [ ] Mount staticfiles: `/static` → `static/`
- [ ] Mount staticfiles: `/evaluation-static` → `evaluation/`
- [ ] Include router from routes.py
- [ ] Add CORS middleware (allow all origins for local dev)

### 2.7 Phase 2 Verification
- [ ] Server starts: `cd dashboard && uvicorn app:app --port 8000`
- [ ] Model loads (check console log)
- [ ] `GET http://localhost:8000/` returns HTML
- [ ] `GET http://localhost:8000/api/evaluation` returns JSON with 6 groups
- [ ] `GET http://localhost:8000/api/dataset/stats` returns label counts
- [ ] `GET http://localhost:8000/api/dataset/gossipcop?page=1&limit=5` returns 5 items
- [ ] `POST http://localhost:8000/api/predict` with text → returns prediction + explanation
- [ ] `GET http://localhost:8000/api/history` returns the saved prediction

---

## Phase 3: Frontend — Design System & Shell

### 3.1 HTML Shell
- [ ] Create `dashboard/templates/index.html`
- [ ] DOCTYPE + charset + viewport meta
- [ ] Page title: "Veracity AI — Multimodal Fake News Detection"
- [ ] Google Fonts CDN link (Inter, weights 300–700)
- [ ] Plotly.js CDN script
- [ ] Link to `static/css/style.css`
- [ ] Top bar: hamburger button (`☰`), "VERACITY AI" text, theme toggle button
- [ ] Sidebar: 9 nav items (Overview, Predict, Batch, History, Evaluation, Adversarial, XAI, Datasets, Training) with emoji icons + text labels
- [ ] Sidebar collapse button at bottom
- [ ] `<div id="page-content"></div>` main content area
- [ ] Footer: "© 2026 Veracity AI • Multimodal Fake News Detection"
- [ ] Script tags: app.js, router.js, theme.js, api.js, charts.js, all pages/*.js

### 3.2 CSS Design System
- [ ] Create `dashboard/static/css/style.css`
- [ ] Define all CSS variables (dark mode defaults)
- [ ] Define `body.light-mode` override variables
- [ ] Base styles: *, body, html reset
- [ ] Layout: `.app-container`, `.sidebar`, `.main-content`
- [ ] Sidebar: `.sidebar`, `.sidebar.collapsed`, `.nav-item`, `.nav-item.active`
- [ ] Top bar: `.top-bar`, `.brand`, `.theme-toggle`
- [ ] Cards: `.card` with glassmorphism
- [ ] Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`
- [ ] Form elements: `.input`, `.textarea`, `.select`, `.file-upload-zone`
- [ ] Tables: `.data-table`, `.data-table th`, `.data-table td`
- [ ] Badges: `.badge`, `.badge-real`, `.badge-fake`, `.badge-type`
- [ ] KPI cards: `.kpi-card`, `.kpi-value`, `.kpi-label`
- [ ] Gauge: `.gauge-container`, SVG styles
- [ ] Modal: `.modal-overlay`, `.modal-content`
- [ ] Loading: `.spinner`, `@keyframes spin`
- [ ] Animations: `@keyframes fadeIn`, `@keyframes slideIn`
- [ ] Responsive: `@media (max-width: 768px)` rules
- [ ] Scrollbar styling for dark mode

### 3.3 Core JavaScript
- [ ] Create `dashboard/static/js/app.js` — sidebar toggle, init
- [ ] Create `dashboard/static/js/router.js` — hash routing, page registry, default to #/overview
- [ ] Create `dashboard/static/js/theme.js` — toggle handler, localStorage, body class
- [ ] Create `dashboard/static/js/api.js` — fetch wrappers with error handling
- [ ] Create `dashboard/static/js/charts.js` — Plotly dark/light theme configs

### 3.4 Phase 3 Verification
- [ ] Dashboard loads at `http://localhost:8000`
- [ ] Sidebar visible with 9 items
- [ ] Sidebar collapse/expand animates smoothly
- [ ] Content width adjusts when sidebar toggles
- [ ] Clicking nav items updates URL hash and highlights active item
- [ ] Theme toggle switches all colors
- [ ] Theme persists across page reload (localStorage)

---

## Phase 4: Frontend Pages

### 4.1 Overview Page
- [ ] Create `dashboard/static/js/pages/overview.js`
- [ ] Fetch evaluation data and training log on page load
- [ ] Render 4 KPI cards: accuracy (83.72%), F1 (0.7859), AUC-ROC (0.9061), MCC (0.6785)
- [ ] Animated number counter effect on KPI values
- [ ] Training curves Plotly chart: train_loss, val_loss, val_acc as separate traces
- [ ] Model architecture summary card (static content: mBERT + ResNet-50 + Cross-Attention + GAT)
- [ ] Per-dataset comparison bar chart (6 groups × accuracy)

### 4.2 Predict Page
- [ ] Create `dashboard/static/js/pages/predict.js`
- [ ] Input type dropdown: 4 options with descriptions
- [ ] Dynamic form: show/hide text area based on type (show for types 1,2,4; hide for type 3)
- [ ] Dynamic form: show/hide image upload based on type (show for types 3,4; hide for types 1,2)
- [ ] Image drag-and-drop zone with preview thumbnail
- [ ] Input validation before submit
- [ ] Submit → show loading spinner → call `POST /api/predict`
- [ ] Result card: prediction badge (Real/Fake), SVG confidence gauge, meta info
- [ ] Text explanation panel: horizontal colored bars for top 10 tokens
- [ ] Image explanation panel: Grad-CAM heatmap image display
- [ ] Error state display for failed predictions

### 4.3 Batch Page
- [ ] Create `dashboard/static/js/pages/batch.js`
- [ ] CSV file upload zone (drag-and-drop + click)
- [ ] Language dropdown: English (en) / Chinese (zh)
- [ ] Upload button → show progress → call `POST /api/predict/batch`
- [ ] Results table: row #, text preview, prediction badge, confidence %
- [ ] Summary cards: total, real count + %, fake count + %, threshold (0.5), avg confidence
- [ ] Distribution donut chart (Plotly)
- [ ] Empty state when no file uploaded

### 4.4 History Page
- [ ] Create `dashboard/static/js/pages/history.js`
- [ ] Fetch `GET /api/history?page=N&limit=20`
- [ ] Table columns: ID, Timestamp (formatted), Type (badge), Text Preview, Prediction (badge), Confidence
- [ ] Delete button per row → confirmation dialog → `DELETE /api/history/{id}` → refresh
- [ ] Pagination: page numbers + prev/next buttons
- [ ] Empty state: "No predictions yet. Try the Predict page!"

### 4.5 Evaluation Page
- [ ] Create `dashboard/static/js/pages/evaluation.js`
- [ ] Fetch `GET /api/evaluation`
- [ ] Render metrics table (sortable by clicking column headers)
- [ ] Grouped bar chart (Plotly): comparing accuracy, F1 binary, AUC-ROC across 6 groups
- [ ] Display confusion matrix image from `/evaluation-static/confusion_matrices_all.png`
- [ ] Display ROC curves image from `/evaluation-static/roc_curves_all.png`

### 4.6 Adversarial Page
- [ ] Create `dashboard/static/js/pages/adversarial.js`
- [ ] Fetch `GET /api/adversarial`
- [ ] Horizontal bar chart (Plotly): clean accuracy, FGSM accuracy, PGD accuracy
- [ ] Accuracy drop annotations (% difference from clean)
- [ ] Info card: "What is FGSM?" — brief description
- [ ] Info card: "What is PGD?" — brief description

### 4.7 Explainability Page
- [ ] Create `dashboard/static/js/pages/explainability.js`
- [ ] Grid of 20 LIME sample cards (numbered 0–19)
- [ ] Click card → fetch `/api/lime/{id}` → display in full-screen modal with iframe
- [ ] Close modal button
- [ ] SHAP summary plot: display `/evaluation-static/shap_summary.png`
- [ ] Brief text descriptions of LIME, SHAP, and Gradient Attribution methods

### 4.8 Dataset Explorer Page
- [ ] Create `dashboard/static/js/pages/dataset.js`
- [ ] Tab toggle: GossipCop / Weibo
- [ ] Fetch `GET /api/dataset/stats` → render donut charts for each dataset
- [ ] Label filter dropdown: All / Real / Fake
- [ ] Fetch `GET /api/dataset/gossipcop?page=N&limit=20&label=X` or `/weibo`
- [ ] Data cards: text preview (200 chars max) + label badge
- [ ] Weibo cards: text only, no image thumbnails (images not available)
- [ ] Pagination controls

### 4.9 Training Page
- [ ] Create `dashboard/static/js/pages/training.js`
- [ ] Fetch `GET /api/training-log`
- [ ] Plotly line chart: 3 traces (train_loss blue, val_loss red, val_acc green)
- [ ] Annotation on epoch 3: "Best Model Saved"
- [ ] Epoch details table below chart
- [ ] Note about NaN values in later epochs (epochs 6–8)

### 4.10 Phase 4 Verification
- [ ] All 9 pages load without JavaScript console errors
- [ ] All pages display data from live API calls
- [ ] Plotly charts use dark theme colors and switch on theme toggle
- [ ] Prediction works for all 4 input types
- [ ] Text explanation renders for text inputs
- [ ] Image explanation renders for image inputs
- [ ] Both explanations render for text+image input
- [ ] Batch upload processes CSV and shows results
- [ ] History shows recent predictions first
- [ ] History delete works

---

## Phase 5: Polish & Testing

### 5.1 Visual Polish
- [ ] Check all pages for consistent spacing and alignment
- [ ] Verify glassmorphism effects in both themes
- [ ] Verify all micro-animations work (hover, click, transitions)
- [ ] Verify Plotly charts update colors when theme changes
- [ ] Ensure no text overflow or clipping issues

### 5.2 Functional Testing — Predictions
- [ ] Test Type 1 (GossipCop text): paste text from `test_data/gossipcop_text_only/sample.csv`
- [ ] Test Type 2 (Weibo text): paste text from `test_data/weibo_text_only/sample.csv`
- [ ] Test Type 3 (Weibo image): upload image from `test_data/weibo_image_only/real/`
- [ ] Test Type 3 (Weibo image): upload image from `test_data/weibo_image_only/fake/`
- [ ] Test Type 4 (Weibo both): use text + image from `test_data/weibo_text_image/real/`
- [ ] Test Type 4 (Weibo both): use text + image from `test_data/weibo_text_image/fake/`
- [ ] Verify LIME explanation appears for text predictions
- [ ] Verify Grad-CAM explanation appears for image predictions
- [ ] Verify BOTH explanations appear for text+image predictions

### 5.3 Functional Testing — Batch
- [ ] Create test batch CSV from test data
- [ ] Upload with lang=en → verify results table + summary
- [ ] Upload with lang=zh → verify results table + summary

### 5.4 Functional Testing — History
- [ ] After predictions, verify history page shows entries in correct order
- [ ] Verify pagination works (make enough predictions to fill 2+ pages)
- [ ] Verify delete removes entry and refreshes list
- [ ] Verify batch entries appear with shared batch_id grouping

### 5.5 Functional Testing — Navigation
- [ ] Toggle sidebar on every page, verify content reflows
- [ ] Toggle theme on every page, verify colors correct
- [ ] Navigate to all 9 pages, verify each loads correctly
- [ ] Test browser back/forward navigation

### 5.6 Error Testing
- [ ] Submit prediction with no text and no image → verify error message
- [ ] Submit batch with empty CSV → verify error message
- [ ] Submit batch with wrong column name → verify error message
- [ ] Request invalid LIME sample (id=99) → verify 404

### 5.7 Documentation
- [ ] Create `dashboard/README.md` with:
  - [ ] Project overview and feature list
  - [ ] Prerequisites (Python 3.9+, pip, ~4 GB RAM)
  - [ ] Installation: `cd dashboard && pip install -r requirements.txt`
  - [ ] Running: `cd dashboard && uvicorn app:app --host 0.0.0.0 --port 8000`
  - [ ] Feature descriptions for all 9 pages
  - [ ] Test data file descriptions and how to use them
  - [ ] Troubleshooting: model load failure, HuggingFace download, memory issues

### 5.8 Final Verification
- [ ] Record browser walkthrough video of all features
- [ ] Create walkthrough.md artifact with summary
- [ ] All 14 functional requirements (FR-001 through FR-014) verified
- [ ] All 6 non-functional requirements (NFR-001 through NFR-006) verified
