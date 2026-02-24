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
    <aside
      className="sidebar-grid-pattern flex h-full w-[280px] flex-col border-r"
      style={{
        background: 'hsl(var(--sidebar-bg))',
        borderColor: 'hsl(var(--sidebar-border))',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5">
        {/* Icon with ring */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25 shadow-sm">
          <Droplets className="h-[18px] w-[18px] text-primary" />
        </div>

        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold tracking-[0.14em] uppercase text-foreground leading-tight">
            PeakFlow
          </div>
          <div className="font-display text-[9px] font-medium tracking-[0.18em] uppercase text-muted-foreground leading-tight mt-0.5">
            TR-55 Analysis
          </div>
        </div>
      </div>

      <Separator style={{ background: 'hsl(var(--sidebar-border))' }} />

      {/* ── Active Project ────────────────────────────────── */}
      <div className="px-5 py-3">
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
          Active Project
        </p>
        <p className="text-sm font-medium text-foreground truncate leading-snug">{meta.name}</p>
      </div>

      <Separator style={{ background: 'hsl(var(--sidebar-border))' }} />

      {/* ── Step Navigation ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <StepNav />
      </div>

      <Separator style={{ background: 'hsl(var(--sidebar-border))' }} />

      {/* ── Bottom Actions ────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 p-3">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          onClick={handleExportJson}
        >
          <Download className="h-3.5 w-3.5 mr-2 opacity-60" />
          <span className="text-xs">Export JSON</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          onClick={handleImportJson}
        >
          <Upload className="h-3.5 w-3.5 mr-2 opacity-60" />
          <span className="text-xs">Import JSON</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={() => {
            if (confirm('Reset all project data?')) resetProject()
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-2 opacity-60" />
          <span className="text-xs">New Project</span>
        </Button>

        <Separator className="my-1" style={{ background: 'hsl(var(--sidebar-border))' }} />

        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 mr-2 opacity-60" />
              <span className="text-xs">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 mr-2 opacity-60" />
              <span className="text-xs">Dark Mode</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
