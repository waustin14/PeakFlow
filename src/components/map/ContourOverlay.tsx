import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/useUIStore'

interface ContourOverlayProps {
  map: google.maps.Map | null
}

/**
 * Imperatively manages a google.maps.ImageMapType overlay for contour tiles.
 * Renders nothing in the React tree — all side effects go through the Maps API.
 */
export function ContourOverlay({ map }: ContourOverlayProps) {
  const contourJobId = useUIStore((s) => s.contourJobId)
  const contourStatus = useUIStore((s) => s.contourStatus)
  const contourVisible = useUIStore((s) => s.contourVisible)
  const theme = useUIStore((s) => s.theme)

  const overlayRef = useRef<google.maps.ImageMapType | null>(null)

  useEffect(() => {
    if (!map) return

    // Remove any existing overlay first
    const removeOverlay = () => {
      if (overlayRef.current) {
        const idx = map.overlayMapTypes.indexOf(overlayRef.current)
        if (idx !== -1) map.overlayMapTypes.removeAt(idx)
        overlayRef.current = null
      }
    }

    removeOverlay()

    if (!contourJobId || contourStatus !== 'ready' || !contourVisible) return

    const jobId = contourJobId
    const overlay = new google.maps.ImageMapType({
      tileSize: new google.maps.Size(256, 256),
      opacity: 1,
      name: 'Contours',
      getTileUrl(coord: google.maps.Point, zoom: number): string {
        return `/contour-api/v1/contours/tiles/${jobId}/${zoom}/${coord.x}/${coord.y}.png`
      },
    })

    overlayRef.current = overlay
    map.overlayMapTypes.push(overlay)
  }, [map, contourJobId, contourStatus, contourVisible])

  // Apply CSS filter to contour tile images for dark mode visibility.
  // Contour tiles have dark lines on a transparent background, which become
  // invisible against the dark base map. invert(1) flips them to light lines.
  useEffect(() => {
    if (!map) return

    const isDark = theme === 'dark'

    const applyFilter = () => {
      const mapDiv = map.getDiv()
      if (!mapDiv) return
      mapDiv
        .querySelectorAll<HTMLImageElement>('img[src*="/contour-api/"]')
        .forEach((img) => {
          img.style.filter = isDark ? 'invert(1) brightness(1.2)' : ''
        })
    }

    applyFilter()
    const listener = map.addListener('tilesloaded', applyFilter)
    return () => google.maps.event.removeListener(listener)
  }, [map, theme, contourJobId, contourStatus, contourVisible])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (map && overlayRef.current) {
        const idx = map.overlayMapTypes.indexOf(overlayRef.current)
        if (idx !== -1) map.overlayMapTypes.removeAt(idx)
      }
    }
  }, [map])

  return null
}
