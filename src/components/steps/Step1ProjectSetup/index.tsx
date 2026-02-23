import { useProjectStore } from '@/store/useProjectStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ReturnPeriod } from '@/types/project'

const AVAILABLE_PERIODS: ReturnPeriod[] = [1, 2, 5, 10, 25, 50, 100]

export function Step1ProjectSetup() {
  const { meta, returnPeriods, setProjectName, setReturnPeriods } = useProjectStore()

  const togglePeriod = (period: ReturnPeriod) => {
    if (returnPeriods.includes(period)) {
      if (returnPeriods.length > 1) {
        setReturnPeriods(returnPeriods.filter((p) => p !== period))
      }
    } else {
      setReturnPeriods([...returnPeriods, period])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Setup</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure your project name and design return periods.</p>
      </div>

      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white">Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-zinc-600 dark:text-zinc-300">Project Name</Label>
            <Input
              id="project-name"
              value={meta.name}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Riverside Subdivision – Basin A"
              className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white">Design Return Periods</CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Select the annual recurrence intervals to analyze. At least one required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {AVAILABLE_PERIODS.map((period) => (
              <label
                key={period}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Checkbox
                  checked={returnPeriods.includes(period)}
                  onCheckedChange={() => togglePeriod(period)}
                  className="border-zinc-400 dark:border-zinc-500"
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {period}-yr
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-zinc-500 px-1">
        Created: {new Date(meta.createdAt).toLocaleDateString()}
        {' · '}
        Modified: {new Date(meta.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}
