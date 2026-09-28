/**
 * Generate GeoJSON from coordinates
 * Uses Leaflet and Leaflet Routing Machine to calculate routes and export GeoJSON LineStrings.
 */

// Global state
let map;
let routingControl = null;
let currentGeoJSON = null;
let isMinified = false;

// Default initial view (Quito, Ecuador)
const DEFAULT_CENTER = [-0.2200455, -78.5009917];
const DEFAULT_ZOOM = 9;

// Route line styling
const ROUTE_STYLE = {
  color: '#0d6efd',
  weight: 6,
  opacity: 0.85,
};

/**
 * Robust parser for coordinate input strings.
 * Supports:
 * - Array of objects with lat/lng, latitude/longitude, etc.
 * - Array of coordinate pairs [lng, lat] (GeoJSON standard) or [lat, lng]
 * - Direct GeoJSON FeatureCollection or LineString Feature
 * - Relaxed JSON (single quotes, trailing commas, unquoted keys)
 *
 * @param {string} rawText
 * @returns {{ success: boolean, waypoints?: Array<{lat: number, lng: number}>, error?: string }}
 */
function parseCoordinatesInput(rawText) {
  if (!rawText || !rawText.trim()) {
    return { success: false, error: 'Please enter coordinate waypoints.' };
  }

  const cleaned = rawText.trim();
  let parsed;

  // 1. Try standard JSON.parse
  try {
    parsed = JSON.parse(cleaned);
  } catch (err1) {
    // 2. Try relaxed JSON parsing (single quotes, unquoted keys, trailing commas)
    try {
      const sanitized = cleaned
        .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"') // single to double quotes
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // quote keys
      parsed = JSON.parse(sanitized);
    } catch (err2) {
      return {
        success: false,
        error: `Invalid JSON syntax: ${err1.message}. Please provide a valid JSON array of coordinates.`,
      };
    }
  }

  // 3. If a GeoJSON FeatureCollection or Feature is pasted, extract coordinates
  if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    const lineFeature = parsed.features.find(
      (f) => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiPoint')
    );
    if (lineFeature && Array.isArray(lineFeature.geometry.coordinates)) {
      parsed = lineFeature.geometry.coordinates;
    }
  } else if (parsed && parsed.type === 'Feature' && parsed.geometry) {
    if (Array.isArray(parsed.geometry.coordinates)) {
      parsed = parsed.geometry.coordinates;
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      success: false,
      error: 'Input must be a JSON array of coordinates, e.g. [{"lat": -0.128, "lng": -78.362}, ...]',
    };
  }

  if (parsed.length < 2) {
    return {
      success: false,
      error: `At least 2 waypoints are required to calculate a route (received ${parsed.length}).`,
    };
  }

  const waypoints = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    let lat, lng;

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      lat = item.lat ?? item.latitude ?? item.Lat ?? item.LAT;
      lng = item.lng ?? item.lon ?? item.longitude ?? item.Lng ?? item.LON ?? item.long;
    } else if (Array.isArray(item) && item.length >= 2) {
      const v0 = Number(item[0]);
      const v1 = Number(item[1]);

      // If one value is > 90 or < -90, it must be longitude
      if (Math.abs(v0) > 90 && Math.abs(v1) <= 90) {
        lng = v0;
        lat = v1;
      } else if (Math.abs(v1) > 90 && Math.abs(v0) <= 90) {
        lat = v0;
        lng = v1;
      } else {
        // By default in GeoJSON coordinates array: [lng, lat]
        lng = v0;
        lat = v1;
      }
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      return {
        success: false,
        error: `Point #${i + 1} has invalid coordinate values: ${JSON.stringify(item)}.`,
      };
    }

    if (numLat < -90 || numLat > 90) {
      return {
        success: false,
        error: `Point #${i + 1} latitude (${numLat}) is out of valid range [-90, 90].`,
      };
    }

    if (numLng < -180 || numLng > 180) {
      return {
        success: false,
        error: `Point #${i + 1} longitude (${numLng}) is out of valid range [-180, 180].`,
      };
    }

    waypoints.push({ lat: numLat, lng: numLng });
  }

  return { success: true, waypoints };
}

/**
 * Format distance in meters to a human-readable string (km and miles).
 * @param {number} meters
 * @returns {string}
 */
function formatDistance(meters) {
  if (typeof meters !== 'number' || isNaN(meters)) return '0 km';
  const km = (meters / 1000).toFixed(2);
  const mi = (meters * 0.000621371).toFixed(2);
  return `${km} km (${mi} mi)`;
}

/**
 * Format duration in seconds to human-readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins} min`;
}

/**
 * Build GeoJSON FeatureCollection with LineString geometry.
 * @param {Array<{lat: number, lng: number}>} coordinates
 * @param {object} properties
 * @returns {object} GeoJSON FeatureCollection
 */
function buildGeoJSON(coordinates, properties = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          ...properties,
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates.map((pt) => [pt.lng, pt.lat]),
        },
      },
    ],
  };
}

/**
 * Show alert banner in UI.
 * @param {string} message
 * @param {'danger'|'warning'|'success'|'info'} type
 */
function showAlert(message, type = 'danger') {
  const container = document.getElementById('alert-container');
  if (!container) return;

  const iconClass =
    type === 'danger'
      ? 'bi-exclamation-octagon-fill'
      : type === 'warning'
      ? 'bi-exclamation-triangle-fill'
      : type === 'success'
      ? 'bi-check-circle-fill'
      : 'bi-info-circle-fill';

  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center shadow-sm" role="alert">
      <i class="bi ${iconClass} me-2 fs-5 flex-shrink-0"></i>
      <div class="flex-grow-1">${message}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" onclick="dismissAlert()"></button>
    </div>
  `;
}

/**
 * Dismiss current alert.
 */
function dismissAlert() {
  const container = document.getElementById('alert-container');
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Set loading state on Generate button.
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  const btn = document.getElementById('btn-generate');
  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Calculating route...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-play-fill me-1"></i>Generate Route`;
  }
}

/**
 * Update the result textarea with formatted GeoJSON.
 */
function updateResultTextarea() {
  const resultElem = document.getElementById('result');
  if (!resultElem || !currentGeoJSON) return;

  if (isMinified) {
    resultElem.value = JSON.stringify(currentGeoJSON);
  } else {
    resultElem.value = JSON.stringify(currentGeoJSON, null, 2);
  }
}

/**
 * Update summary stats bar with route details.
 * @param {object} route
 * @param {number} waypointsCount
 */
function updateRouteSummary(route, waypointsCount) {
  const summaryBar = document.getElementById('route-summary');
  if (!summaryBar) return;

  const distanceElem = document.getElementById('summary-distance');
  const durationElem = document.getElementById('summary-duration');
  const pointsElem = document.getElementById('summary-points');

  if (distanceElem && route.summary) {
    distanceElem.textContent = formatDistance(route.summary.totalDistance);
  }
  if (durationElem && route.summary) {
    durationElem.textContent = formatDuration(route.summary.totalTime);
  }
  if (pointsElem && route.coordinates) {
    pointsElem.textContent = `${waypointsCount} waypoints • ${route.coordinates.length} vertices`;
  }

  summaryBar.classList.remove('d-none');
  const mapHint = document.getElementById('map-hint');
  if (mapHint) mapHint.classList.add('d-none');
}

/**
 * Main function: generate route from coordinates input and update map + GeoJSON.
 */
function generateResult() {
  dismissAlert();

  const inputElem = document.getElementById('coordinates');
  if (!inputElem) return;

  const parseResult = parseCoordinatesInput(inputElem.value);
  if (!parseResult.success) {
    showAlert(parseResult.error, 'danger');
    return;
  }

  setLoading(true);

  // Remove existing routing control if present
  if (routingControl) {
    try {
      map.removeControl(routingControl);
    } catch (e) {
      console.warn('Error removing previous routing control:', e);
    }
    routingControl = null;
  }

  // Convert waypoints to Leaflet LatLng objects
  const waypoints = parseResult.waypoints.map((item) => L.latLng(item.lat, item.lng));

  try {
    routingControl = L.Routing.control({
      waypoints: waypoints,
      autoRoute: true,
      routeWhileDragging: true,
      show: false,
      addWaypoints: true,
      lineOptions: {
        styles: [ROUTE_STYLE],
      },
    }).addTo(map);

    // Explicitly hide the itinerary container if rendered
    if (typeof routingControl.hide === 'function') {
      routingControl.hide();
    }

    // Handle route selection and recalculation (e.g. after dragging)
    const onRouteFound = function (e) {
      const r = e.route || (e.routes && e.routes[0]);
      if (!r || !Array.isArray(r.coordinates) || r.coordinates.length === 0) return;

      const bounds = L.latLngBounds(r.coordinates);

      // Pan/zoom map to fit route
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      // Build GeoJSON LineString
      currentGeoJSON = buildGeoJSON(r.coordinates, {
        name: 'Route LineString',
        distance_km: r.summary ? Number((r.summary.totalDistance / 1000).toFixed(2)) : undefined,
        duration_minutes: r.summary ? Math.round(r.summary.totalTime / 60) : undefined,
      });

      // Update textarea & summary
      updateResultTextarea();
      updateRouteSummary(r, waypoints.length);

      setLoading(false);
      showAlert('Route and GeoJSON successfully generated!', 'success');
    };

    routingControl.on('routeselected', onRouteFound);
    routingControl.on('routesfound', onRouteFound);

    routingControl.on('routingerror', function (err) {
      setLoading(false);
      showAlert(
        `Unable to calculate route. Please verify that points are accessible by road. Details: ${
          err.error?.message || 'Routing service error'
        }`,
        'warning'
      );
    });
  } catch (err) {
    setLoading(false);
    showAlert(`Error initializing routing: ${err.message}`, 'danger');
  }
}

/**
 * Clear all inputs, results, alerts, map routes and reset view.
 */
function cleanTextarea() {
  dismissAlert();

  const coordsElem = document.getElementById('coordinates');
  if (coordsElem) coordsElem.value = '';

  const resultElem = document.getElementById('result');
  if (resultElem) resultElem.value = '';

  currentGeoJSON = null;

  // Hide summary bar and show hint
  const summaryBar = document.getElementById('route-summary');
  if (summaryBar) summaryBar.classList.add('d-none');
  const mapHint = document.getElementById('map-hint');
  if (mapHint) mapHint.classList.remove('d-none');

  // Remove routing control
  if (routingControl) {
    try {
      map.removeControl(routingControl);
    } catch (e) {
      console.warn('Error removing routing control:', e);
    }
    routingControl = null;
  }

  // Reset map view
  if (map) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }
}

/**
 * Load example data into coordinates input and calculate route.
 */
function loadExampleData() {
  const exampleElem = document.getElementById('example-data');
  const coordsElem = document.getElementById('coordinates');
  if (!exampleElem || !coordsElem) return;

  coordsElem.value = exampleElem.textContent.trim();
  generateResult();
}

/**
 * Copy result GeoJSON to clipboard with visual feedback.
 */
function copyResult() {
  const resultElem = document.getElementById('result');
  const copyBtn = document.getElementById('btn-copy');
  if (!resultElem || !resultElem.value.trim()) {
    showAlert('No GeoJSON to copy. Generate a route first!', 'warning');
    return;
  }

  const text = resultElem.value;

  const showSuccessFeedback = () => {
    if (copyBtn) {
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `<i class="bi bi-check2 me-1"></i>Copied!`;
      copyBtn.classList.remove('btn-outline-primary');
      copyBtn.classList.add('btn-success');
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-outline-primary');
      }, 2000);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(showSuccessFeedback)
      .catch(() => fallbackCopy(text, showSuccessFeedback));
  } else {
    fallbackCopy(text, showSuccessFeedback);
  }
}

/**
 * Fallback clipboard copy using textarea selection.
 */
function fallbackCopy(text, callback) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    if (callback) callback();
  } catch (err) {
    showAlert('Could not copy to clipboard automatically.', 'warning');
  }
  document.body.removeChild(textarea);
}

/**
 * Copy example JSON snippet to clipboard.
 */
function copyExampleSnippet() {
  const exampleElem = document.getElementById('example-data');
  const btn = document.getElementById('btn-copy-example');
  if (!exampleElem) return;

  const text = exampleElem.textContent.trim();
  const showFeedback = () => {
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<i class="bi bi-check2 me-1"></i>Copied!`;
      btn.classList.add('btn-success');
      btn.classList.remove('btn-outline-secondary');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline-secondary');
      }, 2000);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showFeedback).catch(() => fallbackCopy(text, showFeedback));
  } else {
    fallbackCopy(text, showFeedback);
  }
}

/**
 * Download generated GeoJSON as a .geojson file.
 */
function downloadGeoJSON() {
  if (!currentGeoJSON) {
    showAlert('No GeoJSON to download. Generate a route first!', 'warning');
    return;
  }

  const jsonString = isMinified ? JSON.stringify(currentGeoJSON) : JSON.stringify(currentGeoJSON, null, 2);
  const blob = new Blob([jsonString], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `route-${timestamp}.geojson`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Toggle between Pretty and Minified JSON.
 */
function toggleFormat() {
  if (!currentGeoJSON) return;
  isMinified = !isMinified;

  const btn = document.getElementById('btn-format');
  if (btn) {
    btn.innerHTML = isMinified
      ? `<i class="bi bi-text-paragraph me-1"></i>Prettify`
      : `<i class="bi bi-braces me-1"></i>Minify`;
  }

  updateResultTextarea();
}

/**
 * Select all text in a textarea.
 * @param {string} id
 */
function SelectAll(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.focus();
    elem.select();
  }
}

/**
 * Initialize Leaflet map and base tile layers.
 */
function initMap() {
  if (typeof L === 'undefined' || !document.getElementById('map')) return;

  map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // 1. OpenStreetMap Standard (Clean, reliable, no API key needed, no watermarks)
  const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  });

  // 2. Esri World Imagery (Satellite)
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }
  );

  // Add default layer
  osmLayer.addTo(map);

  // Layer control for switching between Street and Satellite views
  const baseLayers = {
    'Street Map': osmLayer,
    'Satellite': satelliteLayer,
  };
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

  // Scale control
  L.control.scale({ imperial: true, metric: true }).addTo(map);
}

// Initialize on DOM load if running in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initMap();
  });
}

// Export for Node.js unit tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseCoordinatesInput,
    formatDistance,
    formatDuration,
    buildGeoJSON,
  };
}
