import { useRef, useCallback } from 'react'
import type { GoogleMap } from '@react-google-maps/api'

/**
 * Manages the Google Maps instance ref so it can be shared across components.
 */
export function useMapInstance() {
  const mapRef = useRef<google.maps.Map | null>(null)

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onMapUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  const panTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.panTo({ lat, lng })
  }, [])

  const fitBounds = useCallback((bounds: google.maps.LatLngBounds) => {
    mapRef.current?.fitBounds(bounds)
  }, [])

  return { mapRef, onMapLoad, onMapUnmount, panTo, fitBounds }
}

// Re-export GoogleMap type for convenience
export type { GoogleMap }
