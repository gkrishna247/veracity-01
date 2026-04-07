# Veracity AI — Requirements Document

> **Version**: 2.0  
> **Last Updated**: 2026-04-07  
> **Status**: Awaiting user approval  
> **Document Purpose**: Define WHAT the system must do. Lists all functional and non-functional requirements.

---

## 1. Project Overview

**Veracity AI** is a self-contained web dashboard for the Multimodal Fake News Detection pipeline. It allows users to:
- Run live predictions across 4 input modalities (text-only EN, text-only ZH, image-only, text+image)
- View model explanations for both text (LIME) and image (Grad-CAM) modalities
- Upload CSV files for batch text prediction
- Explore pre-computed evaluation metrics, adversarial robustness results, and training history
- Browse the underlying datasets
- Maintain a persistent prediction history via SQLite

The entire dashboard runs from a single `dashboard/` folder. Only the files needed for dashboard operation are copied into it — test samples and evaluation artifacts. The full image directory (12,773 Weibo images) is NOT copied; only a curated subset of test images is included.

---

## 2. Functional Requirements

### FR-001: Overview Dashboard
The system SHALL display a home page with:
- KPI cards showing: Combined accuracy (83.72%), F1 score, AUC-ROC, MCC
- Per-dataset performance summary for all 6 evaluation groups
- Interactive training curves chart (train loss, val loss, val accuracy by epoch)
- Model architecture summary card

### FR-002: Live Single Prediction
The system SHALL accept 4 input types and return predictions:

| Type ID | Name | Text | Image | Language |
|---|---|---|---|---|
| `gossipcop_text` | GossipCop Text-Only | Required | None | `en` |
| `weibo_text` | Weibo Text-Only | Required | None | `zh` |
| `weibo_image` | Weibo Image-Only | None | Required | `zh` |
| `weibo_both` | Weibo Text+Image | Required | Required | `zh` |

For each prediction the system SHALL return:
- Predicted label: `Real` or `Fake`
- Confidence probability: 0–100%
- Probability for each class (probability_real, probability_fake)
- Visual confidence gauge

### FR-003: Prediction Explanations
The system SHALL generate explanations automatically and asynchronously for every prediction:
- **Text explanation (LIME)**: Top contributing tokens with positive/negative weights, rendered as colored bars. Generated for Types `gossipcop_text`, `weibo_text`, `weibo_both`.
- **Image explanation (Grad-CAM)**: Heatmap overlay on the original image showing regions that influenced the prediction. Generated for Types `weibo_image`, `weibo_both`.
- For `weibo_both`: BOTH text and image explanations are shown.
- The prediction result (label + confidence) SHALL appear immediately. The explanation section SHALL display a loading indicator and render asynchronously after computation completes.

### FR-004: Batch Prediction
The system SHALL support batch text prediction via CSV upload:
- CSV format: single column named `text` with one text entry per row
- A language dropdown (`en` / `zh`) applies to ALL rows in the batch
- For each row: predicted label, confidence probability
- Summary statistics: total rows, real count + percentage, fake count + percentage, classification threshold (0.5), average confidence
- Results displayed in a scrollable table
- Each batch row is saved to prediction history

### FR-005: Prediction History
The system SHALL persist all predictions in a SQLite database:
- Stored at `dashboard/db/history.db` (auto-created on first run)
- Displayed in reverse chronological order (most recent first)
- Each entry: ID, timestamp, input type, text preview (truncated), prediction label, confidence, language
- Supports pagination (20 items per page)
- Delete individual entries
- Batch predictions appear as individual rows grouped by a shared batch_id
- No authentication required

### FR-006: Image Upload Persistence
The system SHALL save uploaded prediction images to `dashboard/uploads/`:
- Filename format: `{history_id}_{original_filename}`
- Images persist until user manually deletes them from disk
- History entries reference stored image filenames for later review

### FR-007: Evaluation Results Explorer
The system SHALL display pre-computed evaluation data:
- Interactive sortable table of all 6 groups with metrics: accuracy, F1 (binary/macro/weighted), precision, recall, AUC-ROC, MCC, Cohen's Kappa, sample count
- Grouped bar chart comparing key metrics across groups
- Pre-generated confusion matrix image
- Pre-generated ROC curves image

### FR-008: Adversarial Robustness Panel
The system SHALL display:
- Clean accuracy vs FGSM accuracy vs PGD accuracy (bar chart)
- Accuracy drop percentages
- Explanatory cards describing what FGSM and PGD attacks are

### FR-009: Explainability (XAI) Viewer
The system SHALL provide:
- Gallery of 20 pre-generated LIME sample explanations (browseable)
- Click to view full LIME report in an embedded iframe/modal
- Pre-generated SHAP summary plot image

### FR-010: Dataset Explorer
The system SHALL allow browsing both datasets:
- **GossipCop tab**: title, text snippet (first 200 chars), label badge — paginated
- **Weibo tab**: tweet content snippet, label badge — paginated, text-only (no image thumbnails since full image set is not copied)
- Label filter dropdown: All / Real / Fake
- Label distribution donut chart for each dataset
- Pagination controls (20 items per page)

### FR-011: Training History Viewer
The system SHALL display:
- Interactive Plotly chart: train_loss, val_loss, val_acc per epoch
- Annotation highlighting best epoch (epoch 3)
- Scrollable training log entries

### FR-012: Sidebar Navigation
- Sidebar visible by default (~240px width)
- Toggle button (hamburger icon in top bar) to show/hide
- Hidden: sidebar collapses to 0px, content expands to full width
- Shown: sidebar pushes content to the right
- Smooth slide transition (300ms)
- Active page highlighted with accent color + left border indicator
- Sidebar state maintained during session

### FR-013: Dark/Light Mode Toggle
- Dark mode is the DEFAULT on first load
- Toggle switch in top bar to switch between dark and light
- Theme preference persisted in localStorage during session

### FR-014: Test Data
The system SHALL include pre-prepared test data in `dashboard/test_data/`:

| Folder | Contents | Purpose |
|---|---|---|
| `gossipcop_text_only/` | `sample.csv` — 20 random GossipCop rows (id, text, title, description, label) | Test Type 1 predictions |
| `weibo_text_only/` | `sample.csv` — 20 random Weibo rows (tweet_id, tweet_content, label) | Test Type 2 predictions |
| `weibo_image_only/real/` | 5 images with label=0 (real) from original Weibo dataset | Test Type 3 predictions |
| `weibo_image_only/fake/` | 5 images with label=1 (fake) from original Weibo dataset | Test Type 3 predictions |
| `weibo_text_image/real/` | `data.csv` (columns: text, image_filename) + 10 corresponding real images | Test Type 4 predictions |
| `weibo_text_image/fake/` | `data.csv` (columns: text, image_filename) + 10 corresponding fake images | Test Type 4 predictions |

Image labels (real/fake splits) MUST be based on the original dataset labels, NOT on model predictions.

---

## 3. Non-Functional Requirements

### NFR-001: Self-Containment
The dashboard SHALL operate entirely from files within `dashboard/`. Only the following are copied in:
- Model weights (`best_model.pt`)
- Dataset CSV files (for dataset explorer)
- Evaluation artifact files (JSONs + PNGs)
- LIME report HTML files
- Curated test data images (~30 images total)

The full Weibo image directory (12,773 files) is NOT copied.

### NFR-002: Performance
- Model loads once at server startup (one-time cost)
- Single prediction result: <3 seconds (CPU), <1 second (GPU)
- Explanations: <15 seconds (LIME), <3 seconds (Grad-CAM)
- Page navigation: <200ms (client-side routing)
- Charts: render within 1 second

### NFR-003: Visual Design
- Premium dark-mode-first aesthetic
- Glassmorphism cards with `backdrop-filter: blur()`
- Smooth gradients and micro-animations
- Google Fonts (Inter) for typography
- Desktop-first responsive layout

### NFR-004: No Authentication
No login, no sessions, no auth. Dashboard is fully open access.

### NFR-005: Browser Compatibility
Chrome, Firefox, Edge — latest 2 versions.

### NFR-006: Data Persistence
SQLite database persists across server restarts. Uploaded images persist on disk.

---

## 4. Constraints

| Constraint | Value |
|---|---|
| Model size | ~818 MB (PyTorch checkpoint) |
| Minimum RAM | ~4 GB for model loading |
| Python version | 3.9+ |
| GossipCop dataset | 12,252 rows (8,168 real / 4,084 fake) |
| Weibo dataset | 13,272 rows |
| Test images copied | ~30 files only |
| Full image directory | NOT copied into dashboard |

---

## 5. Assumptions

1. Python 3.9+ and pip are installed on the target machine
2. PyTorch is installed (CPU or CUDA)
3. HuggingFace transformers models will auto-download on first run if not cached
4. Dashboard runs locally (no cloud deployment in initial scope)
5. `best_model.pt` is a valid checkpoint for the `UnifiedMultimodalFakeNewsDetector` architecture
