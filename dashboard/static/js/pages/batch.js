/**
 * Veracity AI — Batch Prediction Page
 */

const BatchPage = {
  render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Batch Prediction</h1>
        <p>Upload a CSV file with a "text" column for bulk classification</p>
      </div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Language</label>
          <select class="select" id="batch-lang" style="max-width:300px;">
            <option value="en">English (GossipCop-style)</option>
            <option value="zh">Chinese (Weibo-style)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Upload CSV</label>
          <div class="file-upload-zone" id="csv-drop-zone">
            <div class="file-upload-zone__icon">📄</div>
            <div class="file-upload-zone__text" id="csv-filename">Drop CSV here or click to upload</div>
            <div class="file-upload-zone__hint">CSV with single column "text"</div>
            <input type="file" id="csv-input" accept=".csv">
          </div>
        </div>
        <button class="btn btn-primary" id="batch-btn" onclick="BatchPage.submit()">📦 Analyze Batch</button>
      </div>
      <div id="batch-result"></div>
    `;
    this._setupUpload();
  },

  _file: null,

  _setupUpload() {
    const zone = document.getElementById('csv-drop-zone');
    const input = document.getElementById('csv-input');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) { this._file = e.dataTransfer.files[0]; document.getElementById('csv-filename').textContent = this._file.name; } });
    input.addEventListener('change', () => { if (input.files[0]) { this._file = input.files[0]; document.getElementById('csv-filename').textContent = this._file.name; } });
  },

  async submit() {
    if (!this._file) { alert('Please upload a CSV file.'); return; }
    const lang = document.getElementById('batch-lang').value;
    const btn = document.getElementById('batch-btn');
    const resultDiv = document.getElementById('batch-result');

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Processing...';
    resultDiv.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Running batch predictions...</span></div>';

    try {
      const formData = new FormData();
      formData.append('file', this._file);
      formData.append('lang', lang);
      const result = await API.postForm('/api/predict/batch', formData);
      this._renderResult(result);
    } catch (err) {
      resultDiv.innerHTML = `<div class="card" style="color:var(--danger);margin-top:var(--space-6);">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📦 Analyze Batch';
    }
  },

  _renderResult(r) {
    const s = r.summary;
    const rows = r.results.map(row => `
      <tr>
        <td>${row.row}</td>
        <td title="${row.text_preview}">${row.text_preview.substring(0, 80)}${row.text_preview.length > 80 ? '...' : ''}</td>
        <td>${createBadge(row.prediction)}</td>
        <td>${row.confidence.toFixed(1)}%</td>
        <td>${row.probability_real.toFixed(4)}</td>
        <td>${row.probability_fake.toFixed(4)}</td>
      </tr>
    `).join('');

    document.getElementById('batch-result').innerHTML = `
      <div class="summary-grid" style="margin-top:var(--space-6);">
        <div class="summary-card"><div class="summary-card__value">${s.total}</div><div class="summary-card__label">Total Rows</div></div>
        <div class="summary-card"><div class="summary-card__value" style="color:var(--success)">${s.real_count} (${s.real_percentage}%)</div><div class="summary-card__label">Real</div></div>
        <div class="summary-card"><div class="summary-card__value" style="color:var(--danger)">${s.fake_count} (${s.fake_percentage}%)</div><div class="summary-card__label">Fake</div></div>
        <div class="summary-card"><div class="summary-card__value">${s.avg_confidence.toFixed(1)}%</div><div class="summary-card__label">Avg Confidence</div></div>
        <div class="summary-card"><div class="summary-card__value">${s.threshold}</div><div class="summary-card__label">Threshold</div></div>
      </div>
      <div class="grid-2" style="margin-bottom:var(--space-6);">
        <div class="card"><div class="card__title">Distribution</div><div id="batch-chart" style="height:280px;"></div></div>
        <div class="card"><div class="card__title">Results Table</div>
          <div class="table-container" style="max-height:280px;overflow-y:auto;">
            <table class="data-table">
              <thead><tr><th>#</th><th>Text</th><th>Label</th><th>Conf</th><th>P(Real)</th><th>P(Fake)</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const chartFn = () => ({
      data: [{ values: [s.real_count, s.fake_count], labels: ['Real', 'Fake'], type: 'pie', hole: 0.5, marker: { colors: [Charts.colors.green, Charts.colors.red] }, textinfo: 'label+percent', textfont: { size: 14 } }],
      layout: Charts.getLayout('', { margin: { t: 10, b: 10, l: 10, r: 10 }, showlegend: false }),
    });
    const { data, layout } = chartFn();
    Charts.render('batch-chart', data, layout, chartFn);
  },
};
