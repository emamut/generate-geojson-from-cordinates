const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCoordinatesInput,
  formatDistance,
  formatDuration,
  buildGeoJSON,
} = require('../app.js');

test('parseCoordinatesInput parses standard JSON array of {lat, lng}', () => {
  const input = JSON.stringify([
    { lat: -0.128265, lng: -78.362528 },
    { lat: -0.9322002, lng: -78.6225983 },
  ]);
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, true);
  assert.equal(result.waypoints.length, 2);
  assert.equal(result.waypoints[0].lat, -0.128265);
  assert.equal(result.waypoints[0].lng, -78.362528);
});

test('parseCoordinatesInput parses latitude and longitude keys', () => {
  const input = JSON.stringify([
    { latitude: 10.5, longitude: -66.9 },
    { latitude: 10.6, longitude: -66.8 },
  ]);
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, true);
  assert.equal(result.waypoints[0].lat, 10.5);
  assert.equal(result.waypoints[0].lng, -66.9);
});

test('parseCoordinatesInput parses relaxed JSON with single quotes and trailing commas', () => {
  const input = `[
    {'lat': 40.7128, 'lng': -74.0060},
    {'lat': 34.0522, 'lng': -118.2437},
  ]`;
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, true);
  assert.equal(result.waypoints.length, 2);
  assert.equal(result.waypoints[0].lat, 40.7128);
  assert.equal(result.waypoints[0].lng, -74.006);
});

test('parseCoordinatesInput parses unquoted keys', () => {
  const input = `[{lat: 51.5074, lng: -0.1278}, {lat: 48.8566, lng: 2.3522}]`;
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, true);
  assert.equal(result.waypoints.length, 2);
  assert.equal(result.waypoints[0].lat, 51.5074);
});

test('parseCoordinatesInput parses GeoJSON [lng, lat] coordinate pairs', () => {
  const input = `[[-78.362528, -0.128265], [-78.6225983, -0.9322002]]`;
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, true);
  assert.equal(result.waypoints[0].lat, -0.128265);
  assert.equal(result.waypoints[0].lng, -78.362528);
});

test('parseCoordinatesInput parses full GeoJSON FeatureCollection', () => {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [-78.362528, -0.128265],
            [-78.6225983, -0.9322002],
          ],
        },
      },
    ],
  };
  const result = parseCoordinatesInput(JSON.stringify(geojson));
  assert.equal(result.success, true);
  assert.equal(result.waypoints.length, 2);
  assert.equal(result.waypoints[0].lat, -0.128265);
  assert.equal(result.waypoints[0].lng, -78.362528);
});

test('parseCoordinatesInput rejects empty or whitespace input', () => {
  assert.equal(parseCoordinatesInput('').success, false);
  assert.equal(parseCoordinatesInput('   ').success, false);
  assert.equal(parseCoordinatesInput(null).success, false);
});

test('parseCoordinatesInput rejects fewer than 2 waypoints', () => {
  const input = JSON.stringify([{ lat: 0, lng: 0 }]);
  const result = parseCoordinatesInput(input);
  assert.equal(result.success, false);
  assert.match(result.error, /At least 2 waypoints are required/);
});

test('parseCoordinatesInput rejects out-of-range coordinates', () => {
  const invalidLat = JSON.stringify([
    { lat: 95, lng: 0 },
    { lat: 0, lng: 0 },
  ]);
  const res1 = parseCoordinatesInput(invalidLat);
  assert.equal(res1.success, false);
  assert.match(res1.error, /latitude.*out of valid range/);

  const invalidLng = JSON.stringify([
    { lat: 0, lng: -200 },
    { lat: 0, lng: 0 },
  ]);
  const res2 = parseCoordinatesInput(invalidLng);
  assert.equal(res2.success, false);
  assert.match(res2.error, /longitude.*out of valid range/);
});

test('formatDistance produces accurate km and mi representation', () => {
  assert.equal(formatDistance(1000), '1.00 km (0.62 mi)');
  assert.equal(formatDistance(123456), '123.46 km (76.71 mi)');
  assert.equal(formatDistance(null), '0 km');
});

test('formatDuration formats hours and minutes', () => {
  assert.equal(formatDuration(3600), '1h 0m');
  assert.equal(formatDuration(3660), '1h 1m');
  assert.equal(formatDuration(90), '2 min');
  assert.equal(formatDuration(0), '0 min');
});

test('buildGeoJSON creates valid GeoJSON FeatureCollection', () => {
  const points = [
    { lat: 10, lng: 20 },
    { lat: 30, lng: 40 },
  ];
  const geojson = buildGeoJSON(points, { name: 'Test Route' });
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].type, 'Feature');
  assert.equal(geojson.features[0].geometry.type, 'LineString');
  assert.deepEqual(geojson.features[0].geometry.coordinates, [
    [20, 10],
    [40, 30],
  ]);
  assert.equal(geojson.features[0].properties.name, 'Test Route');
});
