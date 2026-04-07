/**
 * Veracity AI — App Initialization
 *
 * Boots up the application: initializes theme, sidebar toggle,
 * modal handling, and starts the router.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Theme ────────────────────────────────────────────────────────────
  Theme.init();
  document.getElementById('theme-toggle').addEventListener('click', () => {
    Theme.toggle();
  });

  // ── Sidebar Toggle ──────────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // ── Modal Close ─────────────────────────────────────────────────────
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');

  modalClose.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    document.getElementById('modal-body').innerHTML = '';
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
      document.getElementById('modal-body').innerHTML = '';
    }
  });

  // ── Start Router ────────────────────────────────────────────────────
  Router.init();
});

/**
 * Helper: Open a modal with the given HTML content.
 * @param {string} html - Inner HTML for the modal body
 */
function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}

/**
 * Helper: Create a confidence gauge SVG.
 * @param {number} confidence - Confidence percentage (0–100)
 * @param {string} prediction - 'Real' or 'Fake'
 * @returns {string} SVG HTML string
 */
function createGauge(confidence, prediction) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (confidence / 100) * circumference;
  const color = prediction === 'Real' ? 'var(--success)' : 'var(--danger)';

  return `
    <div class="gauge-container">
      <svg width="120" height="120" class="gauge-svg">
        <circle cx="60" cy="60" r="45" class="gauge-bg" />
        <circle cx="60" cy="60" r="45" class="gauge-fill"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}" />
        <text x="60" y="60" class="gauge-text">${confidence.toFixed(1)}%</text>
      </svg>
      <span class="gauge-label">${prediction}</span>
    </div>
  `;
}

/**
 * Helper: Create a badge HTML.
 * @param {string} label - 'Real', 'Fake', or any string
 * @param {string} [type] - 'real', 'fake', or 'type'
 * @returns {string} Badge HTML
 */
function createBadge(label, type = null) {
  const cls = type || (label.toLowerCase() === 'real' ? 'real' : label.toLowerCase() === 'fake' ? 'fake' : 'type');
  return `<span class="badge badge-${cls}">${label}</span>`;
}

/**
 * Helper: Format an ISO timestamp to a readable string.
 * @param {string} iso - ISO 8601 timestamp
 * @returns {string} Formatted date/time
 */
function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
