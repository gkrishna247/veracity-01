/**
 * Veracity AI — Chart Utilities
 *
 * Provides Plotly.js configuration helpers that automatically
 * adapt to the current dark/light theme.
 */

const Charts = {
  /** Track all rendered chart div IDs for theme updates. */
  _chartIds: [],

  /**
   * Get Plotly layout configuration matching the current theme.
   * @param {string} title - Chart title
   * @param {Object} [overrides] - Additional layout properties
   * @returns {Object} Plotly layout config
   */
  getLayout(title = '', overrides = {}) {
    const isLight = Theme.isLight();
    const textColor = isLight ? '#0f172a' : '#f1f5f9';
    const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.1)';
    const bgColor = 'rgba(0,0,0,0)'; // transparent

    return {
      title: { text: title, font: { color: textColor, size: 16, family: 'Inter' } },
      font: { color: textColor, family: 'Inter' },
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      xaxis: {
        gridcolor: gridColor,
        zerolinecolor: gridColor,
        tickfont: { color: textColor, size: 11 },
        ...(overrides.xaxis || {}),
      },
      yaxis: {
        gridcolor: gridColor,
        zerolinecolor: gridColor,
        tickfont: { color: textColor, size: 11 },
        ...(overrides.yaxis || {}),
      },
      legend: {
        font: { color: textColor, size: 12 },
        bgcolor: 'rgba(0,0,0,0)',
        ...(overrides.legend || {}),
      },
      margin: { t: title ? 50 : 20, r: 20, b: 50, l: 60, ...(overrides.margin || {}) },
      ...overrides,
    };
  },

  /**
   * Get Plotly config (toolbar, responsive, etc.)
   * @returns {Object} Plotly config
   */
  getConfig() {
    return {
      responsive: true,
      displayModeBar: false,
    };
  },

  /**
   * Color palette for chart traces.
   */
  colors: {
    accent: '#6c63ff',
    blue: '#3b82f6',
    green: '#10b981',
    red: '#ef4444',
    yellow: '#f59e0b',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899',
  },

  /**
   * Render a Plotly chart and track it for theme updates.
   * @param {string} divId - DOM element ID
   * @param {Array} data - Plotly trace data
   * @param {Object} layout - Plotly layout
   * @param {Function} [dataFn] - Function that returns fresh data/layout for re-render
   */
  render(divId, data, layout, dataFn = null) {
    const el = document.getElementById(divId);
    if (!el) return;

    Plotly.newPlot(el, data, layout, this.getConfig());

    // Track for theme re-renders
    if (!this._chartIds.includes(divId)) {
      this._chartIds.push(divId);
    }
    if (dataFn) {
      el._chartDataFn = dataFn;
    }
  },

  /**
   * Re-render all tracked charts when theme changes.
   */
  updateAllCharts() {
    for (const id of this._chartIds) {
      const el = document.getElementById(id);
      if (el && el._chartDataFn) {
        const { data, layout } = el._chartDataFn();
        Plotly.react(el, data, layout, this.getConfig());
      } else if (el) {
        // Just update layout colors
        Plotly.relayout(el, this.getLayout());
      }
    }
  },

  /** Clear tracked charts (call when navigating away). */
  clearTracked() {
    this._chartIds = [];
  },
};
