/**
 * Veracity AI — Overview Page
 *
 * Displays KPI cards, training curves, model summary, and per-dataset comparisons.
 */

const OverviewPage = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Dashboard Overview</h1>
        <p>At-a-glance performance metrics and model insights</p>
      </div>
      <div class="kpi-grid" id="kpi-grid"><div class="loading-state"><div class="spinner"></div><span>Loading metrics...</span></div></div>
      <div class="grid-2">
        <div class="card"><div class="card__title">Training Curves</div><div id="training-chart" style="height:350px;"></div></div>
        <div class="card"><div class="card__title">Dataset Comparison</div><div id="comparison-chart" style="height:350px;"></div></div>
      </div>
      <div class="card" style="margin-top:var(--space-6);">
        <div class="card__title">Model Architecture</div>
        <div id="model-summary"></div>
      </div>
    `;

    try {
      const [evalData, trainingLog] = await Promise.all([
        API.get('/api/evaluation'),
        API.get('/api/training-log'),
      ]);

      this._renderKPIs(evalData);
      this._renderTrainingChart(trainingLog);
      this._renderComparisonChart(evalData);
      this._renderModelSummary();
    } catch (err) {
      container.innerHTML += `<div class="card" style="color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _renderKPIs(data) {
    const combined = data.combined || data.Combined || {};
    const metrics = [
      { icon: '🎯', value: ((combined.accuracy || 0) * 100).toFixed(1) + '%', label: 'Accuracy' },
      { icon: '📊', value: (combined.f1_binary || 0).toFixed(4), label: 'F1 Score' },
      { icon: '📈', value: (combined.auc_roc || 0).toFixed(4), label: 'AUC-ROC' },
      { icon: '🔬', value: (combined.mcc || 0).toFixed(4), label: 'MCC' },
    ];

    document.getElementById('kpi-grid').innerHTML = metrics.map(m => `
      <div class="kpi-card">
        <div class="kpi-card__icon">${m.icon}</div>
        <div class="kpi-card__value">${m.value}</div>
        <div class="kpi-card__label">${m.label}</div>
      </div>
    `).join('');
  },

  _renderTrainingChart(log) {
    const epochs = log.map(e => e.epoch);
    const chartFn = () => ({
      data: [
        { x: epochs, y: log.map(e => e.train_loss), name: 'Train Loss', line: { color: Charts.colors.blue } },
        { x: epochs, y: log.map(e => e.val_loss), name: 'Val Loss', line: { color: Charts.colors.red } },
        { x: epochs, y: log.map(e => e.val_acc), name: 'Val Accuracy', line: { color: Charts.colors.green }, yaxis: 'y2' },
      ],
      layout: Charts.getLayout('', {
        xaxis: { title: 'Epoch' },
        yaxis: { title: 'Loss' },
        yaxis2: { title: 'Accuracy', overlaying: 'y', side: 'right', range: [0, 1] },
        annotations: [{
          x: 3, y: log[2]?.val_loss || 0, text: '⭐ Best Model', showarrow: true,
          arrowhead: 2, ax: 40, ay: -40, font: { color: Charts.colors.green, size: 12 },
        }],
      }),
    });
    const { data, layout } = chartFn();
    Charts.render('training-chart', data, layout, chartFn);
  },

  _renderComparisonChart(evalData) {
    const groups = Object.keys(evalData).filter(k => k !== 'combined' && k !== 'Combined');
    const chartFn = () => ({
      data: [
        {
          x: groups, y: groups.map(g => (evalData[g].accuracy || 0) * 100),
          name: 'Accuracy', type: 'bar', marker: { color: Charts.colors.accent },
        },
        {
          x: groups, y: groups.map(g => (evalData[g].f1_binary || 0) * 100),
          name: 'F1', type: 'bar', marker: { color: Charts.colors.blue },
        },
        {
          x: groups, y: groups.map(g => (evalData[g].auc_roc || 0) * 100),
          name: 'AUC', type: 'bar', marker: { color: Charts.colors.green },
        },
      ],
      layout: Charts.getLayout('', { barmode: 'group', yaxis: { title: '% Score', range: [0, 100] } }),
    });
    const { data, layout } = chartFn();
    Charts.render('comparison-chart', data, layout, chartFn);
  },

  _renderModelSummary() {
    document.getElementById('model-summary').innerHTML = `
      <div class="grid-3" style="gap:var(--space-4);">
        <div class="info-card">
          <h3>🧠 Text Branch</h3>
          <p>mBERT (bert-base-multilingual-cased) → 768-dim CLS pooler → Linear projection to 512-dim. Supports both English and Chinese text.</p>
        </div>
        <div class="info-card">
          <h3>🖼️ Image Branch</h3>
          <p>ResNet-50 (ImageNet V2 weights) → 2048-dim features → Linear projection to 512-dim. Only layer4 is fine-tuned; earlier layers frozen.</p>
        </div>
        <div class="info-card">
          <h3>🔗 Fusion</h3>
          <p>8-head Cross-Attention (text → image) + Gated fusion with KG embedding (300-dim zero-vector). Final classifier: 512 → 128 → 2.</p>
        </div>
      </div>
    `;
  },
};
