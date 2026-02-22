import { CloudDownload, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { useNoaaData } from '@/hooks/useNoaaData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { ReturnPeriod, StormType } from '@/types/project'

const STORM_TYPES: { value: StormType; label: string; region: string }[] = [
  { value: 'I', label: 'Type I', region: 'Pacific Coast' },
  { value: 'IA', label: 'Type IA', region: 'Pacific Northwest' },
  { value: 'II', label: 'Type II', region: 'Central/Eastern US (most common)' },
  { value: 'III', label: 'Type III', region: 'Gulf Coast / Atlantic' },
]

export function Step3Rainfall() {
  const returnPeriods = useProjectStore((s) => s.returnPeriods)
  const rainfall = useProjectStore((s) => s.rainfall)
  const setRainfallDepth = useProjectStore((s) => s.setRainfallDepth)
  const setStormType = useProjectStore((s) => s.setStormType)
  const { fetch: fetchNoaa, noaaFetch, canFetch } = useNoaaData()

  const stormType = rainfall?.stormType ?? 'II'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Rainfall Depths</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Fetch 24-hr design storm depths from NOAA Atlas 14 or enter manually.
        </p>
      </div>

      {/* NOAA Fetch */}
      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white flex items-center gap-2">
            NOAA Atlas 14
            <InfoTooltip content="Fetches 24-hour precipitation frequency estimates from NOAA HDSC for the watershed centroid location." />
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            {canFetch
              ? 'Watershed centroid detected — ready to fetch.'
              : 'Define a watershed on Step 2 to enable auto-fetch.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={fetchNoaa}
            disabled={!canFetch || noaaFetch.status === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {noaaFetch.status === 'loading' ? (
              <LoadingSpinner size="sm" label="Fetching NOAA data…" />
            ) : (
              <>
                <CloudDownload className="h-4 w-4 mr-2" />
                Fetch from NOAA Atlas 14
              </>
            )}
          </Button>

          {noaaFetch.status === 'error' && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                NOAA fetch failed ({noaaFetch.error}). Enter depths manually below.
              </span>
            </div>
          )}

          {noaaFetch.status === 'success' && rainfall?.source === 'noaa' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ NOAA depths loaded — edit any values below if needed.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Storm type */}
      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white flex items-center gap-2">
            Storm Distribution Type
            <InfoTooltip content="SCS 24-hour rainfall distribution type. Type II is most common for central/eastern US. Affects unit peak discharge (qu)." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={stormType} onValueChange={(v) => setStormType(v as StormType)}>
            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              {STORM_TYPES.map((st) => (
                <SelectItem key={st.value} value={st.value} className="text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-700">
                  <span className="font-medium">{st.label}</span>
                  <span className="text-zinc-500 dark:text-zinc-400 ml-2 text-xs">{st.region}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Depth table */}
      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white flex items-center gap-2">
            24-hr Rainfall Depths
            <InfoTooltip content="24-hour total precipitation depth (inches) for each return period. P is used directly in the TR-55 runoff equation Q = (P - Ia)² / (P - Ia + S)." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(returnPeriods as ReturnPeriod[]).map((period) => (
              <div key={period} className="flex items-center gap-3">
                <Label className="w-16 text-zinc-600 dark:text-zinc-300 shrink-0 text-sm">{period}-yr</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rainfall?.depths[period] ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val >= 0) setRainfallDepth(period, val)
                  }}
                  placeholder="0.00"
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white w-28 tabular-nums"
                />
                <span className="text-xs text-zinc-500">inches</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
