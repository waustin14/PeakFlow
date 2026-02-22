import type { ReturnPeriod } from './project'

export interface RunoffResult {
  returnPeriod: ReturnPeriod
  rainfallDepthIn: number
  sValue: number
  iaValue: number
  runoffDepthIn: number
  runoffVolumeAcreFt: number
}

export interface PeakDischargeResult {
  returnPeriod: ReturnPeriod
  runoffDepthIn: number
  iaOverP: number
  quCsm: number
  peakDischargeCfs: number
}

export interface DetentionBasinResult {
  returnPeriod: ReturnPeriod
  inflowCfs: number
  allowableOutflowCfs: number
  qoOverQi: number
  vsOverVr: number
  requiredStorageAcreFt: number
}

export interface HydrographPoint {
  timeHr: number
  flowCfs: number
}

export interface TR55Results {
  compositeCN: number
  tcHours: number
  areaAcres: number
  runoff: RunoffResult[]
  peakDischarge: PeakDischargeResult[]
  detentionBasin: DetentionBasinResult[]
  hydrographs: Record<ReturnPeriod, HydrographPoint[]>
  computedAt: string
}
