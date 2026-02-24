import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { WatershedMap } from '@/components/map/WatershedMap'
import { Step1ProjectSetup } from '@/components/steps/Step1ProjectSetup'
import { Step2Watershed } from '@/components/steps/Step2Watershed'
import { Step3Rainfall } from '@/components/steps/Step3Rainfall'
import { Step4LandUseSoils } from '@/components/steps/Step4LandUseSoils'
import { Step5TimeOfConc } from '@/components/steps/Step5TimeOfConc'
import { Step6Results } from '@/components/steps/Step6Results'
import { ScrollArea } from '@/components/ui/scroll-area'

const STEP_COMPONENTS = {
  1: Step1ProjectSetup,
  2: Step2Watershed,
  3: Step3Rainfall,
  4: Step4LandUseSoils,
  5: Step5TimeOfConc,
  6: Step6Results,
}

const STEP_LABELS: Record<number, string> = {
  1: 'Project Setup',
  2: 'Watershed',
  3: 'Rainfall',
  4: 'Land Use & Soils',
  5: 'Time of Conc.',
  6: 'Results',
}

export function AppShell() {
  const activeStep = useUIStore((s) => s.activeStep)
  const StepComponent = STEP_COMPONENTS[activeStep]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Step panel */}
      <div className={cn(
        'flex flex-col border-r border-border bg-background',
        activeStep === 6 ? 'flex-1' : 'w-[380px] shrink-0'
      )}>
        {/* Step panel header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <span className="font-mono text-xs font-bold text-primary tabular-nums tracking-wider">
            {String(activeStep).padStart(2, '0')}/{String(6).padStart(2, '0')}
          </span>
          <span className="text-border text-xs">|</span>
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {STEP_LABELS[activeStep]}
          </span>
          <div className="flex-1" />
          {/* Progress pips */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className={cn(
                  'rounded-full transition-all duration-300',
                  n < activeStep
                    ? 'h-1.5 w-1.5 bg-primary/60'
                    : n === activeStep
                    ? 'h-1.5 w-4 bg-primary step-active-dot'
                    : 'h-1.5 w-1.5 bg-border'
                )}
              />
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5">
            <StepComponent />
          </div>
        </ScrollArea>
      </div>

      {/* Map — always mounted; hidden on Step 6 where results need the space */}
      <div className={`${activeStep === 6 ? 'hidden' : 'flex-1'} overflow-hidden`}>
        <WatershedMap />
      </div>
    </div>
  )
}
