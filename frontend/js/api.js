/* ============================================================
   RoadSoS NEXUS — API Client
   Thin wrapper over all backend endpoints. Every call here hits
   a real Flask route (see backend/app.py) — nothing here is mocked.
   ============================================================ */

const API = {
  async submitIncident(formData) {
    const res = await fetch('/api/incident', { method: 'POST', body: formData });
    return res.json();
  },
  async getIncidents(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`/api/incidents${q ? '?' + q : ''}`);
    return res.json();
  },
  async deleteIncident(id) {
    const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
    return res.json();
  },
  exportCsvUrl() { return '/api/incidents/export.csv'; },
  exportPdfUrl() { return '/api/incidents/export.pdf'; },

  async reportHazard(lat, lon, description) {
    const res = await fetch('/api/hazard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, description }),
    });
    return res.json();
  },
  async getHazards(lat, lon, radius_km = 10) {
    const res = await fetch(`/api/hazards?lat=${lat}&lon=${lon}&radius_km=${radius_km}`);
    return res.json();
  },

  async getHospitals(lat, lon, radius_km = 15) {
    const res = await fetch(`/api/hospitals?lat=${lat}&lon=${lon}&radius_km=${radius_km}`);
    return res.json();
  },
  async getNearestPolice(lat, lon) {
    const res = await fetch(`/api/police/nearest?lat=${lat}&lon=${lon}`);
    return res.json();
  },

  async getNotifications(incidentId) {
    const res = await fetch(`/api/notifications/${incidentId}`);
    return res.json();
  },

  async getDigitalTwin(incLat, incLon, hospLat, hospLon) {
    const res = await fetch(`/api/digital-twin?incident_lat=${incLat}&incident_lon=${incLon}&hospital_lat=${hospLat}&hospital_lon=${hospLon}`);
    return res.json();
  },

  async simulateFederatedRound() {
    const res = await fetch('/api/federated/simulate', { method: 'POST' });
    return res.json();
  },

  async getAnalytics() {
    const res = await fetch('/api/analytics/dashboard');
    return res.json();
  },
  async getTimeline(days = 7) {
    const res = await fetch(`/api/analytics/timeline?days=${days}`);
    return res.json();
  },

  async detectLanguage(text) {
    const res = await fetch('/api/language/detect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },
};
