import { useCallback, useEffect, useRef } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useProjectStore } from '@/store/useProjectStore'
import type { ContourIntervalFt } from '@/store/useUIStore'

const CONTOUR_API_KEY = import.meta.env.VITE_CONTOUR_API_KEY ?? 'dev-key'
const POLL_INTERVAL_MS = 2500

function pathToGeoJsonPolygon(path: { lat: number; lng: number }[]): object {
  // GeoJSON ring must be closed (first === last) and coords are [lng, lat]
  const ring = path.map((p) => [p.lng, p.lat])
  ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

export function useContourService() {
  const watershed = useProjectStore((s) => s.watershed)

  const contourJobId = useUIStore((s) => s.contourJobId)
  const contourStatus = useUIStore((s) => s.contourStatus)
  const contourProgress = useUIStore((s) => s.contourProgress)
  const contourError = useUIStore((s) => s.contourError)
  const contourVisible = useUIStore((s) => s.contourVisible)
  const contourIntervalFt = useUIStore((s) => s.contourIntervalFt)

  const setContourJob = useUIStore((s) => s.setContourJob)
  const setContourStatus = useUIStore((s) => s.setContourStatus)
  const setContourVisible = useUIStore((s) => s.setContourVisible)
  const setContourIntervalFt = useUIStore((s) => s.setContourIntervalFt)
  const resetContour = useUIStore((s) => s.resetContour)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const pollStatus = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/contour-api/v1/contours/jobs/${jobId}`)
        if (!res.ok) return
        const data = await res.json()
        setContourStatus(data.status, data.progress ?? 0)
        if (data.status === 'ready' || data.status === 'failed') {
          stopPolling()
        }
      } catch {
        // network error — keep polling
      }
    },
    [setContourStatus, stopPolling],
  )

  const requestContours = useCallback(async () => {
    if (!watershed || watershed.path.length < 3) return

    stopPolling()
    setContourStatus('queued', 0)

    try {
      const aoi = pathToGeoJsonPolygon(watershed.path)
      const res = await fetch('/contour-api/v1/contours/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CONTOUR_API_KEY,
        },
        body: JSON.stringify({
          aoi,
          interval_ft: contourIntervalFt,
          min_zoom: 12,
          max_zoom: 17,
          format: 'png',
        }),
      })

      if (!res.ok) {
        let detail = `Server returned ${res.status}`
        try {
          const body = await res.json()
          if (typeof body.detail === 'string') detail = body.detail
        } catch { /* ignore parse errors */ }
        console.error('Contour job creation failed:', detail)
        setContourStatus('failed', 0, detail)
        return
      }

      const data = await res.json()
      setContourJob(data.jobId)

      if (data.status === 'ready') {
        setContourStatus('ready', 100)
        return
      }

      // Start polling until ready or failed
      pollTimerRef.current = setInterval(() => pollStatus(data.jobId), POLL_INTERVAL_MS)
    } catch (err) {
      console.error('Contour request error:', err)
      setContourStatus('failed', 0, 'Could not reach the contour service. Is it running?')
    }
  }, [watershed, contourIntervalFt, setContourJob, setContourStatus, stopPolling, pollStatus])

  // Resume polling if the app remounts with an in-progress job
  useEffect(() => {
    if (contourJobId && (contourStatus === 'queued' || contourStatus === 'running')) {
      if (pollTimerRef.current === null) {
        pollTimerRef.current = setInterval(() => pollStatus(contourJobId), POLL_INTERVAL_MS)
      }
    }
    return () => stopPolling()
  }, []) // intentionally run only on mount/unmount

  return {
    contourJobId,
    contourStatus,
    contourProgress,
    contourError,
    contourVisible,
    contourIntervalFt,
    canRequest: !!watershed && watershed.path.length >= 3,
    requestContours,
    toggleVisible: () => setContourVisible(!contourVisible),
    setIntervalFt: (ft: ContourIntervalFt) => {
      setContourIntervalFt(ft)
      // Stale tiles no longer match, clear the overlay
      if (contourStatus !== 'idle') resetContour()
    },
    reset: () => {
      stopPolling()
      resetContour()
    },
  }
}
