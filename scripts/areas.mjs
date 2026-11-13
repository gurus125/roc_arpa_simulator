// The real areas of the simulator: id (lower case in the terrain data, upper case in the coastline
// constants), title, origin (the scenario frame's 0,0) and the box that is cut out, degrees.
// Used by make-coast.mjs and make-terrain.mjs.
export const AREAS = [
  { id: "MUMBAI", title: "Approaches to Mumbai", origin: { lat: 18 + 50 / 60, lon: 72 + 30 / 60 }, box: { south: 18.45, north: 19.35, west: 72.3, east: 73.1 } },
  { id: "GOA", title: "Approaches to Mormugao (Goa)", origin: { lat: 15 + 25 / 60, lon: 73 + 30 / 60 }, box: { south: 15.0, north: 15.8, west: 73.35, east: 74.15 } },
  { id: "KOCHI", title: "Approaches to Kochi", origin: { lat: 9 + 58 / 60, lon: 75 + 55 / 60 }, box: { south: 9.55, north: 10.35, west: 75.75, east: 76.55 } },
  { id: "KUTCH", title: "Gulf of Kutch: Kandla and Mundra", origin: { lat: 22 + 36 / 60, lon: 69 + 36 / 60 }, box: { south: 22.35, north: 23.2, west: 69.2, east: 70.45 } },
];

/** Plane-sailing conversion, the same as core/nav.ts positionOfLatLon: NM east and north of the origin. */
export const toLocal = (o, lat, lon) => ({ e: (lon - o.lon) * 60 * Math.cos((((o.lat + lat) / 2) * Math.PI) / 180), n: (lat - o.lat) * 60 });
/** And back. */
export const toLatLon = (o, e, n) => {
  const lat = o.lat + n / 60;
  return { lat, lon: o.lon + e / (60 * Math.cos((((o.lat + lat) / 2) * Math.PI) / 180)) };
};
