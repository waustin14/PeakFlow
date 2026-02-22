export function computeCentroid(path: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
  if (path.length === 0) return { lat: 0, lng: 0 }
  const sumLat = path.reduce((s, p) => s + p.lat, 0)
  const sumLng = path.reduce((s, p) => s + p.lng, 0)
  return { lat: sumLat / path.length, lng: sumLng / path.length }
}
