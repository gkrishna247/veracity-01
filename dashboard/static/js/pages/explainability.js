/**
 * Veracity AI — Explainability (XAI) Page
 */

const ExplainabilityPage = {
  render() {
    const container = document.getElementById('page-content');

    const limeCards = Array.from({ length: 20 }, (_, i) => `
      <div class="lime-card" onclick="ExplainabilityPage.viewLime(${i})">
        <div class="lime-card__number">#${i}</div>
        <div class="lime-card__label">LIME Sample</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="page-header">
        <h1>Explainability (XAI)</h1>
        <p>Understand model decisions through interpretable explanations</p>
      </div>

      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">LIME Explanations</div>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4);">Click a sample to view the full LIME explanation report. LIME highlights which words pushed the model toward 'Real' or 'Fake'.</p>
        <div class="lime-grid">${limeCards}</div>
      </div>

      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">SHAP Summary</div>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4);">SHAP (SHapley Additive exPlanations) shows the global feature importance across the dataset.</p>
        <img src="/evaluation-static/shap_summary.png" alt="SHAP Summary" style="width:100%;max-width:800px;border-radius:var(--radius-md);">
      </div>

      <div class="grid-3">
        <div class="info-card">
          <h3>📊 LIME</h3>
          <p>Local Interpretable Model-Agnostic Explanations. Perturbs input text and observes which changes affect the prediction most, identifying the most influential words.</p>
        </div>
        <div class="info-card">
          <h3>🎨 Grad-CAM</h3>
          <p>Gradient-weighted Class Activation Mapping. Uses gradients from the final convolutional layer to produce a heatmap showing which image regions influenced the prediction.</p>
        </div>
        <div class="info-card">
          <h3>🔬 SHAP</h3>
          <p>Assigns each feature a Shapley value from cooperative game theory. Provides both local (per-sample) and global (across dataset) feature importance rankings.</p>
        </div>
      </div>
    `;
  },

  async viewLime(sampleId) {
    try {
      const html = await API.getHtml(`/api/lime/${sampleId}`);
      openModal(`<div style="padding:var(--space-4);"><iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%;height:70vh;border:none;border-radius:var(--radius-md);background:white;"></iframe></div>`);
    } catch (err) {
      alert('Failed to load LIME report: ' + err.message);
    }
  },
};
