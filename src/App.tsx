import { AppShell } from '@/components/layout/AppShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUIStore } from '@/store/useUIStore'

function App() {
  const theme = useUIStore((s) => s.theme)

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <TooltipProvider delayDuration={300}>
        <AppShell />
      </TooltipProvider>
    </div>
  )
}

export default App
