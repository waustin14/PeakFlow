import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'
import type {
  ReturnPeriod,
  WatershedGeometry,
  RainfallDepths,
  LandUseEntry,
  FlowSegment,
  SheetFlowSegment,
  ShallowConcentratedSegment,
  ChannelFlowSegment,
  NoaaFetchState,
  StormType,
} from '@/types/project'

// Distributive Omit preserves discriminated unions
type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never
export type NewFlowSegment =
  | DistributiveOmit<SheetFlowSegment, 'id'>
  | DistributiveOmit<ShallowConcentratedSegment, 'id'>
  | DistributiveOmit<ChannelFlowSegment, 'id'>
import type { TR55Results } from '@/types/results'

export interface ProjectState {
  meta: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
  returnPeriods: ReturnPeriod[]
  watershed: WatershedGeometry | null
  rainfall: RainfallDepths | null
  noaaFetch: NoaaFetchState
  landUseEntries: LandUseEntry[]
  compositeCN: number | null
  flowSegments: FlowSegment[]
  tcHours: number | null
  results: TR55Results | null
  allowableOutflows: Partial<Record<ReturnPeriod, number>>
}

export interface ProjectActions {
  // Meta
  setProjectName: (name: string) => void
  resetProject: () => void
  loadProject: (state: ProjectState) => void

  // Return periods
  setReturnPeriods: (periods: ReturnPeriod[]) => void

  // Watershed
  setWatershed: (geometry: WatershedGeometry | null) => void
  setManualArea: (acres: number) => void

  // Rainfall
  setRainfall: (rainfall: RainfallDepths) => void
  setRainfallDepth: (period: ReturnPeriod, depth: number) => void
  setStormType: (type: StormType) => void
  setNoaaFetchState: (state: Partial<NoaaFetchState>) => void

  // Land use
  addLandUseEntry: (entry: Omit<LandUseEntry, 'id'>) => void
  updateLandUseEntry: (id: string, updates: Partial<Omit<LandUseEntry, 'id'>>) => void
  removeLandUseEntry: (id: string) => void
  setCompositeCN: (cn: number | null) => void

  // Flow segments
  addFlowSegment: (segment: NewFlowSegment) => void
  updateFlowSegment: (id: string, updates: Partial<FlowSegment>) => void
  removeFlowSegment: (id: string) => void
  reorderFlowSegments: (orderedIds: string[]) => void
  setTcHours: (hours: number | null) => void

  // Results
  setResults: (results: TR55Results | null) => void
  setAllowableOutflow: (period: ReturnPeriod, cfs: number) => void
}

const DEFAULT_STATE: ProjectState = {
  meta: {
    id: uuidv4(),
    name: 'Untitled Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  returnPeriods: [2, 10, 25, 100],
  watershed: null,
  rainfall: null,
  noaaFetch: { status: 'idle' },
  landUseEntries: [],
  compositeCN: null,
  flowSegments: [],
  tcHours: null,
  results: null,
  allowableOutflows: {},
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    immer((set) => ({
      ...DEFAULT_STATE,

      setProjectName: (name) =>
        set((s) => {
          s.meta.name = name
          s.meta.updatedAt = new Date().toISOString()
        }),

      resetProject: () =>
        set(() => ({
          ...DEFAULT_STATE,
          meta: {
            id: uuidv4(),
            name: 'Untitled Project',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })),

      loadProject: (state) => set(() => ({ ...state })),

      setReturnPeriods: (periods) =>
        set((s) => {
          s.returnPeriods = periods.sort((a, b) => a - b)
          s.meta.updatedAt = new Date().toISOString()
        }),

      setWatershed: (geometry) =>
        set((s) => {
          s.watershed = geometry
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setManualArea: (acres) =>
        set((s) => {
          if (s.watershed) {
            s.watershed.areaAcres = acres
          } else {
            s.watershed = { path: [], areaAcres: acres, centroid: { lat: 0, lng: 0 } }
          }
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setRainfall: (rainfall) =>
        set((s) => {
          s.rainfall = rainfall
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setRainfallDepth: (period, depth) =>
        set((s) => {
          if (!s.rainfall) {
            s.rainfall = {
              depths: {},
              source: 'manual',
              stormType: 'II',
            }
          }
          s.rainfall.depths[period] = depth
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setStormType: (type) =>
        set((s) => {
          if (s.rainfall) {
            s.rainfall.stormType = type
            s.results = null
          }
          s.meta.updatedAt = new Date().toISOString()
        }),

      setNoaaFetchState: (state) =>
        set((s) => {
          Object.assign(s.noaaFetch, state)
        }),

      addLandUseEntry: (entry) =>
        set((s) => {
          s.landUseEntries.push({ ...entry, id: uuidv4() })
          s.compositeCN = null
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      updateLandUseEntry: (id, updates) =>
        set((s) => {
          const idx = s.landUseEntries.findIndex((e) => e.id === id)
          if (idx !== -1) {
            Object.assign(s.landUseEntries[idx], updates)
            s.compositeCN = null
            s.results = null
          }
          s.meta.updatedAt = new Date().toISOString()
        }),

      removeLandUseEntry: (id) =>
        set((s) => {
          s.landUseEntries = s.landUseEntries.filter((e) => e.id !== id)
          s.compositeCN = null
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setCompositeCN: (cn) =>
        set((s) => {
          s.compositeCN = cn
        }),

      addFlowSegment: (segment: NewFlowSegment) =>
        set((s) => {
          s.flowSegments.push({ ...segment, id: uuidv4() } as FlowSegment)
          s.tcHours = null
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      updateFlowSegment: (id, updates) =>
        set((s) => {
          const idx = s.flowSegments.findIndex((seg) => seg.id === id)
          if (idx !== -1) {
            Object.assign(s.flowSegments[idx], updates)
            s.tcHours = null
            s.results = null
          }
          s.meta.updatedAt = new Date().toISOString()
        }),

      removeFlowSegment: (id) =>
        set((s) => {
          s.flowSegments = s.flowSegments.filter((seg) => seg.id !== id)
          s.tcHours = null
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      reorderFlowSegments: (orderedIds) =>
        set((s) => {
          s.flowSegments = orderedIds
            .map((id) => s.flowSegments.find((seg) => seg.id === id))
            .filter(Boolean) as FlowSegment[]
          s.tcHours = null
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),

      setTcHours: (hours) =>
        set((s) => {
          s.tcHours = hours
        }),

      setResults: (results) =>
        set((s) => {
          s.results = results
        }),

      setAllowableOutflow: (period, cfs) =>
        set((s) => {
          s.allowableOutflows[period] = cfs
          s.results = null
          s.meta.updatedAt = new Date().toISOString()
        }),
    })),
    {
      name: 'peakflow-project',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// Selectors
export const selectIsStep1Complete = (s: ProjectState) =>
  s.meta.name.trim().length > 0 && s.returnPeriods.length > 0

export const selectIsStep2Complete = (s: ProjectState) =>
  s.watershed !== null && s.watershed.areaAcres > 0

export const selectIsStep3Complete = (s: ProjectState) => {
  if (!s.rainfall) return false
  const periods = s.returnPeriods
  return periods.every((p) => {
    const d = s.rainfall!.depths[p]
    return d !== undefined && d > 0
  })
}

export const selectIsStep4Complete = (s: ProjectState) =>
  s.landUseEntries.length > 0 &&
  s.landUseEntries.every((e) => e.areaAcres > 0) &&
  s.compositeCN !== null &&
  s.compositeCN > 0

export const selectIsStep5Complete = (s: ProjectState) =>
  s.flowSegments.length > 0 && s.tcHours !== null && s.tcHours > 0

export const selectIsStep6Complete = (s: ProjectState) => s.results !== null
