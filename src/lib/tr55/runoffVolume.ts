import type { LandUseEntry } from '@/types/project'

/** TR-55 Eq. 2-1: S = (1000/CN) - 10 */
export function computeS(cn: number): number {
  if (cn <= 0 || cn > 100) throw new Error(`Invalid CN: ${cn}`)
  return (1000 / cn) - 10
}

/** Ia = 0.2 × S */
export function computeIa(s: number): number {
  return 0.2 * s
}

/**
 * TR-55 Eq. 2-3: Q = (P - Ia)² / (P - Ia + S)
 * Returns 0 when P ≤ Ia
 */
export function computeRunoffDepth(rainfallIn: number, cn: number): number {
  const s = computeS(cn)
  const ia = computeIa(s)
  if (rainfallIn <= ia) return 0
  const numerator = (rainfallIn - ia) ** 2
  const denominator = rainfallIn - ia + s
  return numerator / denominator
}

/**
 * Volume = Q (in) × Area (ac) / 12  → acre-feet
 */
export function computeRunoffVolume(runoffDepthIn: number, areaAcres: number): number {
  return (runoffDepthIn * areaAcres) / 12
}

/**
 * Composite CN = Σ(CN_i × A_i) / Σ(A_i)
 */
export function computeCompositeCN(entries: LandUseEntry[]): number {
  const totalArea = entries.reduce((sum, e) => sum + e.areaAcres, 0)
  if (totalArea === 0) return 0
  const weightedSum = entries.reduce((sum, e) => sum + e.cn * e.areaAcres, 0)
  return weightedSum / totalArea
}
