import { useRef } from 'react'
import { Calculator, Download, FileDown } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { useTR55Results } from '@/hooks/useTR55Results'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { HydrographChart } from './HydrographChart'
import { exportElementToPdf, exportProjectJson } from '@/lib/export/pdfExport'
import type { ReturnPeriod } from '@/types/project'

export function Step6Results() {
  const results = useProjectStore((s) => s.results)
  const returnPeriods = useProjectStore((s) => s.returnPeriods)
  const allowableOutflows = useProjectStore((s) => s.allowableOutflows)
  const setAllowableOutflow = useProjectStore((s) => s.setAllowableOutflow)
  const meta = useProjectStore((s) => s.meta)
  const { computeResults } = useTR55Results()
  const resultsRef = useRef<HTMLDivElement>(null)

  const handleCompute = () => computeResults()

  const handleExportPdf = async () => {
    if (resultsRef.current) {
      await exportElementToPdf(resultsRef.current, { filename: `${meta.name}-TR55-report.pdf`, title: `${meta.name} — TR-55 Results` })
    }
  }

  const handleExportJson = () => {
    exportProjectJson(useProjectStore.getState(), `${meta.name.replace(/\s+/g, '-')}-project.json`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Results</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Peak discharge, runoff volume, and detention sizing.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportJson} className="border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300">
            <Download className="h-4 w-4 mr-1" />
            JSON
          </Button>
          {results && (
            <Button size="sm" variant="outline" onClick={handleExportPdf} className="border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300">
              <FileDown className="h-4 w-4 mr-1" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Allowable outflow inputs */}
      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white flex items-center gap-2">
            Allowable Outflow (qo)
            <InfoTooltip content="Maximum allowable peak outflow from the detention basin for each return period. Used to size detention storage via TR-55 Figure 6-1." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(returnPeriods as ReturnPeriod[]).map((period) => (
              <div key={period} className="space-y-1">
                <Label className="text-zinc-400 text-xs">{period}-yr qo (cfs)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={allowableOutflows[period] ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0) setAllowableOutflow(period, v)
                  }}
                  placeholder="0"
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white tabular-nums h-8"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compute button */}
      <Button onClick={handleCompute} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        <Calculator className="h-4 w-4 mr-2" />
        Compute TR-55 Results
      </Button>

      {/* Results */}
      {results && (
        <div ref={resultsRef} className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Composite CN', value: results.compositeCN.toFixed(1) },
              { label: 'Time of Conc.', value: `${results.tcHours.toFixed(3)} hr` },
              { label: 'Watershed Area', value: `${results.areaAcres.toFixed(1)} ac` },
            ].map((item) => (
              <Card key={item.label} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">{item.label}</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Peak Discharge Table */}
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Peak Discharge (Module 3)
                <InfoTooltip content="qp = qu × Am × Q × Fp. qu from TR-55 Table 4-1, Am = area in sq mi, Q = runoff depth (in)." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200 dark:border-zinc-700">
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Period</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">P (in)</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Q (in)</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Ia/P</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">qu (csm/in)</TableHead>
                    <TableHead className="text-zinc-400 text-xs h-9 font-semibold">qp (cfs)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.peakDischarge.map((row) => (
                    <TableRow key={row.returnPeriod} className="border-zinc-200 dark:border-zinc-700">
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs font-medium">{row.returnPeriod}-yr</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{(results.runoff.find(r => r.returnPeriod === row.returnPeriod)?.rainfallDepthIn ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.runoffDepthIn.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.iaOverP.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.quCsm.toFixed(1)}</TableCell>
                      <TableCell className="text-zinc-900 dark:text-white text-xs font-bold tabular-nums">{row.peakDischargeCfs.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Runoff Volume Table */}
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Runoff Volume (Module 1)
                <InfoTooltip content="Q = (P - Ia)² / (P - Ia + S). Volume = Q × A / 12 in acre-feet." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200 dark:border-zinc-700">
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Period</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">S</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Ia (in)</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Q (in)</TableHead>
                    <TableHead className="text-zinc-400 text-xs h-9 font-semibold">Volume (ac-ft)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.runoff.map((row) => (
                    <TableRow key={row.returnPeriod} className="border-zinc-200 dark:border-zinc-700">
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs font-medium">{row.returnPeriod}-yr</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.sValue.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.iaValue.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.runoffDepthIn.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-900 dark:text-white text-xs font-bold tabular-nums">{row.runoffVolumeAcreFt.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detention Basin Table */}
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Detention Basin Sizing (Module 4)
                <InfoTooltip content="Vs/Vr from TR-55 Figure 6-1 cubic polynomial. Vs = required detention storage." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200 dark:border-zinc-700">
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Period</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">qi (cfs)</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">qo (cfs)</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">qo/qi</TableHead>
                    <TableHead className="text-zinc-500 dark:text-zinc-400 text-xs h-9">Vs/Vr</TableHead>
                    <TableHead className="text-zinc-400 text-xs h-9 font-semibold">Vs (ac-ft)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.detentionBasin.map((row) => (
                    <TableRow key={row.returnPeriod} className="border-zinc-200 dark:border-zinc-700">
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs font-medium">{row.returnPeriod}-yr</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.inflowCfs.toFixed(1)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.allowableOutflowCfs.toFixed(1)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.qoOverQi.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">{row.vsOverVr.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-900 dark:text-white text-xs font-bold tabular-nums">{row.requiredStorageAcreFt.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Hydrograph */}
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                Synthetic Hydrograph
                <InfoTooltip content="SCS triangular approximation. Time to peak = 0.6·Tc + D/2, base = 2.67·tp. Multiple return periods overlaid." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HydrographChart results={results} />
            </CardContent>
          </Card>

          <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
            Computed {new Date(results.computedAt).toLocaleString()} · TR-55 Urban Hydrology for Small Watersheds (USDA, 1986)
          </p>
        </div>
      )}
    </div>
  )
}
