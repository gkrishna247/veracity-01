/**
 * Veracity AI — Theme Manager
 *
 * Handles dark/light mode toggle with localStorage persistence.
 * Dark mode is the default.
 */

const Theme = {
  STORAGE_KEY: 'veracity-theme',

  /** Initialize theme from localStorage or default to dark. */
  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'light') {
      document.body.classList.add('light-mode');
    }
    this._updateIcon();
  },

  /** Toggle between dark and light mode. */
  toggle() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem(this.STORAGE_KEY, isLight ? 'light' : 'dark');
    this._updateIcon();

    // Re-render Plotly charts with updated theme
    Charts.updateAllCharts();
  },

  /** @returns {boolean} True if currently in light mode. */
  isLight() {
    return document.body.classList.contains('light-mode');
  },

  /** Update the toggle button icon. */
  _updateIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.textContent = this.isLight() ? '☀️' : '🌙';
    }
  },
};
