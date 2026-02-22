import { Droplets, Download, Upload, RotateCcw, Sun, Moon } from 'lucide-react'
import { StepNav } from './StepNav'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useProjectStore } from '@/store/useProjectStore'
import { useUIStore } from '@/store/useUIStore'
import { exportProjectJson } from '@/lib/export/pdfExport'

export function Sidebar() {
  const { meta, resetProject, loadProject } = useProjectStore()
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)

  const handleExportJson = () => {
    const state = useProjectStore.getState()
    exportProjectJson(state, `${meta.name.replace(/\s+/g, '-')}-project.json`)
  }

  const handleImportJson = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          loadProject(data)
        } catch {
          alert('Invalid project file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <aside className="flex h-full w-[280px] flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white">PeakFlow</div>
          <div className="text-xs text-zinc-500">TR-55 Stormwater</div>
        </div>
      </div>

      <Separator className="bg-zinc-200 dark:bg-zinc-800" />

      {/* Project name */}
      <div className="px-4 py-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Project</p>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{meta.name}</p>
      </div>

      <Separator className="bg-zinc-200 dark:bg-zinc-800" />

      {/* Step navigation */}
      <div className="flex-1 overflow-y-auto px-2">
        <StepNav />
      </div>

      <Separator className="bg-zinc-200 dark:bg-zinc-800" />

      {/* Bottom actions */}
      <div className="flex flex-col gap-1 p-3">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          onClick={handleExportJson}
        >
          <Download className="h-4 w-4 mr-2" />
          Export JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          onClick={handleImportJson}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
          onClick={() => {
            if (confirm('Reset all project data?')) resetProject()
          }}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          New Project
        </Button>
        <Separator className="bg-zinc-200 dark:bg-zinc-800 my-1" />
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <><Sun className="h-4 w-4 mr-2" />Light Mode</>
          ) : (
            <><Moon className="h-4 w-4 mr-2" />Dark Mode</>
          )}
        </Button>
      </div>
    </aside>
  )
}
