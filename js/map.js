
const MapModule = (() => {
  let map = null;
  let markers = {}; // contract_id -> Leaflet marker
  let currentLocations = [];
  let displayMode = 'status';
  let markerClickHandler = null;

  function init() {
    // Centered roughly on Surigao del Sur province
    map = L.map('map').setView([8.9, 126.1], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    return map;
  }

  function clearMarkers() {
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};
  }

  function setMarkers(locations, { onMarkerClick } = {}) {
    clearMarkers();
    currentLocations = locations;
    markerClickHandler = onMarkerClick;

    locations.forEach((loc) => {
      addMarker(loc, locations);
    });
  }

  function addMarker(loc, allLocations) {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      const color = displayMode === 'status'
        ? markerColor(loc.status)
        : displayMode === 'category'
          ? categoryColor(loc.component_categories)
          : budgetColor(loc.budget);
      const marker = L.circleMarker([lat, lng], {
        radius: displayMode === 'budget' ? budgetRadius(loc.budget, allLocations) : 7,
        weight: 2,
        color,
        fillColor: color,
        fillOpacity: 0.55,
      }).addTo(map);

      const title = (loc.description || '').length > 70
        ? loc.description.slice(0, 70).trim() + '…'
        : loc.description;

      marker.bindPopup(`
        <strong>${escapeHtml(title || 'Untitled Project')}</strong><br>
        Status: ${escapeHtml(loc.status || 'Unknown')}<br>
        Budget: ${ProjectUI.formatCurrency(loc.budget)}<br>
        <a href="#" data-open-contract="${escapeHtml(loc.contract_id)}">View full details &rarr;</a>
      `);

      marker.on('popupopen', () => {
        const link = document.querySelector(`[data-open-contract="${cssEscape(loc.contract_id)}"]`);
        if (link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            markerClickHandler && markerClickHandler(loc.contract_id);
          });
        }
      });

      marker.on('click', () => markerClickHandler && markerClickHandler(loc.contract_id));

      markers[loc.contract_id] = marker;
  }

  function setDisplayMode(mode) {
    displayMode = ['status', 'category', 'budget'].includes(mode) ? mode : 'status';
    clearMarkers();
    currentLocations.forEach((loc) => addMarker(loc, currentLocations));
  }

  function budgetRadius(budget, allLocations) {
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) return 7;

    // Fixed anchors keep high-value projects prominent after filtering.
    const lowerBound = Math.sqrt(1000000);
    const upperBound = Math.sqrt(90000000);
    const normalized = Math.min(
      (Math.sqrt(Math.max(amount, 1000000)) - lowerBound) / (upperBound - lowerBound),
      1
    );
    if (amount >= 90000000) return Math.min(20 + (Math.sqrt(amount) - upperBound) / 20, 24);
    if (amount >= 50000000) return 14 + normalized * 6;
    return 6 + normalized * 8;
  }

  function budgetColor(budget) {
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) return '#5A6472';
    if (amount > 100000000) return '#A63A3A';
    if (amount >= 90000000) return '#E07A2F';
    if (amount >= 50000000) return '#C98A2E';
    return '#2F6B6E';
  }

  function focusMarker(contractId) {
    const marker = markers[contractId];
    if (!marker) return; // project may have no coordinates
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }

  function markerColor(status) {
    switch (status) {
      case 'Completed': return '#4B7247';
      case 'On-Going': return '#C98A2E';
      case 'Terminated': return '#A63A3A';
      default: return '#5A6472';
    }
  }

  function categoryColor(category) {
    const palette = [
      '#2F6B6E', '#7A5C3E', '#507A55', '#A04B3D',
      '#6B5B95', '#B06B35', '#3D6B8A', '#7A6A2F',
    ];
    const value = String(category || 'Uncategorized');
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return palette[Math.abs(hash) % palette.length];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cssEscape(str) {
    return String(str).replace(/"/g, '\\"');
  }

  return { init, setMarkers, setDisplayMode, clearMarkers, focusMarker };
})();