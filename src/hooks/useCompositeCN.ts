import { useEffect } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { computeCompositeCN } from '@/lib/tr55/runoffVolume'

/**
 * Derives weighted composite CN from land use entries whenever they change.
 * Writes the result back to the store.
 */
export function useCompositeCN() {
  const landUseEntries = useProjectStore((s) => s.landUseEntries)
  const setCompositeCN = useProjectStore((s) => s.setCompositeCN)

  useEffect(() => {
    if (landUseEntries.length === 0) {
      setCompositeCN(null)
      return
    }
    const cn = computeCompositeCN(landUseEntries)
    setCompositeCN(Math.round(cn * 10) / 10)
  }, [landUseEntries, setCompositeCN])
}
