/* ============================================================
   RoadSoS NEXUS — Digital Twin Visualization
   Canvas render of the simulated road network + moving ambulance,
   polled from the real /api/digital-twin endpoint (see backend/digital_twin.py).
   ============================================================ */

const DigitalTwin = (() => {
  let canvas, ctx, pollTimer;
  let bounds = null;

  function project(lat, lon, w, h) {
    if (!bounds) return [w / 2, h / 2];
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (w - 60) + 30;
    const y = h - (((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (h - 60) + 30);
    return [x, y];
  }

  function computeBounds(nodes) {
    const lats = Object.values(nodes).map(n => n[0]);
    const lons = Object.values(nodes).map(n => n[1]);
    bounds = { minLat: Math.min(...lats) - 0.005, maxLat: Math.max(...lats) + 0.005, minLon: Math.min(...lons) - 0.005, maxLon: Math.max(...lons) + 0.005 };
  }

  function draw(state) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // grid background
    ctx.strokeStyle = 'rgba(17,24,39,0.05)';
    for (let gx = 0; gx < w; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    if (!bounds) computeBounds(state.nodes);

    // road edges
    ctx.strokeStyle = 'rgba(37,99,235,0.45)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    state.edges.forEach(([a, b]) => {
      const [x1, y1] = project(...state.nodes[a], w, h);
      const [x2, y2] = project(...state.nodes[b], w, h);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });

    // nodes
    Object.entries(state.nodes).forEach(([id, latlon]) => {
      const [x, y] = project(...latlon, w, h);
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // traffic lights
    state.traffic_lights.forEach(tl => {
      const [x, y] = project(tl.lat, tl.lon, w, h);
      ctx.fillStyle = tl.phase === 'green' ? '#22C55E' : '#EF4444';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // ambulance
    const [ax, ay] = project(state.ambulance_position.lat, state.ambulance_position.lon, w, h);
    ctx.font = '22px sans-serif';
    ctx.shadowColor = 'rgba(239,68,68,0.5)'; ctx.shadowBlur = 14;
    ctx.fillText('🚑', ax - 11, ay + 8);
    ctx.shadowBlur = 0;

    // progress ring
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ax, ay, 16, -Math.PI / 2, -Math.PI / 2 + (state.route_progress_pct / 100) * Math.PI * 2);
    ctx.stroke();
  }

  async function poll(incLat, incLon, hospLat, hospLon, onUpdate) {
    try {
      const state = await API.getDigitalTwin(incLat, incLon, hospLat, hospLon);
      draw(state);
      if (onUpdate) onUpdate(state);
    } catch (e) { console.error('digital twin poll failed', e); }
  }

  function start(canvasEl, incLat, incLon, hospLat, hospLon, onUpdate) {
    canvas = canvasEl; ctx = canvas.getContext('2d');
    bounds = null;
    stop();
    poll(incLat, incLon, hospLat, hospLon, onUpdate);
    pollTimer = setInterval(() => poll(incLat, incLon, hospLat, hospLon, onUpdate), 1200);
  }

  function stop() { if (pollTimer) clearInterval(pollTimer); }

  return { start, stop };
})();
