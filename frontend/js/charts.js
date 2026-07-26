/* ============================================================
   RoadSoS NEXUS — Charts Module (Chart.js)
   All charts render from real /api/analytics data — an empty
   database legitimately shows empty charts (see README).
   ============================================================ */

const ChartsModule = (() => {
  const palette = { red: '#EF4444', cyan: '#2563EB', green: '#22C55E', yellow: '#F59E0B', purple: '#8B5CF6', muted: '#9CA3AF' };
  let instances = {};

  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  function baseOptions(extra = {}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: { legend: { labels: { color: '#6B7280', font: { size: 11, family: 'Inter' } } } },
      scales: {
        x: { ticks: { color: '#6B7280', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(17,24,39,0.06)' } },
        y: { ticks: { color: '#6B7280', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(17,24,39,0.06)' } },
      },
    }, extra);
  }

  function severityDonut(ctx, dist) {
    destroy('severity');
    const labels = Object.keys(dist);
    const data = Object.values(dist);
    const colors = labels.map(l => ({ CRITICAL: palette.red, SERIOUS: palette.yellow, MINOR: palette.green, UNKNOWN: palette.muted }[l] || palette.cyan));
    instances.severity = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 700 }, plugins: { legend: { position: 'bottom', labels: { color: '#6B7280', font: { size: 11, family: 'Inter' } } } }, cutout: '68%' },
    });
  }

  function riskBar(ctx, dist) {
    destroy('risk');
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const labels = order.filter(o => dist[o] !== undefined);
    const data = labels.map(l => dist[l]);
    const colors = labels.map(l => ({ LOW: palette.green, MEDIUM: palette.cyan, HIGH: palette.yellow, CRITICAL: palette.red }[l]));
    instances.risk = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 40 }] },
      options: baseOptions({ plugins: { legend: { display: false } } }),
    });
  }

  function languageBar(ctx, usage) {
    destroy('lang');
    const labels = Object.keys(usage);
    const data = Object.values(usage);
    instances.lang = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Reports', data, backgroundColor: palette.cyan, borderRadius: 6, maxBarThickness: 28 }] },
      options: baseOptions({ indexAxis: 'y', plugins: { legend: { display: false } } }),
    });
  }

  function timelineLine(ctx, timeline) {
    destroy('timeline');
    const labels = timeline.map(t => t.day);
    const data = timeline.map(t => t.count);
    instances.timeline = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Incidents', data, borderColor: palette.red, backgroundColor: 'rgba(255,59,92,0.12)', fill: true, tension: 0.35, pointBackgroundColor: palette.red }] },
      options: baseOptions({ plugins: { legend: { display: false } } }),
    });
  }

  function gauge(ctx, value, max, color) {
    const id = ctx.canvas.id;
    destroy(id);
    instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [value, Math.max(max - value, 0)],
          backgroundColor: [color, '#EEF0F3'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  }

  function hospitalStatsBar(ctx, stats) {
    destroy('hospStats');
    const labels = stats.map(s => s.hospital);
    const data = stats.map(s => s.incidents);
    instances.hospStats = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Incidents Routed', data, backgroundColor: palette.green, borderRadius: 6, maxBarThickness: 26 }] },
      options: baseOptions({ indexAxis: 'y', plugins: { legend: { display: false } } }),
    });
  }

  return { severityDonut, riskBar, languageBar, timelineLine, gauge, hospitalStatsBar };
})();
