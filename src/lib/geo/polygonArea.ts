/**
 * Compute polygon area in acres using spherical excess formula.
 */
export function computePolygonAreaAcres(path: Array<{ lat: number; lng: number }>): number {
  if (path.length < 3) return 0
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  let area = 0
  const n = path.length
  for (let i = 0; i < n; i++) {
    const p1 = path[i]
    const p2 = path[(i + 1) % n]
    const lat1 = toRad(p1.lat)
    const lat2 = toRad(p2.lat)
    const dLng = toRad(p2.lng - p1.lng)
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs(area * R * R) / 2 / 4046.8564
}
