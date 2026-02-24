import { useState, useMemo } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { useCompositeCN } from '@/hooks/useCompositeCN'
import { CN_TABLE } from '@/data/cnTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { HydrologicSoilGroup, LandUseEntry } from '@/types/project'

const HSG_OPTIONS: HydrologicSoilGroup[] = ['A', 'B', 'C', 'D']

export function Step4LandUseSoils() {
  useCompositeCN()

  const watershed = useProjectStore((s) => s.watershed)
  const landUseEntries = useProjectStore((s) => s.landUseEntries)
  const compositeCN = useProjectStore((s) => s.compositeCN)
  const addLandUseEntry = useProjectStore((s) => s.addLandUseEntry)
  const updateLandUseEntry = useProjectStore((s) => s.updateLandUseEntry)
  const removeLandUseEntry = useProjectStore((s) => s.removeLandUseEntry)

  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [selectedHSG, setSelectedHSG] = useState<HydrologicSoilGroup>('B')
  const [areaInput, setAreaInput] = useState('')

  const filtered = useMemo(() =>
    CN_TABLE.filter((e) => e.label.toLowerCase().includes(search.toLowerCase()) || e.code.includes(search.toLowerCase())),
    [search]
  )

  const selectedEntry = useMemo(() => CN_TABLE.find((e) => e.code === selectedCode), [selectedCode])
  const selectedCN = selectedEntry?.cn[selectedHSG] ?? null

  const totalArea = landUseEntries.reduce((s, e) => s + e.areaAcres, 0)
  const watershedArea = watershed?.areaAcres ?? 0

  const handleAdd = () => {
    if (!selectedEntry || !selectedCN) return
    const area = parseFloat(areaInput)
    if (isNaN(area) || area <= 0) return

    addLandUseEntry({
      code: selectedEntry.code,
      label: selectedEntry.label,
      hsg: selectedHSG,
      cn: selectedCN,
      areaAcres: area,
    })
    setAreaInput('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Land Use & Soils</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Build the composite CN from land use / hydrologic soil group combinations.
        </p>
      </div>

      {/* Composite CN badge */}
      {compositeCN !== null && (
        <Card className="bg-primary/15 border-primary/50">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary/70 uppercase tracking-wider mb-0.5">Composite CN</p>
              <p className="text-3xl font-bold text-foreground tabular-nums">{compositeCN.toFixed(1)}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{totalArea.toFixed(2)} ac defined</div>
              {watershedArea > 0 && (
                <div className={Math.abs(totalArea - watershedArea) / watershedArea > 0.05 ? 'text-amber-400' : 'text-emerald-400'}>
                  {((totalArea / watershedArea) * 100).toFixed(0)}% of watershed
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add entry form */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            Add Land Use
            <InfoTooltip content="TR-55 Table 2-2 CN values. Select land use type, hydrologic soil group (HSG), and area. Composite CN = Σ(CN·A) / ΣA." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Land use search */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Land Use Type</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search land use…"
                className="bg-muted border-border text-foreground pl-8"
              />
            </div>
            {search && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted">
                {filtered.slice(0, 20).map((entry) => (
                  <button
                    key={entry.code}
                    onClick={() => { setSelectedCode(entry.code); setSearch('') }}
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {entry.label}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
                )}
              </div>
            )}
            {selectedEntry && (
              <p className="text-xs text-primary/80 truncate">{selectedEntry.label}</p>
            )}
          </div>

          {/* HSG selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Hydrologic Soil Group</Label>
              <Select value={selectedHSG} onValueChange={(v) => setSelectedHSG(v as HydrologicSoilGroup)}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {HSG_OPTIONS.map((hsg) => (
                    <SelectItem key={hsg} value={hsg} className="text-foreground/80 focus:bg-accent">
                      HSG {hsg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">CN</Label>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted px-3 text-foreground font-semibold tabular-nums">
                {selectedCN ?? '—'}
              </div>
            </div>
          </div>

          {/* Area input */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Area (acres)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0.01"
                step="0.1"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder="e.g., 50.0"
                className="bg-muted border-border text-foreground"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button
                onClick={handleAdd}
                disabled={!selectedEntry || !selectedCN || !areaInput}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entry table */}
      {landUseEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Land Use Entries</h3>
          <div className="space-y-2">
            {landUseEntries.map((entry) => (
              <LandUseRow
                key={entry.id}
                entry={entry}
                onAreaChange={(v) => updateLandUseEntry(entry.id, { areaAcres: v })}
                onRemove={() => removeLandUseEntry(entry.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LandUseRow({
  entry,
  onAreaChange,
  onRemove,
}: {
  entry: LandUseEntry
  onAreaChange: (v: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground font-medium truncate">{entry.label}</p>
        <p className="text-xs text-muted-foreground">HSG {entry.hsg} · CN {entry.cn}</p>
      </div>
      <Input
        type="number"
        min="0.01"
        step="0.1"
        value={entry.areaAcres}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v) && v > 0) onAreaChange(v)
        }}
        className="w-20 bg-card border-border text-foreground text-xs h-8 tabular-nums"
      />
      <span className="text-xs text-muted-foreground">ac</span>
      <button onClick={onRemove} className="text-muted-foreground/60 hover:text-destructive transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
