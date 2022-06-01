var map = L.map('map').setView([-0.2200455, -78.5009917], 10),
  wayPoints = [],
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
