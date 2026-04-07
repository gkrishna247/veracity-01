/**
 * Veracity AI — Adversarial Page
 */

const AdversarialPage = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Adversarial Robustness</h1>
        <p>Model resilience against adversarial attacks</p>
      </div>
      <div id="adv-content"><div class="loading-state"><div class="spinner"></div><span>Loading...</span></div></div>
    `;

    try {
      const data = await API.get('/api/adversarial');
      this._render(data);
    } catch (err) {
      document.getElementById('adv-content').innerHTML = `<div class="card" style="color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _render(data) {
    const clean = data.clean_accuracy || data.Clean || 0;
    const fgsm = data.fgsm_accuracy || data.FGSM || 0;
    const pgd = data.pgd_accuracy || data.PGD || 0;
    const fgsmDrop = clean - fgsm;
    const pgdDrop = clean - pgd;

    document.getElementById('adv-content').innerHTML = `
      <div class="summary-grid" style="margin-bottom:var(--space-6);">
        <div class="summary-card"><div class="summary-card__value" style="color:var(--success)">${(clean * 100).toFixed(1)}%</div><div class="summary-card__label">Clean Accuracy</div></div>
        <div class="summary-card"><div class="summary-card__value" style="color:var(--warning)">${(fgsm * 100).toFixed(1)}%</div><div class="summary-card__label">FGSM Accuracy</div></div>
        <div class="summary-card"><div class="summary-card__value" style="color:var(--danger)">${(pgd * 100).toFixed(1)}%</div><div class="summary-card__label">PGD Accuracy</div></div>
        <div class="summary-card"><div class="summary-card__value">↓${(fgsmDrop * 100).toFixed(1)}%</div><div class="summary-card__label">FGSM Drop</div></div>
        <div class="summary-card"><div class="summary-card__value">↓${(pgdDrop * 100).toFixed(1)}%</div><div class="summary-card__label">PGD Drop</div></div>
      </div>
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">Accuracy Under Attack</div>
        <div id="adv-chart" style="height:300px;"></div>
      </div>
      <div class="grid-2">
        <div class="info-card">
          <h3>⚡ FGSM (Fast Gradient Sign Method)</h3>
          <p>A single-step attack that perturbs input images by adding noise in the direction of the loss gradient. Fast but less powerful. Uses ε=0.008.</p>
        </div>
        <div class="info-card">
          <h3>🔄 PGD (Projected Gradient Descent)</h3>
          <p>A multi-step iterative attack (7 iterations) that applies small perturbations within an ε-ball. More powerful than FGSM. Uses ε=0.016.</p>
        </div>
      </div>
    `;

    const chartFn = () => ({
      data: [{
        x: ['Clean', 'FGSM', 'PGD'],
        y: [clean * 100, fgsm * 100, pgd * 100],
        type: 'bar',
        marker: { color: [Charts.colors.green, Charts.colors.yellow, Charts.colors.red] },
        text: [`${(clean * 100).toFixed(1)}%`, `${(fgsm * 100).toFixed(1)}%`, `${(pgd * 100).toFixed(1)}%`],
        textposition: 'outside',
      }],
      layout: Charts.getLayout('', { yaxis: { title: 'Accuracy %', range: [0, 100] }, showlegend: false }),
    });
    const { data: d, layout } = chartFn();
    Charts.render('adv-chart', d, layout, chartFn);
  },
};
