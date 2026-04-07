/**
 * Veracity AI — Predict Page
 *
 * Single prediction form supporting 4 input types with dynamic form fields,
 * image drag-and-drop, result display, and LIME/Grad-CAM explanations.
 */

const PredictPage = {
  selectedFile: null,

  render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Live Prediction</h1>
        <p>Analyze text, images, or both for fake news detection</p>
      </div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Input Type</label>
          <select class="select" id="predict-type" onchange="PredictPage.onTypeChange()">
            <option value="gossipcop_text">📝 GossipCop — English Text Only</option>
            <option value="weibo_text">📝 Weibo — Chinese Text Only</option>
            <option value="weibo_image">🖼️ Weibo — Image Only</option>
            <option value="weibo_both">📝🖼️ Weibo — Text + Image</option>
          </select>
        </div>

        <div class="form-group" id="text-group">
          <label class="form-label">Input Text</label>
          <textarea class="textarea" id="predict-text" placeholder="Enter article text or tweet content..."></textarea>
        </div>

        <div class="form-group" id="image-group" style="display:none;">
          <label class="form-label">Upload Image</label>
          <div class="file-upload-zone" id="image-drop-zone">
            <div class="file-upload-zone__icon">📷</div>
            <div class="file-upload-zone__text">Drop image here or click to upload</div>
            <div class="file-upload-zone__hint">JPEG, PNG, GIF — Max 10 MB</div>
            <input type="file" id="image-input" accept="image/*">
          </div>
          <img id="image-preview" class="image-preview" style="display:none;" alt="Preview">
        </div>

        <button class="btn btn-primary" id="predict-btn" onclick="PredictPage.submit()">
          🔍 Analyze
        </button>
      </div>

      <div id="predict-result"></div>
    `;

    this._setupImageUpload();
  },

  onTypeChange() {
    const type = document.getElementById('predict-type').value;
    const textGroup = document.getElementById('text-group');
    const imageGroup = document.getElementById('image-group');
    const config = {
      gossipcop_text: { text: true, image: false },
      weibo_text:     { text: true, image: false },
      weibo_image:    { text: false, image: true },
      weibo_both:     { text: true, image: true },
    };
    const c = config[type];
    textGroup.style.display = c.text ? 'block' : 'none';
    imageGroup.style.display = c.image ? 'block' : 'none';
  },

  _setupImageUpload() {
    const zone = document.getElementById('image-drop-zone');
    const input = document.getElementById('image-input');
    const preview = document.getElementById('image-preview');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        this.selectedFile = e.dataTransfer.files[0];
        this._showPreview(this.selectedFile);
      }
    });
    input.addEventListener('change', () => {
      if (input.files[0]) {
        this.selectedFile = input.files[0];
        this._showPreview(this.selectedFile);
      }
    });
  },

  _showPreview(file) {
    const preview = document.getElementById('image-preview');
    const reader = new FileReader();
    reader.onload = (e) => { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  },

  async submit() {
    const type = document.getElementById('predict-type').value;
    const text = document.getElementById('predict-text')?.value;
    const btn = document.getElementById('predict-btn');
    const resultDiv = document.getElementById('predict-result');

    // Validation
    const config = { gossipcop_text: {t:true,i:false}, weibo_text: {t:true,i:false}, weibo_image: {t:false,i:true}, weibo_both: {t:true,i:true} };
    const c = config[type];
    if (c.t && (!text || !text.trim())) { alert('Please enter text.'); return; }
    if (c.i && !this.selectedFile) { alert('Please upload an image.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Analyzing...';
    resultDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Running prediction and generating explanations...</span></div>';

    try {
      const formData = new FormData();
      formData.append('input_type', type);
      if (text) formData.append('text', text);
      if (this.selectedFile) formData.append('image', this.selectedFile);

      this._lastSubmittedText = text ? text.trim() : '';
      const result = await API.postForm('/api/predict', formData);
      this._renderResult(result);
    } catch (err) {
      resultDiv.innerHTML = `<div class="card" style="color:var(--danger);margin-top:var(--space-6);">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔍 Analyze';
    }
  },

  /** Store the submitted text so the explanation can reference it */
  _lastSubmittedText: '',

  _renderResult(r) {
    const gauge = createGauge(r.confidence, r.prediction);
    const typeName = { gossipcop_text: 'GossipCop Text', weibo_text: 'Weibo Text', weibo_image: 'Weibo Image', weibo_both: 'Weibo Text+Image' };

    let explanationHtml = '';
    const exp = r.explanation || {};

    if (exp.text || exp.image) {
      let textPanel = '', imagePanel = '';

      if (exp.text && exp.text.tokens && exp.text.tokens.length > 0) {
        // ── Build highlighted full-text view ─────────────────────────
        const inputText = this._lastSubmittedText || '';
        const tokenWeights = exp.text.tokens; // [{token, weight}, ...]

        // Find max absolute weight for normalizing opacity
        const maxAbs = Math.max(...tokenWeights.map(t => Math.abs(t.weight)), 0.001);

        // Build a lookup: lowercase token → weight
        const weightMap = {};
        for (const t of tokenWeights) {
          weightMap[t.token.toLowerCase()] = t.weight;
        }

        // Split input text into words preserving whitespace and punctuation
        // Regex captures: (word characters) | (non-word characters including spaces)
        const parts = inputText.match(/[\w\u4e00-\u9fff]+|[^\w\u4e00-\u9fff]+/gu) || [inputText];

        const highlightedParts = parts.map(part => {
          const key = part.toLowerCase().replace(/[^\w\u4e00-\u9fff]/gu, '');
          if (!key) {
            // Whitespace / punctuation — render as-is
            return `<span class="xai-neutral">${this._escapeHtml(part)}</span>`;
          }
          const weight = weightMap[key];
          if (weight === undefined) {
            // Word not in LIME features — render unstyled
            return `<span class="xai-neutral">${this._escapeHtml(part)}</span>`;
          }
          // Compute color and opacity from weight
          const opacity = Math.min(Math.abs(weight) / maxAbs, 1) * 0.8 + 0.15;
          const sign = weight > 0 ? 'fake' : 'real';
          // Positive LIME weight → pushes toward predicted class (Fake), negative → Real
          const bgColor = sign === 'fake'
            ? `rgba(239, 68, 68, ${opacity})`  // red
            : `rgba(16, 185, 129, ${opacity})`; // green
          const textColor = opacity > 0.5 ? '#fff' : 'var(--text-primary)';
          const title = `${part}: ${weight > 0 ? '+' : ''}${weight.toFixed(4)} → ${sign === 'fake' ? 'Fake indicator' : 'Real indicator'}`;
          return `<span class="xai-highlight" style="background:${bgColor};color:${textColor};" title="${title}">${this._escapeHtml(part)}</span>`;
        }).join('');

        // ── Token weight bars (compact, below the highlighted text) ──
        const bars = tokenWeights.map(t => {
          const w = t.weight;
          const barWidth = Math.min(Math.abs(w) / maxAbs * 100, 100);
          const color = w > 0 ? 'var(--danger)' : 'var(--success)';
          return `<div class="token-bar">
            <span class="token-bar__label" title="${t.token}">${this._escapeHtml(t.token)}</span>
            <div class="token-bar__track">
              <div class="token-bar__fill" style="width:${barWidth}%;background:${color};"></div>
            </div>
            <span class="token-bar__value">${w > 0 ? '+' : ''}${w.toFixed(4)}</span>
          </div>`;
        }).join('');

        textPanel = `
          <div class="explanation-panel explanation-panel--wide">
            <div class="explanation-panel__title">📝 Text Explanation (LIME)</div>
            <div class="xai-legend">
              <span class="xai-legend__item"><span class="xai-legend__swatch" style="background:rgba(239,68,68,0.6);"></span> Fake indicator</span>
              <span class="xai-legend__item"><span class="xai-legend__swatch" style="background:rgba(16,185,129,0.6);"></span> Real indicator</span>
              <span class="xai-legend__item"><span class="xai-legend__swatch" style="background:var(--bg-tertiary);"></span> Neutral</span>
            </div>
            <div class="xai-highlighted-text">${highlightedParts}</div>
            <details class="xai-details">
              <summary>Show token weights</summary>
              <div class="xai-bars">${bars}</div>
            </details>
          </div>`;
      }

      if (exp.image && exp.image.heatmap_base64) {
        imagePanel = `<div class="explanation-panel"><div class="explanation-panel__title">🖼️ Image Explanation (Grad-CAM)</div><img src="${exp.image.heatmap_base64}" style="width:100%;border-radius:var(--radius-md);" alt="Grad-CAM heatmap"></div>`;
      }

      if (textPanel || imagePanel) {
        explanationHtml = `<div class="explanation-grid">${textPanel}${imagePanel}</div>`;
      }
    }

    document.getElementById('predict-result').innerHTML = `
      <div class="result-card">
        <div class="result-header">
          ${gauge}
          <div class="result-meta">
            <div class="result-meta__item"><span class="result-meta__label">Prediction:</span><span class="result-meta__value">${createBadge(r.prediction)}</span></div>
            <div class="result-meta__item"><span class="result-meta__label">Input Type:</span><span class="result-meta__value">${typeName[r.input_type] || r.input_type}</span></div>
            <div class="result-meta__item"><span class="result-meta__label">Language:</span><span class="result-meta__value">${r.lang === 'en' ? 'English' : 'Chinese'}</span></div>
            <div class="result-meta__item"><span class="result-meta__label">P(Real):</span><span class="result-meta__value">${r.probability_real.toFixed(4)}</span></div>
            <div class="result-meta__item"><span class="result-meta__label">P(Fake):</span><span class="result-meta__value">${r.probability_fake.toFixed(4)}</span></div>
          </div>
        </div>
        ${explanationHtml}
      </div>
    `;
  },

  /** HTML-escape a string to prevent XSS in rendered text */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
