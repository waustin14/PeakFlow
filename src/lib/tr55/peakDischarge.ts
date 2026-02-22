import type { StormType } from '@/types/project'
import { QU_TABLE } from '@/data/unitPeakDischarge'

/**
 * Ia/P = (0.2 × S) / P   clamped to [0.10, 0.50]
 */
export function computeIaOverP(rainfallIn: number, cn: number): number {
  const S = (1000 / cn) - 10
  const Ia = 0.2 * S
  const ratio = Ia / rainfallIn
  return Math.min(Math.max(ratio, 0.10), 0.50)
}

/**
 * Interpolate unit peak discharge qu (csm/in) from TR-55 Table 4-1
 * log(qu) = C0 + C1*log(Tc) + C2*(log(Tc))^2
 */
export function interpolateQu(stormType: StormType, tcHours: number, iaOverP: number): number {
  const rows = QU_TABLE[stormType]
  if (!rows || rows.length === 0) throw new Error(`Unknown storm type: ${stormType}`)

  const logTc = Math.log10(Math.max(tcHours, 0.001))

  let lower = rows[0]
  let upper = rows[rows.length - 1]

  for (let i = 0; i < rows.length - 1; i++) {
    if (iaOverP >= rows[i].iaOverP && iaOverP <= rows[i + 1].iaOverP) {
      lower = rows[i]
      upper = rows[i + 1]
      break
    }
  }

  const computeLogQu = (row: typeof lower) =>
    row.C0 + row.C1 * logTc + row.C2 * logTc * logTc

  if (lower.iaOverP === upper.iaOverP) {
    return Math.pow(10, computeLogQu(lower))
  }

  const t = (iaOverP - lower.iaOverP) / (upper.iaOverP - lower.iaOverP)
  const logQu = computeLogQu(lower) + t * (computeLogQu(upper) - computeLogQu(lower))
  return Math.pow(10, logQu)
}

/**
 * TR-55 Eq. 4-1: qp = qu × Am × Q × Fp
 * @returns peak discharge in cfs
 */
export function computePeakDischarge(
  qu: number,
  areaAcres: number,
  Q: number,
  Fp = 1.0
): number {
  const Am = areaAcres / 640
  return qu * Am * Q * Fp
}
