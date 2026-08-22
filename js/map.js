
const MapModule = (() => {
  let map = null;
  let markers = {}; // contract_id -> Leaflet marker

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

    locations.forEach((loc) => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        weight: 2,
        color: markerColor(loc.status),
        fillColor: markerColor(loc.status),
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
            onMarkerClick && onMarkerClick(loc.contract_id);
          });
        }
      });

      marker.on('click', () => onMarkerClick && onMarkerClick(loc.contract_id));

      markers[loc.contract_id] = marker;
    });
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cssEscape(str) {
    return String(str).replace(/"/g, '\\"');
  }

  return { init, setMarkers, clearMarkers, focusMarker };
})();