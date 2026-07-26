/* ============================================================
   RoadSoS NEXUS — Map Module (Leaflet + OpenStreetMap)
   Real map, real tiles, real markers from real API data.
   No API key required — OSM tile server + Nominatim search are free.
   ============================================================ */

const MapModule = (() => {
  let map, layers = {}, ambulanceMarker, ambulanceRoute;
  const BENGALURU = [12.9716, 77.5946];

  const ICONS = {
    hospital: '🏥', police: '🚓', ambulance: '🚑', hazard: '⚠️',
    pothole: '🕳️', waterlogging: '💧', debris: '🪵', fire: '🔥', incident: '💥',
  };

  function makeDivIcon(emoji, colorClass, animClass) {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div class="${animClass || ''}" style="font-size:20px; filter: drop-shadow(0 2px 4px ${colorClass});">${emoji}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  }

  function init(containerId) {
    map = L.map(containerId, { zoomControl: true, attributionControl: true }).setView(BENGALURU, 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    layers.hospitals = L.layerGroup().addTo(map);
    layers.police = L.layerGroup().addTo(map);
    layers.hazards = L.layerGroup().addTo(map);
    layers.incidents = L.layerGroup().addTo(map);
    layers.ambulance = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      if (window.onMapClick) window.onMapClick(e.latlng.lat, e.latlng.lng);
    });

    return map;
  }

  async function loadHospitals(lat, lon) {
    layers.hospitals.clearLayers();
    const hospitals = await API.getHospitals(lat, lon, 20);
    hospitals.forEach(h => {
      const marker = L.marker([h.lat, h.lon], { icon: makeDivIcon(ICONS.hospital, 'rgba(34,197,94,0.6)') });
      marker.bindPopup(`
        <b>${h.name}</b><br>
        ${h.trauma_center ? '🩺 Trauma Center<br>' : ''}
        Beds free: ${h.beds_available}/${h.total_beds}<br>
        ICU free: ${h.icu_available}/${h.icu_beds}<br>
        Blood bank: ${h.blood_bank ? 'Yes' : 'No'}<br>
        Doctors on call: ${h.doctors_on_call}<br>
        Distance: ${h.distance_km} km
      `);
      layers.hospitals.addLayer(marker);
    });
    return hospitals;
  }

  async function loadPolice(lat, lon) {
    layers.police.clearLayers();
    const p = await API.getNearestPolice(lat, lon);
    const marker = L.marker([p.lat, p.lon], { icon: makeDivIcon(ICONS.police, 'rgba(37,99,235,0.6)') });
    marker.bindPopup(`<b>${p.name}</b><br>Contact: ${p.contact}<br>Unit: ${p.patrol_unit}<br>ETA: ${p.eta_minutes} min`);
    layers.police.addLayer(marker);
    return p;
  }

  async function loadHazards(lat, lon) {
    layers.hazards.clearLayers();
    const hazards = await API.getHazards(lat, lon, 15);
    hazards.forEach(h => {
      const icon = ICONS[h.hazard_type] || ICONS.hazard;
      const marker = L.marker([h.lat, h.lon], { icon: makeDivIcon(icon, 'rgba(245,158,11,0.6)', 'pulse-marker') });
      marker.bindPopup(`<b>${h.hazard_type}</b><br>${h.description}<br><small>${h.reported_at}</small>`);
      layers.hazards.addLayer(marker);
    });
    return hazards;
  }

  function addIncidentMarker(lat, lon, incidentId, severity) {
    const color = severity === 'CRITICAL' ? 'rgba(239,68,68,0.6)' : severity === 'SERIOUS' ? 'rgba(245,158,11,0.6)' : 'rgba(34,197,94,0.6)';
    const marker = L.marker([lat, lon], { icon: makeDivIcon(ICONS.incident, color, 'pulse-marker') });
    marker.bindPopup(`<b>${incidentId}</b><br>Severity: ${severity}`);
    layers.incidents.addLayer(marker);
    map.panTo([lat, lon]);
    return marker;
  }

  function updateAmbulance(lat, lon, routeLatLngs) {
    layers.ambulance.clearLayers();
    if (routeLatLngs && routeLatLngs.length > 1) {
      L.polyline(routeLatLngs, { color: '#2563EB', weight: 3, opacity: 0.7, dashArray: '6,6' }).addTo(layers.ambulance);
    }
    const marker = L.marker([lat, lon], { icon: makeDivIcon(ICONS.ambulance, 'rgba(239,68,68,0.6)', 'amb-marker') });
    layers.ambulance.addLayer(marker);
  }

  async function searchLocation(query) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.length) {
      const { lat, lon, display_name } = data[0];
      map.setView([parseFloat(lat), parseFloat(lon)], 14);
      L.popup().setLatLng([lat, lon]).setContent(display_name).openOn(map);
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    }
    return null;
  }

  function toggleLayer(name, visible) {
    if (!layers[name]) return;
    if (visible) map.addLayer(layers[name]); else map.removeLayer(layers[name]);
  }

  function getMap() { return map; }
  function getCenter() { const c = map.getCenter(); return { lat: c.lat, lon: c.lng }; }

  return { init, loadHospitals, loadPolice, loadHazards, addIncidentMarker, updateAmbulance, searchLocation, toggleLayer, getMap, getCenter };
})();
