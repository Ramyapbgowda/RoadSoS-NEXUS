/* ============================================================
   RoadSoS NEXUS — Main App Controller
   ============================================================ */

let selectedLat = 12.9716, selectedLon = 77.5946;
let lastIncident = null;

// ---------------- NAVIGATION ----------------
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  navEl.classList.add('active');
  document.getElementById('page-title').textContent = navEl.textContent.trim();

  if (pageId === 'page-map') setTimeout(() => MapModule.getMap().invalidateSize(), 100);
  if (pageId === 'page-analytics') loadAnalytics();
  if (pageId === 'page-admin') loadAdminTable();
  if (pageId === 'page-hospitals') loadHospitalsPanel();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  initMap();
  initReportForm();
  initVoice();
  initAgentGrid();
  initFederated();
  initAdmin();
  initClock();
  loadDashboardStats();
  loadRecentIncidents();
  loadEventLog();

  setInterval(loadDashboardStats, 8000);
  setInterval(loadRecentIncidents, 8000);
});

// ---------------- CLOCK ----------------
function initClock() {
  const update = () => {
    const now = new Date();
    const timeEl = document.getElementById('topbar-clock');
    const dateEl = document.getElementById('topbar-date');
    if (!timeEl) return;
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    timeEl.childNodes[0].textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  };
  update();
  setInterval(update, 1000);
}

// ---------------- LOADER ----------------
function showLoader(msg) {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.className = 'loader-overlay';
    el.innerHTML = `<div class="loader-ring"></div><div class="msg">${msg}</div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector('.msg').textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoader() { const el = document.getElementById('global-loader'); if (el) el.style.display = 'none'; }

// ---------------- MAP ----------------
function initMap() {
  MapModule.init('leaflet-map');
  MapModule.loadHospitals(selectedLat, selectedLon);
  MapModule.loadPolice(selectedLat, selectedLon);
  MapModule.loadHazards(selectedLat, selectedLon);

  window.onMapClick = (lat, lon) => {
    selectedLat = lat; selectedLon = lon;
    document.getElementById('inc-lat').value = lat.toFixed(5);
    document.getElementById('inc-lon').value = lon.toFixed(5);
    document.getElementById('map-picked-note').textContent = `📍 Location picked: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    if (window.hazardReportMode) {
      const desc = prompt('Describe the hazard (e.g. "big pothole near signal"):');
      if (desc) {
        API.reportHazard(lat, lon, desc).then(() => {
          MapModule.loadHazards(lat, lon);
          notify(`Hazard reported and classified.`);
        });
      }
      window.hazardReportMode = false;
    }
  };

  document.getElementById('map-search-btn').addEventListener('click', doMapSearch);
  document.getElementById('map-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doMapSearch(); });
  document.getElementById('report-hazard-btn').addEventListener('click', () => {
    window.hazardReportMode = true;
    notify('Click anywhere on the map to report a hazard there.');
  });

  document.querySelectorAll('.layer-toggle').forEach(cb => {
    cb.addEventListener('change', () => MapModule.toggleLayer(cb.dataset.layer, cb.checked));
  });
}

async function doMapSearch() {
  const q = document.getElementById('map-search-input').value.trim();
  if (!q) return;
  const loc = await MapModule.searchLocation(q);
  if (loc) {
    selectedLat = loc.lat; selectedLon = loc.lon;
    MapModule.loadHospitals(loc.lat, loc.lon);
    MapModule.loadPolice(loc.lat, loc.lon);
    MapModule.loadHazards(loc.lat, loc.lon);
  } else {
    notify('Location not found.');
  }
}

// ---------------- TOAST ----------------
function notify(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#10151f;border:1px solid rgba(0,217,255,0.4);color:#eef1f8;padding:12px 20px;border-radius:10px;font-size:12.5px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ---------------- REPORT FORM ----------------
function initReportForm() {
  document.getElementById('inc-lat').value = selectedLat;
  document.getElementById('inc-lon').value = selectedLon;

  const fileInput = document.getElementById('inc-image');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('image-preview-wrap');
      preview.innerHTML = `<img id="preview-img" src="${e.target.result}"><canvas id="bbox-canvas"></canvas>`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitIncident();
  });
}

async function submitIncident() {
  const btn = document.getElementById('submit-btn');
  btn.classList.add('loading'); btn.disabled = true;
  showLoader('Running NEXUS 5-stage pipeline…');

  const form = new FormData();
  form.append('lat', document.getElementById('inc-lat').value);
  form.append('lon', document.getElementById('inc-lon').value);
  form.append('reported_text', document.getElementById('inc-text').value);
  form.append('emergency_contact', document.getElementById('inc-contact').value);
  form.append('vehicle_type', document.getElementById('inc-vehicle').value);
  form.append('num_victims', document.getElementById('inc-victims').value);
  form.append('weather', document.getElementById('inc-weather').value);
  form.append('road_condition', document.getElementById('inc-road').value);
  form.append('is_night', document.getElementById('inc-night').checked ? 1 : 0);
  form.append('is_raining', document.getElementById('inc-raining').checked ? 1 : 0);
  const file = document.getElementById('inc-image').files[0];
  if (file) form.append('image', file);

  try {
    const data = await API.submitIncident(form);
    lastIncident = data;
    renderPipelineOutput(data);
    if (file) drawBoundingBoxes(data.cv_severity.detections);
    MapModule.addIncidentMarker(data.lat, data.lon, data.incident_id, data.cv_severity.severity);
    await AgentViz.runSequence(document.getElementById('agent-grid'), data.orchestration.agents);
    loadDashboardStats();
    loadRecentIncidents();
    loadEventLog();
    startDigitalTwinForIncident(data);
    notify(`Incident ${data.incident_id} processed in ${data.pipeline_latency_ms} ms`);
  } catch (err) {
    notify('Error submitting incident — check console.');
    console.error(err);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
    hideLoader();
  }
}

async function renderPipelineOutput(data) {
  const nodes = ['pn-1', 'pn-2', 'pn-3', 'pn-4', 'pn-5'];
  const log = document.getElementById('pipeline-output');
  log.innerHTML = '';

  const stages = [
    { node: 'pn-1', title: 'Stage 1 — Incident Detected', body: `ID: ${data.incident_id}\nPipeline latency: ${data.pipeline_latency_ms} ms`, time: data.pipeline_latency_ms },
    { node: 'pn-2', title: 'Stage 2a — Language AI', body: `Detected: ${data.language.detected_language}\nResponse: ${data.language.response}`, time: 2.1 },
    { node: 'pn-2', title: 'Stage 2b — CV Severity AI', body: `Severity: ${data.cv_severity.severity}  ${data.cv_severity.confidence}% confidence\nDetections: ${data.cv_severity.detections.length} objects\nEst. injuries: ${data.cv_severity.estimated_injuries}  |  Fire/Smoke: ${data.cv_severity.fire_or_smoke_detected}`, time: 4.6, pill: data.cv_severity.severity },
    { node: 'pn-3', title: 'Stage 3 — Risk Analysis', body: `Risk: ${data.risk_analysis.risk_band}  ${data.risk_analysis.risk_score}% score\nTop factors: ${data.risk_analysis.top_factors.join(', ')}`, time: 3.2, pill: data.risk_analysis.risk_band },
    { node: 'pn-4', title: `Stage 4 — 9-Agent Orchestration`, body: `${Object.keys(data.orchestration.agents).join(', ')}`, time: data.orchestration.orchestration_latency_ms },
    { node: 'pn-5', title: 'Stage 5 — Dispatch & Alert Sent', body: `Hospital: ${data.orchestration.agents.Dispatch.hospital}\nETA: ${data.orchestration.agents.Dispatch.eta_minutes} min`, time: 1.8 },
  ];

  for (const stage of stages) {
    const nodeEl = document.getElementById(stage.node);
    if (nodeEl) { nodeEl.classList.add('processing'); nodeEl.classList.remove('active'); }
    await new Promise(r => setTimeout(r, 140));
    if (nodeEl) { nodeEl.classList.remove('processing'); nodeEl.classList.add('active'); }

    const div = document.createElement('div');
    div.className = 'stage-output active';
    div.innerHTML = `<h4>${stage.title}</h4><pre>${stage.body}</pre>
      <div class="stage-meta">
        <span>⏱️ ${stage.time} ms</span>
        ${stage.pill ? `<span class="pill ${stage.pill}">${stage.pill}</span>` : ''}
        <span class="done-badge">✅ AI Decision Completed</span>
      </div>`;
    log.appendChild(div);
  }

  drawGauges(data.risk_analysis.risk_score, data.cv_severity.confidence);
  loadNotificationTimeline(data.incident_id);
}

function drawBoundingBoxes(detections) {
  const img = document.getElementById('preview-img');
  const canvas = document.getElementById('bbox-canvas');
  if (!img || !canvas) return;
  const draw = () => {
    canvas.width = img.clientWidth; canvas.height = img.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = { fire: '#ff3b5c', smoke: '#8891a7', person: '#ffd23d', helmet: '#00ffa3' };
    detections.forEach(d => {
      const [x, y, w, h] = d.box;
      const px = x * canvas.width, py = y * canvas.height, pw = w * canvas.width, ph = h * canvas.height;
      ctx.strokeStyle = colors[d.class] || '#00d9ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '11px sans-serif';
      ctx.fillText(`${d.class} ${(d.confidence * 100).toFixed(0)}%`, px + 2, py - 4 < 10 ? py + 12 : py - 4);
    });
  };
  if (img.complete) draw(); else img.onload = draw;
}

function drawGauges(riskScore, cvConfidence) {
  const g1 = document.getElementById('gauge-risk');
  const g2 = document.getElementById('gauge-cv');
  if (g1) { ChartsModule.gauge(g1.getContext('2d'), riskScore, 100, riskScore > 65 ? '#ff3b5c' : riskScore > 40 ? '#ffd23d' : '#00ffa3'); document.getElementById('gauge-risk-val').textContent = riskScore + '%'; }
  if (g2) { ChartsModule.gauge(g2.getContext('2d'), cvConfidence, 100, '#00d9ff'); document.getElementById('gauge-cv-val').textContent = cvConfidence + '%'; }
}

async function loadNotificationTimeline(incidentId) {
  const events = await API.getNotifications(incidentId);
  const el = document.getElementById('notif-timeline');
  if (!el) return;
  if (!events.length) { el.innerHTML = '<p class="text-muted text-sm">No notifications yet.</p>'; return; }
  el.innerHTML = `<div class="timeline">` + events.map(e => `
    <div class="timeline-item">
      <div class="t-title">${e.channel.toUpperCase()} → ${e.to}</div>
      <div class="t-body">${e.message}</div>
      <div class="t-body" style="opacity:0.6">${e.timestamp}</div>
    </div>
  `).join('') + `</div>`;
}

function startDigitalTwinForIncident(data) {
  const hospital = data.orchestration.agents.Dispatch;
  const canvas = document.getElementById('twin-canvas');
  if (!canvas) return;
  canvas.width = canvas.clientWidth; canvas.height = 320;
  // We don't have hospital lat/lon in the response directly; reuse nearest hospital lookup via hospitals list
  API.getHospitals(data.lat, data.lon, 20).then(hospitals => {
    const match = hospitals.find(h => h.name === hospital.hospital) || hospitals[0];
    if (!match) return;
    DigitalTwin.start(canvas, data.lat, data.lon, match.lat, match.lon, (state) => {
      const etaEl = document.getElementById('twin-eta');
      if (etaEl) etaEl.textContent = `ETA ${state.eta_minutes} min · ${state.route_progress_pct}% route complete`;
    });
  });
}

// ---------------- AGENT GRID ----------------
function initAgentGrid() {
  AgentViz.renderIdle(document.getElementById('agent-grid'));
}

// ---------------- VOICE ----------------
function initVoice() {
  const select = document.getElementById('voice-lang-select');
  select.innerHTML = VoiceModule.langOptions().map(l => `<option>${l}</option>`).join('');

  const btn = document.getElementById('voice-btn');
  btn.addEventListener('click', () => {
    if (!VoiceModule.isSupported()) { notify('Speech recognition not supported — try Chrome desktop.'); return; }
    btn.textContent = '🎙️ Listening…';
    btn.disabled = true;
    VoiceModule.start(select.value, (transcript, isFinal) => {
      document.getElementById('inc-text').value = transcript;
      if (isFinal) {
        API.detectLanguage(transcript).then(r => {
          document.getElementById('voice-detected-lang').textContent = `Detected: ${r.detected_language}`;
        });
      }
    }, () => { btn.textContent = '🎙️ Speak Report'; btn.disabled = false; },
       (err) => { notify('Voice error: ' + err); btn.textContent = '🎙️ Speak Report'; btn.disabled = false; });
  });
}

// ---------------- DASHBOARD STATS ----------------
async function loadDashboardStats() {
  const stats = await API.getAnalytics();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total', stats.total_incidents);
  set('stat-today', stats.incidents_today);
  set('stat-eta', stats.avg_response_eta_minutes + ' min');
  set('stat-lives', stats.lives_saveable_estimate);
}

async function loadRecentIncidents() {
  const rows = await API.getIncidents({ limit: 8 });
  const tbody = document.getElementById('recent-incidents-body');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.incident_id}</td>
      <td><span class="pill ${r.severity}">${r.severity || '—'}</span></td>
      <td><span class="pill ${r.risk_band}">${r.risk_band || '—'}</span></td>
      <td>${r.hospital || '—'}</td>
      <td>${r.eta_minutes ?? '—'} min</td>
      <td class="text-muted text-sm">${(r.created_at || '').replace('T', ' ').replace('Z', '')}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-muted">No incidents yet — submit one from AI Pipeline page.</td></tr>';
}

async function loadEventLog() {
  const el = document.getElementById('event-log');
  if (!el) return;
  const rows = await API.getIncidents({ limit: 10 });
  el.innerHTML = rows.map(r => `
    <div class="line"><span class="ts">${(r.created_at||'').slice(11,19)}</span><span class="ch">[${r.severity}]</span> ${r.incident_id} routed to ${r.hospital} — risk ${r.risk_band}</div>
  `).join('') || '<div class="line text-muted">No events yet.</div>';
}

// ---------------- HOSPITALS PANEL ----------------
async function loadHospitalsPanel() {
  const hospitals = await API.getHospitals(selectedLat, selectedLon, 25);
  const el = document.getElementById('hospitals-list');
  el.innerHTML = hospitals.map(h => {
    const bedsPct = Math.round((h.beds_available / h.total_beds) * 100);
    const icuPct = Math.round((h.icu_available / h.icu_beds) * 100);
    const bedsColor = bedsPct > 50 ? 'var(--green)' : bedsPct > 20 ? 'var(--yellow)' : 'var(--red)';
    const icuColor = icuPct > 50 ? 'var(--green)' : icuPct > 20 ? 'var(--yellow)' : 'var(--red)';
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}`;
    return `
    <div class="card hospital-card mt-12">
      <div class="h-header">
        <div>
          <div class="h-name">${h.name}</div>
          <div class="h-dist">📍 ${h.distance_km} km away</div>
        </div>
        ${h.trauma_center ? '<span class="pill CRITICAL">TRAUMA CENTER</span>' : ''}
      </div>

      <div class="progress-row">
        <div class="pr-label"><span>Beds Available</span><span>${h.beds_available}/${h.total_beds}</span></div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${bedsPct}%;background:${bedsColor};"></div></div>
      </div>
      <div class="progress-row">
        <div class="pr-label"><span>ICU Available</span><span>${h.icu_available}/${h.icu_beds}</span></div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${icuPct}%;background:${icuColor};"></div></div>
      </div>

      <div class="badge-row">
        ${h.blood_bank ? '<span class="badge-chip blood">🩸 Blood Bank Available</span>' : ''}
        <span class="badge-chip doctors">👨‍⚕️ ${h.doctors_on_call} Doctors On-Call</span>
      </div>

      <div class="hospital-actions">
        <button class="btn btn-primary btn-sm" onclick="dispatchToHospital('${h.name.replace(/'/g, "\\'")}')">🚑 Dispatch Ambulance</button>
        <a class="btn btn-ghost btn-sm" href="${navUrl}" target="_blank" rel="noopener">🧭 Navigate</a>
      </div>
    </div>
  `; }).join('');

  const police = await API.getNearestPolice(selectedLat, selectedLon);
  document.getElementById('police-panel').innerHTML = `
    <div class="card glow-cyan">
      <div style="font-weight:700;font-size:14px;">🚓 ${police.name}</div>
      <div class="text-muted text-sm mt-8">Contact: ${police.contact}</div>
      <div class="text-muted text-sm">Patrol Unit: ${police.patrol_unit} · ETA ${police.eta_minutes} min</div>
      <div class="pill LOW mt-8">Patrol Dispatched</div>
    </div>
  `;
}

function dispatchToHospital(hospitalName) {
  notify(`🚑 Ambulance dispatch simulated to ${hospitalName}.`);
}

// ---------------- FEDERATED LEARNING ----------------
function initFederated() {
  document.getElementById('fed-run-btn').addEventListener('click', runFederatedRound);
  renderFedNodes(5, []);
}

function renderFedNodes(n, details) {
  const wrap = document.getElementById('fed-viz');
  const nodesHtml = Array.from({ length: n }).map((_, i) => {
    const d = details[i];
    return `<div class="fed-node" id="fed-node-${i}"><div class="fed-icon">📱</div>${d ? d.location : 'Device ' + (i + 1)}</div>`;
  }).join('');
  wrap.innerHTML = `${nodesHtml}<div class="fed-center">Global<br>Model</div>`;
}

async function runFederatedRound() {
  const btn = document.getElementById('fed-run-btn');
  btn.classList.add('loading'); btn.disabled = true;
  renderFedNodes(5, []);
  document.querySelectorAll('.fed-node').forEach(n => n.classList.add('syncing'));
  await new Promise(r => setTimeout(r, 200));

  const result = await API.simulateFederatedRound();
  for (let i = 0; i < result.client_details.length; i++) {
    const el = document.getElementById(`fed-node-${i}`);
    if (el) { el.classList.remove('syncing'); el.classList.add('active'); el.innerHTML = `<div class="fed-icon">✅</div>${result.client_details[i].location}<br><span style="opacity:0.7">${result.client_details[i].local_samples} samples</span>`; }
    await new Promise(r => setTimeout(r, 220));
  }
  document.getElementById('fed-result').innerHTML = `
    <b>${result.clients_participated}</b> clients aggregated · weight drift <b>${result.weight_drift}</b><br>
    <span class="text-muted text-sm">${result.privacy_note}</span>
  `;
  btn.classList.remove('loading'); btn.disabled = false;
}

// ---------------- ANALYTICS ----------------
async function loadAnalytics() {
  const stats = await API.getAnalytics();
  const timeline = await API.getTimeline(7);

  if (Object.keys(stats.severity_distribution).length) ChartsModule.severityDonut(document.getElementById('chart-severity').getContext('2d'), stats.severity_distribution);
  if (Object.keys(stats.risk_distribution).length) ChartsModule.riskBar(document.getElementById('chart-risk').getContext('2d'), stats.risk_distribution);
  if (Object.keys(stats.language_usage).length) ChartsModule.languageBar(document.getElementById('chart-language').getContext('2d'), stats.language_usage);
  ChartsModule.timelineLine(document.getElementById('chart-timeline').getContext('2d'), timeline);
  if (stats.hospital_stats.length) ChartsModule.hospitalStatsBar(document.getElementById('chart-hospitals').getContext('2d'), stats.hospital_stats);

  document.getElementById('analytics-summary').innerHTML = `
    <div class="grid grid-4">
      <div class="card stat-card"><div class="value">${stats.total_incidents}</div><div class="label">Total Incidents</div></div>
      <div class="card stat-card"><div class="value">${stats.incidents_today}</div><div class="label">Today</div></div>
      <div class="card stat-card"><div class="value">${stats.avg_response_eta_minutes}</div><div class="label">Avg ETA (min)</div></div>
      <div class="card stat-card"><div class="value">${stats.lives_saveable_estimate}</div><div class="label">Est. Lives Saveable</div></div>
    </div>
  `;
}

// ---------------- ADMIN ----------------
let adminAllRows = [];
let adminPage = 1;
const ADMIN_PAGE_SIZE = 10;

function initAdmin() {
  document.getElementById('admin-search').addEventListener('input', debounce(() => { adminPage = 1; loadAdminTable(); }, 350));
  document.getElementById('admin-severity-filter').addEventListener('change', () => { adminPage = 1; loadAdminTable(); });
  document.getElementById('admin-export-csv').addEventListener('click', () => window.open(API.exportCsvUrl(), '_blank'));
  document.getElementById('admin-export-pdf').addEventListener('click', () => window.open(API.exportPdfUrl(), '_blank'));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function loadAdminTable() {
  const search = document.getElementById('admin-search').value;
  const severity = document.getElementById('admin-severity-filter').value;
  adminAllRows = await API.getIncidents({ limit: 200, search: search || undefined, severity: severity || undefined });
  renderAdminPage();
}

function renderAdminPage() {
  const totalPages = Math.max(1, Math.ceil(adminAllRows.length / ADMIN_PAGE_SIZE));
  adminPage = Math.min(adminPage, totalPages);
  const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
  const rows = adminAllRows.slice(start, start + ADMIN_PAGE_SIZE);

  const tbody = document.getElementById('admin-table-body');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.incident_id}</td>
      <td><span class="pill ${r.severity}">${r.severity || '—'}</span></td>
      <td><span class="pill ${r.risk_band}">${r.risk_band || '—'}</span></td>
      <td>${r.hospital || '—'}</td>
      <td>${r.vehicle_type || '—'}</td>
      <td>${r.num_victims ?? '—'}</td>
      <td class="text-muted text-sm">${(r.created_at || '').replace('T', ' ').replace('Z', '')}</td>
      <td><button class="icon-btn" onclick="deleteIncidentRow('${r.incident_id}')">🗑️</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="text-muted">No incidents match.</td></tr>';
  document.getElementById('admin-count').textContent = `${adminAllRows.length} incident(s) · page ${adminPage} of ${totalPages}`;

  const pag = document.getElementById('admin-pagination');
  if (pag) {
    let html = `<button ${adminPage === 1 ? 'disabled' : ''} onclick="goAdminPage(${adminPage - 1})">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - adminPage) <= 1) {
        html += `<button class="${p === adminPage ? 'active' : ''}" onclick="goAdminPage(${p})">${p}</button>`;
      } else if (Math.abs(p - adminPage) === 2) {
        html += `<span class="text-muted" style="padding:0 4px;">…</span>`;
      }
    }
    html += `<button ${adminPage === totalPages ? 'disabled' : ''} onclick="goAdminPage(${adminPage + 1})">›</button>`;
    pag.innerHTML = html;
  }
}

function goAdminPage(p) { adminPage = p; renderAdminPage(); }

async function deleteIncidentRow(id) {
  if (!confirm(`Delete incident ${id}? This cannot be undone.`)) return;
  await API.deleteIncident(id);
  loadAdminTable();
  loadDashboardStats();
  notify(`Incident ${id} deleted.`);
}
