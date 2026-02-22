import type { HydrologicSoilGroup, StormType } from './project'

export interface CNTableEntry {
  code: string
  label: string
  description?: string
  cn: Partial<Record<HydrologicSoilGroup, number>>
}

export interface QuCoefficients {
  iaOverP: number
  C0: number
  C1: number
  C2: number
}

export interface TcBreakdown {
  segmentId: string
  label: string
  travelTimeHours: number
}

export type QuTable = Record<StormType, QuCoefficients[]>
