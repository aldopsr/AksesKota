export function drawRoute(map, geometry) {
  const data = { type: 'Feature', properties: {}, geometry };
  const src = map.getSource('route');
  if (src) { src.setData(data); return; }
  map.addSource('route', { type: 'geojson', data });
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4338ca', 'line-width': 5 } });
}

export function clearRoute(map) {
  ['route-line', 'route-casing'].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource('route')) map.removeSource('route');
}
