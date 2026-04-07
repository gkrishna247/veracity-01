/**
 * Veracity AI — History Page
 */

const HistoryPage = {
  currentPage: 1,
  limit: 20,

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Prediction History</h1>
        <p>All past predictions, most recent first</p>
      </div>
      <div id="history-content"><div class="loading-state"><div class="spinner"></div><span>Loading history...</span></div></div>
    `;
    await this.loadPage(1);
  },

  async loadPage(page) {
    this.currentPage = page;
    try {
      const data = await API.get(`/api/history?page=${page}&limit=${this.limit}`);
      this._renderTable(data);
    } catch (err) {
      document.getElementById('history-content').innerHTML = `<div class="card" style="color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _renderTable(data) {
    if (data.total === 0) {
      document.getElementById('history-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📜</div>
          <div class="empty-state__title">No predictions yet</div>
          <div class="empty-state__text">Try the <a href="#/predict">Predict</a> page to make your first prediction!</div>
        </div>
      `;
      return;
    }

    const typeName = { gossipcop_text: 'GC Text', weibo_text: 'WB Text', weibo_image: 'WB Img', weibo_both: 'WB Both' };
    const rows = data.items.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${formatTimestamp(item.timestamp)}</td>
        <td>${createBadge(typeName[item.input_type] || item.input_type, 'type')}</td>
        <td>${createBadge(item.prediction_type === 'batch' ? 'Batch' : 'Single', 'type')}</td>
        <td title="${item.text_preview || ''}">${(item.text_preview || '—').substring(0, 60)}${(item.text_preview || '').length > 60 ? '...' : ''}</td>
        <td>${createBadge(item.prediction)}</td>
        <td>${item.confidence.toFixed(1)}%</td>
        <td><button class="btn btn-ghost btn-sm" onclick="HistoryPage.delete(${item.id})">🗑️</button></td>
      </tr>
    `).join('');

    const totalPages = Math.ceil(data.total / this.limit);
    let pagination = '<div class="pagination">';
    pagination += `<button class="pagination__btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="HistoryPage.loadPage(${this.currentPage - 1})">← Prev</button>`;
    pagination += `<span class="pagination__info">Page ${this.currentPage} of ${totalPages} (${data.total} total)</span>`;
    pagination += `<button class="pagination__btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="HistoryPage.loadPage(${this.currentPage + 1})">Next →</button>`;
    pagination += '</div>';

    document.getElementById('history-content').innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Timestamp</th><th>Type</th><th>Mode</th><th>Text</th><th>Result</th><th>Conf</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${pagination}
    `;
  },

  async delete(id) {
    if (!confirm(`Delete prediction #${id}?`)) return;
    try {
      await API.delete(`/api/history/${id}`);
      await this.loadPage(this.currentPage);
    } catch (err) { alert('Delete failed: ' + err.message); }
  },
};
