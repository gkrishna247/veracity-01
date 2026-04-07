/**
 * Veracity AI — Dataset Explorer Page
 */

const DatasetPage = {
  activeTab: 'gossipcop',
  currentPage: 1,
  currentLabel: 'all',

  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Dataset Explorer</h1>
        <p>Browse the GossipCop and Weibo training datasets</p>
      </div>
      <div class="flex-between" style="margin-bottom:var(--space-6);flex-wrap:wrap;gap:var(--space-4);">
        <div class="tabs" style="max-width:400px;">
          <button class="tab-btn active" id="tab-gossipcop" onclick="DatasetPage.switchTab('gossipcop')">GossipCop</button>
          <button class="tab-btn" id="tab-weibo" onclick="DatasetPage.switchTab('weibo')">Weibo</button>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center;">
          <label class="form-label" style="margin:0;">Filter:</label>
          <select class="select" id="dataset-label-filter" style="width:auto;" onchange="DatasetPage.onFilterChange()">
            <option value="all">All</option>
            <option value="real">Real</option>
            <option value="fake">Fake</option>
          </select>
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:var(--space-6);">
        <div class="card"><div class="card__title">Label Distribution</div><div id="dist-chart" style="height:250px;"></div></div>
        <div id="data-cards"><div class="loading-state"><div class="spinner"></div></div></div>
      </div>
      <div id="data-pagination"></div>
    `;
    await this._loadStats();
    await this.loadData(1);
  },

  async switchTab(tab) {
    this.activeTab = tab;
    this.currentPage = 1;
    this.currentLabel = 'all';
    document.getElementById('dataset-label-filter').value = 'all';
    document.getElementById('tab-gossipcop').classList.toggle('active', tab === 'gossipcop');
    document.getElementById('tab-weibo').classList.toggle('active', tab === 'weibo');
    await this._loadStats();
    await this.loadData(1);
  },

  async onFilterChange() {
    this.currentLabel = document.getElementById('dataset-label-filter').value;
    this.currentPage = 1;
    await this.loadData(1);
  },

  async _loadStats() {
    try {
      const stats = await API.get('/api/dataset/stats');
      const ds = stats[this.activeTab];
      const chartFn = () => ({
        data: [{ values: [ds.real, ds.fake], labels: ['Real', 'Fake'], type: 'pie', hole: 0.5, marker: { colors: [Charts.colors.green, Charts.colors.red] }, textinfo: 'label+value+percent' }],
        layout: Charts.getLayout('', { margin: { t: 10, b: 10, l: 10, r: 10 }, showlegend: true }),
      });
      const { data, layout } = chartFn();
      Charts.render('dist-chart', data, layout, chartFn);
    } catch (err) { /* silent */ }
  },

  async loadData(page) {
    this.currentPage = page;
    const endpoint = `/api/dataset/${this.activeTab}?page=${page}&limit=20&label=${this.currentLabel}`;
    try {
      const data = await API.get(endpoint);
      this._renderCards(data);
    } catch (err) {
      document.getElementById('data-cards').innerHTML = `<div class="card" style="color:var(--danger);">Error loading data</div>`;
    }
  },

  _renderCards(data) {
    const isGC = this.activeTab === 'gossipcop';
    const cards = data.items.map(item => {
      const label = isGC ? item.label : (item.label === 0 ? 'real' : 'fake');
      const text = isGC ? (item.title || item.text_preview || '') : (item.tweet_content_preview || '');
      return `
        <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-3);">
          <div class="flex-between" style="margin-bottom:var(--space-2);">
            ${createBadge(label === 'real' || label === 0 ? 'Real' : 'Fake')}
            <span style="font-size:var(--text-xs);color:var(--text-muted);">${isGC ? item.id : `#${item.tweet_id}`}</span>
          </div>
          <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5;">${text.substring(0, 200)}${text.length > 200 ? '...' : ''}</p>
        </div>
      `;
    }).join('');

    document.getElementById('data-cards').innerHTML = cards || '<div class="empty-state"><div class="empty-state__text">No items found.</div></div>';

    const totalPages = Math.ceil(data.total / 20);
    document.getElementById('data-pagination').innerHTML = `
      <div class="pagination">
        <button class="pagination__btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="DatasetPage.loadData(${this.currentPage - 1})">← Prev</button>
        <span class="pagination__info">Page ${this.currentPage} of ${totalPages} (${data.total} total)</span>
        <button class="pagination__btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="DatasetPage.loadData(${this.currentPage + 1})">Next →</button>
      </div>
    `;
  },
};
