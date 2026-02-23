import { useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { useUIStore } from '@/store/useUIStore'
import { useProjectStore } from '@/store/useProjectStore'
import { DrawingControls } from './DrawingControls'
import { PolygonLayer } from './PolygonLayer'
import { ContourOverlay } from './ContourOverlay'
import { computePolygonAreaAcres } from '@/lib/geo/polygonArea'
import { computeCentroid } from '@/lib/geo/centroid'

const LIBRARIES: ('drawing' | 'geometry' | 'places')[] = ['drawing', 'geometry']
const MAP_STYLE = { width: '100%', height: '100%' }

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
]

export function WatershedMap() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  })

  const mapCenter = useUIStore((s) => s.mapCenter)
  const mapZoom = useUIStore((s) => s.mapZoom)
  const setMapCenter = useUIStore((s) => s.setMapCenter)
  const isDrawingMode = useUIStore((s) => s.isDrawingMode)
  const theme = useUIStore((s) => s.theme)
  const setIsDrawingMode = useUIStore((s) => s.setIsDrawingMode)
  const watershed = useProjectStore((s) => s.watershed)
  const setWatershed = useProjectStore((s) => s.setWatershed)

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)

  const onMapLoad = useCallback((map: google.maps.Map) => setMapInstance(map), [])

  const onPolygonComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      const path = polygon.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }))
      const areaAcres = computePolygonAreaAcres(path)
      const centroid = computeCentroid(path)
      setWatershed({ path, areaAcres, centroid })
      setIsDrawingMode(false)
      polygon.setMap(null)
      setMapCenter(centroid)
    },
    [setWatershed, setIsDrawingMode, setMapCenter]
  )

  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900">
        <div className="text-center max-w-sm px-6">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-sm font-semibold text-zinc-200 mb-1">Google Maps API key not configured</p>
          <p className="text-xs text-zinc-500">
            Add <code className="bg-zinc-800 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your{' '}
            <code className="bg-zinc-800 px-1 rounded">.env</code> and restart. Manual area entry is available on Step 2.
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-400">
        <div className="text-center">
          <p className="text-sm font-medium">Map failed to load</p>
          <p className="text-xs mt-1 text-zinc-500">{loadError.message}</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={MAP_STYLE}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoad}
        options={{
          styles: theme === 'dark' ? DARK_STYLES : [],
          zoomControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {watershed && watershed.path.length > 0 && <PolygonLayer path={watershed.path} />}
        {isDrawingMode && <DrawingControls onPolygonComplete={onPolygonComplete} />}
        <ContourOverlay map={mapInstance} />
      </GoogleMap>
    </div>
  )
}
