var map = L.map('map').setView([-0.2200455, -78.5009917], 10),
  wayPoints = [
    // L.latLng(-0.128265, -78.362528),
    // L.latLng(-0.9322002, -78.6225983),
    // L.latLng(-0.95585, -78.850288),
    // L.latLng(-0.8700321, -78.8993113),
    // L.latLng(-1.6746425, -78.6502389),
    // L.latLng(-1.4693018, -78.8169396),
    // L.latLng(-2.0556571, -78.76386),
    // L.latLng(-2.201431, -78.846513),
    // L.latLng(-2.2013104, -78.8477451),
  ],
  myStyle = {
    color: '#ff7800',
    weight: 5,
    opacity: 0.65,
  };

L.tileLayer.provider('CartoDB.Voyager').addTo(map);

function generateResult() {
  let tempArray = JSON.parse(document.getElementById('coordinates').value);

  tempArray.map(function (item) {
    wayPoints.push(L.latLng(item.lat, item.lng));
  });

  let routing = L.Routing.control({
    waypoints: wayPoints,
    autoRoute: true,
    routeWhileDragging: true,
  }).addTo(map);
  routing.hide();

  routing.on('routeselected', function (e) {
    let r = e.route,
      line = L.Routing.line(r),
      bounds = line.getBounds();

    var result = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      ],
    };

    map.fitBounds(bounds);

    r.coordinates.map(function (item) {
      result.features[0].geometry.coordinates.push([item.lng, item.lat]);
    });

    document.getElementById('result').value = JSON.stringify(result);
  });
}

function cleanTextarea() {
  document.getElementById('coordinates').value = '';
}

function SelectAll(id) {
  document.getElementById(id).focus();
  document.getElementById(id).select();
}
