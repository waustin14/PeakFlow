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
        <h2 className="text-lg font-semibold text-foreground">Project Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your project name and design return periods.</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-muted-foreground">Project Name</Label>
            <Input
              id="project-name"
              value={meta.name}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Riverside Subdivision – Basin A"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Design Return Periods</CardTitle>
          <CardDescription className="text-muted-foreground">
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
                  className="border-border"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {period}-yr
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground px-1">
        Created: {new Date(meta.createdAt).toLocaleDateString()}
        {' · '}
        Modified: {new Date(meta.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}
