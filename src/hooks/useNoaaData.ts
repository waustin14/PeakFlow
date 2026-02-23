import { useCallback } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { fetchAtlas14 } from '@/lib/noaa/atlas14Client'
import type { ReturnPeriod } from '@/types/project'

const TARGET_PERIODS: ReturnPeriod[] = [1, 2, 5, 10, 25, 50, 100]

export function useNoaaData() {
  const watershed = useProjectStore((s) => s.watershed)
  const setNoaaFetchState = useProjectStore((s) => s.setNoaaFetchState)
  const setRainfall = useProjectStore((s) => s.setRainfall)
  const rainfall = useProjectStore((s) => s.rainfall)
  const noaaFetch = useProjectStore((s) => s.noaaFetch)

  const fetchData = useCallback(async () => {
    if (!watershed?.centroid) return

    const { lat, lng } = watershed.centroid
    setNoaaFetchState({ status: 'loading', error: undefined })

    try {
      const estimates = await fetchAtlas14(lat, lng)
      const depths: Partial<Record<ReturnPeriod, number>> = {}

      for (const est of estimates) {
        if (TARGET_PERIODS.includes(est.returnPeriodYr)) {
          depths[est.returnPeriodYr] = est.depth24hrIn
        }
      }

      setRainfall({
        depths,
        source: 'noaa',
        stormType: rainfall?.stormType ?? 'II',
        fetchedAt: new Date().toISOString(),
      })
      setNoaaFetchState({ status: 'success', lastFetchedAt: new Date().toISOString() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setNoaaFetchState({ status: 'error', error: message })
      // Degrade gracefully to manual entry — don't clear existing rainfall
    }
  }, [watershed, setNoaaFetchState, setRainfall, rainfall])

  return {
    fetch: fetchData,
    noaaFetch,
    canFetch: Boolean(watershed?.centroid?.lat && watershed?.centroid?.lng),
  }
}
