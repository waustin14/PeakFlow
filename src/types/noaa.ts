import type { ReturnPeriod } from './project'

export interface Atlas14FrequencyEstimate {
  returnPeriodYr: ReturnPeriod
  depth24hrIn: number
}

export interface Atlas14Response {
  lat: number
  lon: number
  estimates: Atlas14FrequencyEstimate[]
  rawText?: string
}

export interface NoaaFetchState {
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string
}
