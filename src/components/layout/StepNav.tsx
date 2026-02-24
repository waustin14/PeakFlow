import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, type Step } from '@/store/useUIStore'
import {
  useProjectStore,
  selectIsStep1Complete,
  selectIsStep2Complete,
  selectIsStep3Complete,
  selectIsStep4Complete,
  selectIsStep5Complete,
} from '@/store/useProjectStore'

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: 1, label: 'Project Setup',    description: 'Name & return periods' },
  { id: 2, label: 'Watershed',        description: 'Area delineation'       },
  { id: 3, label: 'Rainfall',         description: 'Design storm depths'    },
  { id: 4, label: 'Land Use & Soils', description: 'Composite CN'           },
  { id: 5, label: 'Time of Conc.',    description: 'Flow path segments'     },
  { id: 6, label: 'Results',          description: 'Peak discharge & storage'},
]

function useStepCompletion(): Record<Step, boolean> {
  const s = useProjectStore()
  return {
    1: selectIsStep1Complete(s),
    2: selectIsStep2Complete(s),
    3: selectIsStep3Complete(s),
    4: selectIsStep4Complete(s),
    5: selectIsStep5Complete(s),
    6: false,
  }
}

export function StepNav() {
  const activeStep = useUIStore((s) => s.activeStep)
  const setActiveStep = useUIStore((s) => s.setActiveStep)
  const completions = useStepCompletion()

  const isUnlocked = (stepId: Step): boolean => {
    if (stepId === 1) return true
    for (let i = 1; i < stepId; i++) {
      if (!completions[i as Step]) return false
    }
    return true
  }

  return (
    <nav className="flex flex-col py-3 px-2 gap-0.5">
      {STEPS.map((step) => {
        const unlocked = isUnlocked(step.id)
        const complete = completions[step.id]
        const active = activeStep === step.id

        return (
          <button
            key={step.id}
            disabled={!unlocked}
            onClick={() => unlocked && setActiveStep(step.id)}
            className={cn(
              'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-150',
              active
                ? 'bg-primary/10 text-foreground'
                : unlocked
                ? 'hover:bg-accent/70 text-muted-foreground hover:text-foreground'
                : 'opacity-35 cursor-not-allowed text-muted-foreground'
            )}
          >
            {/* Left-border active indicator */}
            {active && (
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
            )}

            {/* Step badge */}
            <span
              className={cn(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-1 transition-all duration-150',
                complete
                  ? 'bg-primary ring-primary/50 shadow-sm'
                  : active
                  ? 'bg-transparent ring-primary'
                  : unlocked
                  ? 'bg-transparent ring-border'
                  : 'bg-transparent ring-border/50'
              )}
            >
              {complete ? (
                <Check className="h-3 w-3 text-primary-foreground" />
              ) : !unlocked ? (
                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    'font-display text-[10px] font-bold leading-none',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {step.id}
                </span>
              )}
            </span>

            {/* Label + description */}
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[13px] leading-tight truncate',
                  active ? 'font-semibold text-foreground' : 'font-medium'
                )}
              >
                {step.label}
              </span>
              <span className="block text-[10px] leading-tight text-muted-foreground truncate mt-0.5 tracking-wide">
                {step.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
