import { create } from 'zustand'

export type Step = 1 | 2 | 3 | 4 | 5 | 6

export type Theme = 'dark' | 'light'

export interface UIState {
  activeStep: Step
  isPanelOpen: boolean
  isDrawingMode: boolean
  mapCenter: { lat: number; lng: number }
  mapZoom: number
  theme: Theme
}

export interface UIActions {
  setActiveStep: (step: Step) => void
  setIsPanelOpen: (open: boolean) => void
  setIsDrawingMode: (drawing: boolean) => void
  setMapCenter: (center: { lat: number; lng: number }) => void
  setMapZoom: (zoom: number) => void
  toggleTheme: () => void
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  activeStep: 1,
  isPanelOpen: true,
  isDrawingMode: false,
  mapCenter: { lat: 37.0902, lng: -95.7129 },  // Center of USA
  mapZoom: 5,
  theme: (localStorage.getItem('pf-theme') as Theme) ?? 'dark',

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

}))
