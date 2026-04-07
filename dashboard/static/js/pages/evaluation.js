/**
 * Veracity AI — Evaluation Page
 */

const EvaluationPage = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Model Evaluation</h1>
        <p>Comprehensive performance metrics across all evaluation groups</p>
      </div>
      <div id="eval-content"><div class="loading-state"><div class="spinner"></div><span>Loading evaluation data...</span></div></div>
    `;

    try {
      const data = await API.get('/api/evaluation');
      this._render(data);
    } catch (err) {
      document.getElementById('eval-content').innerHTML = `<div class="card" style="color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _render(data) {
    const groups = Object.keys(data);
    const metrics = ['accuracy', 'f1_binary', 'f1_macro', 'f1_weighted', 'precision_binary', 'recall_binary', 'auc_roc', 'mcc', 'cohen_kappa'];
    const metricLabels = ['Accuracy', 'F1 Binary', 'F1 Macro', 'F1 Weighted', 'Precision', 'Recall', 'AUC-ROC', 'MCC', "Cohen's κ"];

    const headerCells = metricLabels.map(m => `<th>${m}</th>`).join('');
    const rows = groups.map(g => {
      const d = data[g];
      const cells = metrics.map(m => {
        const v = d[m];
        return `<td>${typeof v === 'number' && !isNaN(v) ? v.toFixed(4) : '—'}</td>`;
      }).join('');
      return `<tr><td><strong>${g}</strong></td><td>${d.n_samples || '—'}</td>${cells}</tr>`;
    }).join('');

    document.getElementById('eval-content').innerHTML = `
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">Metrics Table</div>
        <div class="table-container">
          <table class="data-table"><thead><tr><th>Group</th><th>N</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">Performance Comparison</div>
        <div id="eval-chart" style="height:400px;"></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card__title">Confusion Matrices</div><img src="/evaluation-static/confusion_matrices_all.png" alt="Confusion Matrices" style="width:100%;border-radius:var(--radius-md);"></div>
        <div class="card"><div class="card__title">ROC Curves</div><img src="/evaluation-static/roc_curves_all.png" alt="ROC Curves" style="width:100%;border-radius:var(--radius-md);"></div>
      </div>
    `;

    const chartFn = () => ({
      data: [
        { x: groups, y: groups.map(g => data[g].accuracy || 0), name: 'Accuracy', type: 'bar', marker: { color: Charts.colors.accent } },
        { x: groups, y: groups.map(g => data[g].f1_binary || 0), name: 'F1', type: 'bar', marker: { color: Charts.colors.blue } },
        { x: groups, y: groups.map(g => data[g].auc_roc || 0), name: 'AUC-ROC', type: 'bar', marker: { color: Charts.colors.green } },
      ],
      layout: Charts.getLayout('', { barmode: 'group', yaxis: { title: 'Score', range: [0, 1] } }),
    });
    const { data: d, layout } = chartFn();
    Charts.render('eval-chart', d, layout, chartFn);
  },
};
