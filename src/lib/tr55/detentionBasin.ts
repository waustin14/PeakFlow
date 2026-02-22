/**
 * TR-55 Chapter 6: Detention basin storage estimation
 * Polynomial fit to Figure 6-1 (Type II storm, R² > 0.999)
 */
const TYPE_II_COEFFICIENTS = { a0: 0.682, a1: -1.43, a2: 1.64, a3: -0.804 } as const

/**
 * Compute Vs/Vr ratio from qo/qi using Figure 6-1 cubic polynomial
 */
export function computeVsOverVr(qoOverQi: number): number {
  if (qoOverQi <= 0) return TYPE_II_COEFFICIENTS.a0
  if (qoOverQi >= 1) return 0
  const r = qoOverQi
  const { a0, a1, a2, a3 } = TYPE_II_COEFFICIENTS
  return Math.max(0, Math.min(1, a0 + a1 * r + a2 * r * r + a3 * r * r * r))
}

/**
 * Compute required detention storage in acre-feet
 */
export function computeRequiredStorage(
  qoAllowableCfs: number,
  qiCfs: number,
  vrAcreFt: number
): number {
  if (qiCfs <= 0) return 0
  const qoOverQi = Math.min(qoAllowableCfs / qiCfs, 1.0)
  return computeVsOverVr(qoOverQi) * vrAcreFt
}
