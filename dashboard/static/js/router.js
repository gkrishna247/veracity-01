/**
 * Veracity AI — Client-Side Router
 *
 * Hash-based SPA router that maps URL fragments to page render functions.
 * Handles navigation, active sidebar state, and page transitions.
 */

const Router = {
  /** Page registry: hash → render function */
  routes: {
    'overview':       () => OverviewPage.render(),
    'predict':        () => PredictPage.render(),
    'batch':          () => BatchPage.render(),
    'history':        () => HistoryPage.render(),
    'evaluation':     () => EvaluationPage.render(),
    'adversarial':    () => AdversarialPage.render(),
    'explainability': () => ExplainabilityPage.render(),
    'dataset':        () => DatasetPage.render(),
    'training':       () => TrainingPage.render(),
  },

  /** Initialize the router. */
  init() {
    window.addEventListener('hashchange', () => this.navigate());
    this.navigate();
  },

  /** Parse current hash and render the corresponding page. */
  navigate() {
    const hash = window.location.hash.replace('#/', '') || 'overview';
    const page = hash.split('?')[0]; // Strip query params

    // Clear tracked charts from previous page
    Charts.clearTracked();

    // Render page
    const renderFn = this.routes[page];
    if (renderFn) {
      renderFn();
    } else {
      this._render404(page);
    }

    // Update active sidebar item
    this._updateSidebar(page);
  },

  /** Highlight the active nav item in the sidebar. */
  _updateSidebar(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  /** Show a 404 page for unknown routes. */
  _render404(page) {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">Page Not Found</div>
        <div class="empty-state__text">No page found for "${page}"</div>
      </div>
    `;
  },
};
