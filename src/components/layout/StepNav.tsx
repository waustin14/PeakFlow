import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, type Step } from '@/store/useUIStore'
import { useProjectStore, selectIsStep1Complete, selectIsStep2Complete, selectIsStep3Complete, selectIsStep4Complete, selectIsStep5Complete } from '@/store/useProjectStore'

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: 1, label: 'Project Setup', description: 'Name & return periods' },
  { id: 2, label: 'Watershed', description: 'Area delineation' },
  { id: 3, label: 'Rainfall', description: 'Design storm depths' },
  { id: 4, label: 'Land Use & Soils', description: 'Composite CN' },
  { id: 5, label: 'Time of Conc.', description: 'Flow path segments' },
  { id: 6, label: 'Results', description: 'Peak discharge & storage' },
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
    <nav className="flex flex-col gap-1 py-4">
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
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              active
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                : unlocked
                ? 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                : 'opacity-40 cursor-not-allowed text-zinc-500'
            )}
          >
            {/* Step indicator */}
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                complete
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-blue-500 text-white'
                  : unlocked
                  ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              )}
            >
              {complete ? (
                <Check className="h-3.5 w-3.5" />
              ) : !unlocked ? (
                <Lock className="h-3 w-3" />
              ) : (
                step.id
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium truncate">{step.label}</span>
              <span className="block text-xs text-zinc-500 truncate">{step.description}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
