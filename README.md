# Generate GeoJSON from coordinates

[![Netlify Status](https://api.netlify.com/api/v1/badges/67e0c076-68b5-4762-8f56-799c5796d6dd/deploy-status)](https://app.netlify.com/sites/generate-geojson-from-cordinates/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/emamut/generate-geojson-from-cordinates/pulls)

A modern, fast, and responsive web tool to generate drivable routes in standard **GeoJSON LineString** format from a list of coordinate waypoints.

🌐 **Live Demo:** [https://generate-geojson-from-cordinates.netlify.app/](https://generate-geojson-from-cordinates.netlify.app/)

---

## 🚀 Features

- **Interactive Map Routing**: Uses [Leaflet](https://leafletjs.com/) and [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/) with OSRM to calculate real-world drivable road paths between waypoints.
- **RFC 7946 Standard GeoJSON**: Generates standard GeoJSON `FeatureCollection` with `LineString` geometry and route metrics (`distance_km`, `duration_minutes`).
- **Flexible Input Parsing**:
  - Objects with `lat`/`lng`: `[{"lat": -0.128, "lng": -78.362}, ...]`
  - Objects with `latitude`/`longitude`: `[{"latitude": -0.128, "longitude": -78.362}, ...]`
  - GeoJSON coordinate pairs `[lng, lat]`: `[[-78.362, -0.128], ...]`
  - Pasted GeoJSON `FeatureCollection` or `LineString`
  - Relaxed JSON syntax (supports single quotes, trailing commas, unquoted keys)
- **Interactive Drag & Re-route**: Drag waypoints directly on the map to recalculate the route and automatically update the GeoJSON LineString in real time.
- **Route Metrics**: Live summary badges showing total distance (km and miles), estimated travel time, and vertex count.
- **Dual Map Layers**: Easily toggle between **OpenStreetMap** (Standard) and high-resolution **Satellite Imagery** (Esri World Imagery).
- **One-Click Actions**:
  - 📋 **Copy to Clipboard** with visual feedback
  - 💾 **Download `.geojson` file** directly
  - ⚡ **Load Example** data instantly
  - 🔀 **Prettify / Minify** GeoJSON toggle
- **Fully Responsive**: Optimized for desktop, tablets, and mobile devices.

---

## 📸 Preview
<img width="1091" height="651" alt="image" src="https://github.com/user-attachments/assets/877820a8-9f59-4f6e-9377-7cffe7f43e0c" />



---

## 📋 Input Format Examples

### Standard Object Array (Recommended)
```json
[
  {"lat": -0.128265, "lng": -78.362528},
  {"lat": -0.9322002, "lng": -78.6225983},
  {"lat": -0.95585, "lng": -78.850288}
]
```

### GeoJSON Coordinate Pairs `[longitude, latitude]`
```json
[
  [-78.362528, -0.128265],
  [-78.6225983, -0.9322002],
  [-78.850288, -0.95585]
]
```

---

## 🛠️ Local Development & Testing

This project is built with vanilla JavaScript (ES6+), HTML5, and Bootstrap 5. No heavy build pipeline is required.

### 1. Run Locally
You can serve the project using any local HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js
npx serve .
```

Then open `http://localhost:8080` in your web browser.

### 2. Run Automated Unit Tests
Unit tests use Node.js's built-in test runner:

```bash
node --test test/app.test.js
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
