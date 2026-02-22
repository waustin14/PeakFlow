import { useEffect } from 'react'
import { Plus, GripVertical, Trash2, Clock } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectStore, type NewFlowSegment } from '@/store/useProjectStore'
import { computeSegmentTt, computeTotalTc } from '@/lib/tr55/timeOfConcentration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { FlowSegment, FlowSegmentType } from '@/types/project'
import { SHEET_FLOW_MANNINGS_N, CHANNEL_MANNINGS_N } from '@/data/constants'

const SEGMENT_TYPES: { value: FlowSegmentType; label: string }[] = [
  { value: 'sheet', label: 'Sheet Flow' },
  { value: 'shallow_concentrated', label: 'Shallow Concentrated' },
  { value: 'channel', label: 'Channel Flow (Manning)' },
]

export function Step5TimeOfConc() {
  const flowSegments = useProjectStore((s) => s.flowSegments)
  const addFlowSegment = useProjectStore((s) => s.addFlowSegment)
  const updateFlowSegment = useProjectStore((s) => s.updateFlowSegment)
  const removeFlowSegment = useProjectStore((s) => s.removeFlowSegment)
  const reorderFlowSegments = useProjectStore((s) => s.reorderFlowSegments)
  const setTcHours = useProjectStore((s) => s.setTcHours)
  const tcHours = useProjectStore((s) => s.tcHours)

  // Compute Tc whenever segments change
  useEffect(() => {
    if (flowSegments.length === 0) {
      setTcHours(null)
      return
    }
    try {
      const tc = computeTotalTc(flowSegments)
      setTcHours(tc)
      // Update individual segment travel times
      flowSegments.forEach((seg) => {
        try {
          const tt = computeSegmentTt(seg)
          if (seg.travelTimeHours !== tt) {
            updateFlowSegment(seg.id, { travelTimeHours: tt })
          }
        } catch { /* skip invalid */ }
      })
    } catch {
      setTcHours(null)
    }
  }, [flowSegments.map((s) => JSON.stringify(s)).join(',')])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = flowSegments.findIndex((s) => s.id === active.id)
      const newIndex = flowSegments.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(flowSegments, oldIndex, newIndex)
      reorderFlowSegments(reordered.map((s) => s.id))
    }
  }

  const handleAddSegment = (type: FlowSegmentType) => {
    const label = `${SEGMENT_TYPES.find(t => t.value === type)?.label} ${flowSegments.length + 1}`
    const lengthFt = 100
    const slopeFtFt = 0.02
    if (type === 'sheet') {
      addFlowSegment({ type: 'sheet', label, lengthFt, slopeFtFt, manningsN: 0.15, p2InchRainfall: 3.0 })
    } else if (type === 'shallow_concentrated') {
      addFlowSegment({ type: 'shallow_concentrated', label, lengthFt, slopeFtFt, surfaceType: 'unpaved' })
    } else {
      addFlowSegment({ type: 'channel', label, lengthFt, slopeFtFt, manningsN: 0.030, hydraulicRadiusFt: 1.0 })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Time of Concentration</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Define flow path segments. Drag to reorder. Tc = Σ travel times.
        </p>
      </div>

      {/* Tc summary */}
      {tcHours !== null && (
        <Card className="bg-blue-900/30 border-blue-700">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-xs text-blue-300 uppercase tracking-wider mb-0.5">Total Tc</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {tcHours.toFixed(3)} hr
                <span className="text-sm text-zinc-400 ml-2 font-normal">
                  ({(tcHours * 60).toFixed(1)} min)
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add segment buttons */}
      <div className="flex gap-2 flex-wrap">
        {SEGMENT_TYPES.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant="outline"
            onClick={() => handleAddSegment(t.value)}
            className="border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-blue-500"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t.label}
          </Button>
        ))}
      </div>

      {/* Sortable segment list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={flowSegments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {flowSegments.map((seg, idx) => (
              <SortableSegmentCard
                key={seg.id}
                seg={seg}
                index={idx}
                onUpdate={(updates) => updateFlowSegment(seg.id, updates)}
                onRemove={() => removeFlowSegment(seg.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {flowSegments.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-6">
          No flow segments yet. Add sheet flow, shallow concentrated, or channel segments above.
        </p>
      )}
    </div>
  )
}

function SortableSegmentCard({
  seg,
  index,
  onUpdate,
  onRemove,
}: {
  seg: FlowSegment
  index: number
  onUpdate: (updates: Partial<FlowSegment>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: seg.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  let ttDisplay = '—'
  try {
    const tt = computeSegmentTt(seg)
    ttDisplay = `${tt.toFixed(3)} hr`
  } catch { /* invalid inputs */ }

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <button {...attributes} {...listeners} className="cursor-grab text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-xs text-zinc-500 w-5">{index + 1}</span>
        <Input
          value={seg.label}
          onChange={(e) => onUpdate({ label: e.target.value } as Partial<FlowSegment>)}
          className="flex-1 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-sm h-7"
        />
        <span className="text-xs text-blue-400 tabular-nums whitespace-nowrap">{ttDisplay}</span>
        <button onClick={onRemove} className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3">
        <SegmentFields seg={seg} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

function SegmentFields({ seg, onUpdate }: { seg: FlowSegment; onUpdate: (u: Partial<FlowSegment>) => void }) {
  const numField = (label: string, key: string, value: number, step = 1, unit = '') => (
    <div className="space-y-0.5">
      <Label className="text-zinc-500 dark:text-zinc-400 text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onUpdate({ [key]: v } as Partial<FlowSegment>)
          }}
          className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-xs h-8 tabular-nums"
        />
        {unit && <span className="text-xs text-zinc-500 whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  )

  const commonFields = (
    <div className="grid grid-cols-2 gap-2">
      {numField('Length', 'lengthFt', seg.lengthFt, 10, 'ft')}
      {numField('Slope', 'slopeFtFt', seg.slopeFtFt, 0.001, 'ft/ft')}
    </div>
  )

  if (seg.type === 'sheet') {
    return (
      <div className="space-y-2">
        {commonFields}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <Label className="text-zinc-500 dark:text-zinc-400 text-xs flex items-center gap-1">
              Manning's n
              <InfoTooltip content="Sheet flow Manning's n from TR-55 Table 3-1." />
            </Label>
            <Select value={String(seg.manningsN)} onValueChange={(v) => onUpdate({ manningsN: parseFloat(v) } as Partial<FlowSegment>)}>
              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                {Object.entries(SHEET_FLOW_MANNINGS_N).map(([k, v]) => (
                  <SelectItem key={k} value={String(v.n)} className="text-zinc-700 dark:text-zinc-200 text-xs focus:bg-zinc-100 dark:focus:bg-zinc-700">
                    {v.n} – {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {numField('2-yr P (in)', 'p2InchRainfall', seg.p2InchRainfall, 0.1, 'in')}
        </div>
        <p className="text-xs text-zinc-500">Length capped at 300 ft per TR-55</p>
      </div>
    )
  }

  if (seg.type === 'shallow_concentrated') {
    return (
      <div className="space-y-2">
        {commonFields}
        <div className="space-y-0.5">
          <Label className="text-zinc-500 dark:text-zinc-400 text-xs">Surface Type</Label>
          <Select value={seg.surfaceType} onValueChange={(v) => onUpdate({ surfaceType: v } as Partial<FlowSegment>)}>
            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              <SelectItem value="unpaved" className="text-zinc-700 dark:text-zinc-200 text-xs focus:bg-zinc-100 dark:focus:bg-zinc-700">Unpaved (k = 16.13)</SelectItem>
              <SelectItem value="paved" className="text-zinc-700 dark:text-zinc-200 text-xs focus:bg-zinc-100 dark:focus:bg-zinc-700">Paved (k = 20.33)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  // channel
  return (
    <div className="space-y-2">
      {commonFields}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-zinc-500 dark:text-zinc-400 text-xs">Manning's n</Label>
          <Select value={String(seg.manningsN)} onValueChange={(v) => onUpdate({ manningsN: parseFloat(v) } as Partial<FlowSegment>)}>
            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              {Object.entries(CHANNEL_MANNINGS_N).map(([k, v]) => (
                <SelectItem key={k} value={String(v.n)} className="text-zinc-700 dark:text-zinc-200 text-xs focus:bg-zinc-100 dark:focus:bg-zinc-700">
                  {v.n} – {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {numField('Hyd. Radius', 'hydraulicRadiusFt', seg.hydraulicRadiusFt, 0.1, 'ft')}
      </div>
    </div>
  )
}
