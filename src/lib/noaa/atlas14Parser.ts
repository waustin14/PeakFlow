import type { Atlas14FrequencyEstimate } from '@/types/noaa'
import type { ReturnPeriod } from '@/types/project'

const TARGET_PERIODS: ReturnPeriod[] = [1, 2, 5, 10, 25, 50, 100]

// Column order in NOAA Atlas 14 JS response (ARI return periods)
const ARI_COLUMNS = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000]

// Row index of the 24-hour duration in the standard 19-duration NOAA ordering:
// 5min, 10min, 15min, 30min, 60min, 2hr, 3hr, 6hr, 12hr, 24hr, 2day, ...
const IDX_24HR = 9

/**
 * Parse NOAA Atlas 14 response.
 * Handles both the current JS variable-assignment format (quantiles = [...])
 * and the legacy columnar text format.
 */
export function parseAtlas14Response(text: string): Atlas14FrequencyEstimate[] {
  if (text.includes('quantiles')) {
    return parseJsFormat(text)
  }
  return parseColumnarFormat(text)
}

function parseJsFormat(text: string): Atlas14FrequencyEstimate[] {
  const match = text.match(/quantiles\s*=\s*(\[[\s\S]*?\]);/)
  if (!match) throw new Error('Could not find quantiles array in NOAA Atlas 14 response')

  // Extract each inner row: ['v', 'v', ...]
  const rowPattern = /\[([^\[\]]+)\]/g
  const rows: number[][] = []
  let m: RegExpExecArray | null
  while ((m = rowPattern.exec(match[1])) !== null) {
    const vals = m[1].match(/[\d.]+/g)?.map(parseFloat) ?? []
    if (vals.length > 0) rows.push(vals)
  }

  if (rows.length <= IDX_24HR) {
    throw new Error('Could not find 24-hour row in NOAA Atlas 14 response')
  }

  const row = rows[IDX_24HR]
  const estimates: Atlas14FrequencyEstimate[] = []

  for (const period of TARGET_PERIODS) {
    const colIdx = ARI_COLUMNS.indexOf(period)
    if (colIdx === -1 || colIdx >= row.length) continue
    const depth = row[colIdx]
    if (depth > 0 && depth < 50) {
      estimates.push({ returnPeriodYr: period, depth24hrIn: depth })
    }
  }

  if (estimates.length === 0) {
    throw new Error('No precipitation estimates found in NOAA Atlas 14 response')
  }
  return estimates
}

function parseColumnarFormat(text: string): Atlas14FrequencyEstimate[] {
  const lines = text.split('\n')

  let headerLine = ''
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/ARI.*years|return\s+period/i.test(lines[i])) {
      headerLine = lines[i]
      headerIdx = i
      break
    }
  }

  const returnPeriodColumns: Array<{ period: ReturnPeriod; colStart: number }> = []
  if (headerLine) {
    const ariMatches = [...headerLine.matchAll(/\b(\d+)\b/g)]
    for (const m of ariMatches) {
      const val = parseInt(m[1], 10)
      if (TARGET_PERIODS.includes(val as ReturnPeriod)) {
        returnPeriodColumns.push({ period: val as ReturnPeriod, colStart: m.index! })
      }
    }
  }

  let depthLine = ''
  for (let i = Math.max(0, headerIdx); i < lines.length; i++) {
    if (/\b24(-?h(our)?r?s?|hr)\b/i.test(lines[i])) {
      depthLine = lines[i]
      break
    }
  }

  if (!depthLine) {
    throw new Error('Could not find 24-hour row in NOAA Atlas 14 response')
  }

  const allNums = [...depthLine.matchAll(/[\d]+\.[\d]+/g)].map((m) => ({
    value: parseFloat(m[0]),
    index: m.index!,
  }))

  const estimates: Atlas14FrequencyEstimate[] = []

  if (returnPeriodColumns.length > 0 && allNums.length > 0) {
    for (const col of returnPeriodColumns) {
      let best = allNums[0]
      let bestDist = Math.abs(allNums[0].index - col.colStart)
      for (const num of allNums) {
        const dist = Math.abs(num.index - col.colStart)
        if (dist < bestDist) { best = num; bestDist = dist }
      }
      if (best.value > 0 && best.value < 50) {
        estimates.push({ returnPeriodYr: col.period, depth24hrIn: best.value })
      }
    }
  } else if (allNums.length >= TARGET_PERIODS.length) {
    for (let i = 0; i < TARGET_PERIODS.length && i < allNums.length; i++) {
      estimates.push({ returnPeriodYr: TARGET_PERIODS[i], depth24hrIn: allNums[i].value })
    }
  }

  if (estimates.length === 0) {
    throw new Error('No precipitation estimates found in NOAA Atlas 14 response')
  }
  return estimates
}
