import { useUIStore } from '@/store/useUIStore'
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

export function AppShell() {
  const activeStep = useUIStore((s) => s.activeStep)
  const StepComponent = STEP_COMPONENTS[activeStep]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Step panel */}
      <div className={`flex ${activeStep === 6 ? 'flex-1' : 'w-[380px] shrink-0'} flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950`}>
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
