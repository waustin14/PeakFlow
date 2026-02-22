import type { FlowSegment, SheetFlowSegment, ShallowConcentratedSegment, ChannelFlowSegment } from '@/types/project'
import { SHALLOW_FLOW_CONSTANTS, SHEET_FLOW_MAX_LENGTH_FT } from '@/data/constants'

/**
 * TR-55 Eq. 3-1: Sheet flow travel time (hours)
 * Tt = 0.007 × (n × L)^0.8 / (P2^0.5 × s^0.4)
 * L capped at 300 ft per TR-55
 */
export function sheetFlowTt(seg: SheetFlowSegment): number {
  const L = Math.min(seg.lengthFt, SHEET_FLOW_MAX_LENGTH_FT)
  const { manningsN: n, p2InchRainfall: P2, slopeFtFt: s } = seg
  if (s <= 0) throw new Error('Slope must be > 0 for sheet flow')
  if (P2 <= 0) throw new Error('2-yr rainfall must be > 0 for sheet flow')
  const numerator = 0.007 * Math.pow(n * L, 0.8)
  const denominator = Math.pow(P2, 0.5) * Math.pow(s, 0.4)
  return numerator / denominator
}

/**
 * TR-55 Figure 3-1: Shallow concentrated flow travel time (hours)
 * V = k × √s  (k=16.1345 unpaved, k=20.3282 paved)
 * Tt = L / (3600 × V)
 */
export function shallowConcentratedFlowTt(seg: ShallowConcentratedSegment): number {
  const { slopeFtFt: s, lengthFt: L, surfaceType } = seg
  if (s <= 0) throw new Error('Slope must be > 0 for shallow concentrated flow')
  const k = SHALLOW_FLOW_CONSTANTS[surfaceType]
  const V = k * Math.sqrt(s)
  return L / (3600 * V)
}

/**
 * Manning's equation for channel flow travel time (hours)
 * V = (1.49/n) × R^(2/3) × s^(1/2)  [ft/s]
 * Tt = L / (3600 × V)
 */
export function channelFlowTt(seg: ChannelFlowSegment): number {
  const { slopeFtFt: s, lengthFt: L, manningsN: n, hydraulicRadiusFt: R } = seg
  if (s <= 0) throw new Error('Slope must be > 0 for channel flow')
  if (R <= 0) throw new Error('Hydraulic radius must be > 0')
  const V = (1.49 / n) * Math.pow(R, 2 / 3) * Math.pow(s, 0.5)
  return L / (3600 * V)
}

export function computeSegmentTt(seg: FlowSegment): number {
  switch (seg.type) {
    case 'sheet': return sheetFlowTt(seg)
    case 'shallow_concentrated': return shallowConcentratedFlowTt(seg)
    case 'channel': return channelFlowTt(seg)
  }
}

/** Tc = Σ Tt_i */
export function computeTotalTc(segments: FlowSegment[]): number {
  return segments.reduce((sum, seg) => sum + computeSegmentTt(seg), 0)
}
