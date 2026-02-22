import { Polygon } from '@react-google-maps/api'
import type { LatLngLiteral } from '@/types/project'

interface PolygonLayerProps {
  path: LatLngLiteral[]
}

export function PolygonLayer({ path }: PolygonLayerProps) {
  if (path.length < 3) return null
  return (
    <Polygon
      paths={path}
      options={{
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        strokeColor: '#60a5fa',
        strokeWeight: 2,
        clickable: false,
        editable: false,
      }}
    />
  )
}
