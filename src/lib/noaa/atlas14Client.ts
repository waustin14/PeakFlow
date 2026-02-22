import type { Atlas14FrequencyEstimate } from '@/types/noaa'
import { parseAtlas14Response } from './atlas14Parser'

const NOAA_PATH =
  '/cgi-bin/new/cgi_readH5.py?type=pf&units=english&series=pds&statistic=ARI&datatype=depth'

export async function fetchAtlas14(lat: number, lon: number): Promise<Atlas14FrequencyEstimate[]> {
  const params = `${NOAA_PATH}&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`
  const proxyUrl = `/noaa-api${params}`
  const directUrl = `https://hdsc.nws.noaa.gov${params}`

  let text: string | null = null

  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) })
    if (res.ok) text = await res.text()
  } catch { /* fall through */ }

  if (!text) {
    try {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`NOAA returned status ${res.status}`)
      text = await res.text()
    } catch (err) {
      throw new Error(
        `Failed to fetch NOAA Atlas 14: ${err instanceof Error ? err.message : 'Network error'}`
      )
    }
  }

  return parseAtlas14Response(text)
}
