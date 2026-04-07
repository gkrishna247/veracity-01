/**
 * Veracity AI — Training Page
 */

const TrainingPage = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1>Training History</h1>
        <p>Epoch-by-epoch training progression and metrics</p>
      </div>
      <div id="train-content"><div class="loading-state"><div class="spinner"></div><span>Loading training data...</span></div></div>
    `;

    try {
      const data = await API.get('/api/training-log');
      this._render(data);
    } catch (err) {
      document.getElementById('train-content').innerHTML = `<div class="card" style="color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _render(log) {
    const epochs = log.map(e => e.epoch);
    const rows = log.map(e => `
      <tr>
        <td>${e.epoch}${e.epoch === 3 ? ' ⭐' : ''}</td>
        <td>${(e.train_loss || 0).toFixed(4)}</td>
        <td>${isNaN(e.val_loss) ? '<span style="color:var(--warning)">NaN</span>' : (e.val_loss || 0).toFixed(4)}</td>
        <td>${isNaN(e.val_acc) ? '<span style="color:var(--warning)">NaN</span>' : ((e.val_acc || 0) * 100).toFixed(2) + '%'}</td>
        <td>${(e.mean_grad_norm || 0).toFixed(3)}</td>
      </tr>
    `).join('');

    document.getElementById('train-content').innerHTML = `
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card__title">Loss & Accuracy Over Epochs</div>
        <div id="loss-chart" style="height:400px;"></div>
      </div>
      <div class="card">
        <div class="card__title">Epoch Details</div>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4);">⭐ = Best model checkpoint saved. NaN values appeared from epoch 6–8 due to training instability.</p>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Epoch</th><th>Train Loss</th><th>Val Loss</th><th>Val Accuracy</th><th>Grad Norm</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    const validLog = log.filter(e => !isNaN(e.val_loss) && !isNaN(e.val_acc));
    const chartFn = () => ({
      data: [
        { x: epochs, y: log.map(e => e.train_loss), name: 'Train Loss', line: { color: Charts.colors.blue, width: 2 } },
        { x: validLog.map(e => e.epoch), y: validLog.map(e => e.val_loss), name: 'Val Loss', line: { color: Charts.colors.red, width: 2 } },
        { x: validLog.map(e => e.epoch), y: validLog.map(e => e.val_acc), name: 'Val Accuracy', line: { color: Charts.colors.green, width: 2 }, yaxis: 'y2' },
      ],
      layout: Charts.getLayout('', {
        xaxis: { title: 'Epoch', dtick: 1 },
        yaxis: { title: 'Loss' },
        yaxis2: { title: 'Accuracy', overlaying: 'y', side: 'right', range: [0, 1] },
        annotations: [{
          x: 3, y: validLog.find(e => e.epoch === 3)?.val_loss || 0,
          text: '⭐ Best Model', showarrow: true, arrowhead: 2,
          ax: 40, ay: -40, font: { color: Charts.colors.green, size: 12 },
        }],
      }),
    });
    const { data, layout } = chartFn();
    Charts.render('loss-chart', data, layout, chartFn);
  },
};
