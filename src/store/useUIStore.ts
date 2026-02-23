import { create } from 'zustand'

export type Step = 1 | 2 | 3 | 4 | 5 | 6

export type Theme = 'dark' | 'light'

export type ContourStatus = 'idle' | 'queued' | 'running' | 'ready' | 'failed'

export type ContourIntervalFt = 2 | 5 | 10

export interface UIState {
  activeStep: Step
  isPanelOpen: boolean
  isDrawingMode: boolean
  mapCenter: { lat: number; lng: number }
  mapZoom: number
  theme: Theme
  // Contour overlay
  contourJobId: string | null
  contourStatus: ContourStatus
  contourProgress: number
  contourError: string | null
  contourVisible: boolean
  contourIntervalFt: ContourIntervalFt
}

export interface UIActions {
  setActiveStep: (step: Step) => void
  setIsPanelOpen: (open: boolean) => void
  setIsDrawingMode: (drawing: boolean) => void
  setMapCenter: (center: { lat: number; lng: number }) => void
  setMapZoom: (zoom: number) => void
  toggleTheme: () => void
  // Contour overlay
  setContourJob: (jobId: string) => void
  setContourStatus: (status: ContourStatus, progress: number, error?: string | null) => void
  setContourVisible: (visible: boolean) => void
  setContourIntervalFt: (ft: ContourIntervalFt) => void
  resetContour: () => void
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  activeStep: 1,
  isPanelOpen: true,
  isDrawingMode: false,
  mapCenter: { lat: 37.0902, lng: -95.7129 },  // Center of USA
  mapZoom: 5,
  theme: (localStorage.getItem('pf-theme') as Theme) ?? 'dark',
  contourJobId: null,
  contourStatus: 'idle',
  contourProgress: 0,
  contourError: null,
  contourVisible: true,
  contourIntervalFt: 5,

  setActiveStep: (step) => set({ activeStep: step }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setIsDrawingMode: (drawing) => set({ isDrawingMode: drawing }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  toggleTheme: () => set((s) => {
    const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('pf-theme', next)
    return { theme: next }
  }),
  setContourJob: (jobId) => set({ contourJobId: jobId }),
  setContourStatus: (status, progress, error = null) => set({ contourStatus: status, contourProgress: progress, contourError: error }),
  setContourVisible: (visible) => set({ contourVisible: visible }),
  setContourIntervalFt: (ft) => set({ contourIntervalFt: ft }),
  resetContour: () => set({ contourJobId: null, contourStatus: 'idle', contourProgress: 0, contourError: null, contourVisible: true }),
}))
