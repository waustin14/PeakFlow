import { useState } from 'react'
import { MapPin, PenLine, Trash2, Hand } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { useUIStore } from '@/store/useUIStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Step2Watershed() {
  const watershed = useProjectStore((s) => s.watershed)
  const setWatershed = useProjectStore((s) => s.setWatershed)
  const setManualArea = useProjectStore((s) => s.setManualArea)
  const isDrawingMode = useUIStore((s) => s.isDrawingMode)
  const setIsDrawingMode = useUIStore((s) => s.setIsDrawingMode)

  const [manualArea, setManualAreaLocal] = useState('')
  const [showManual, setShowManual] = useState(false)

  const handleManualSubmit = () => {
    const val = parseFloat(manualArea)
    if (val > 0) {
      setManualArea(val)
      setManualAreaLocal('')
      setShowManual(false)
    }
  }

  const handleClearWatershed = () => {
    setWatershed(null)
    setIsDrawingMode(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Watershed Delineation</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Draw your watershed boundary on the map or enter the area manually.
        </p>
      </div>

      {/* Map drawing controls */}
      <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-900 dark:text-white">Map Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isDrawingMode ? (
            <Button
              onClick={() => setIsDrawingMode(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <PenLine className="h-4 w-4 mr-2" />
              Draw Watershed Polygon
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => setIsDrawingMode(false)}
                variant="outline"
                className="w-full border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
              >
                <Hand className="h-4 w-4 mr-2" />
                Cancel Drawing
              </Button>
              <p className="text-xs text-blue-400 text-center">
                Click points on the map to draw. Double-click to close the polygon.
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowManual(!showManual)}
            className="w-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            Enter area manually
          </Button>

          {showManual && (
            <div className="space-y-2">
              <Label className="text-zinc-600 dark:text-zinc-300">Watershed Area (acres)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={manualArea}
                  onChange={(e) => setManualAreaLocal(e.target.value)}
                  placeholder="e.g., 250"
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <Button onClick={handleManualSubmit} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Set
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Watershed summary */}
      {watershed && (
        <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              Watershed Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Area</p>
                <p className="text-zinc-900 dark:text-white font-semibold tabular-nums">
                  {watershed.areaAcres.toFixed(2)} ac
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Area (sq mi)</p>
                <p className="text-zinc-900 dark:text-white font-semibold tabular-nums">
                  {(watershed.areaAcres / 640).toFixed(4)} mi²
                </p>
              </div>
              {watershed.centroid.lat !== 0 && (
                <>
                  <div>
                    <p className="text-zinc-500 text-xs mb-0.5">Centroid Lat</p>
                    <p className="text-zinc-900 dark:text-white font-semibold tabular-nums">
                      {watershed.centroid.lat.toFixed(4)}°
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs mb-0.5">Centroid Lng</p>
                    <p className="text-zinc-900 dark:text-white font-semibold tabular-nums">
                      {watershed.centroid.lng.toFixed(4)}°
                    </p>
                  </div>
                </>
              )}
              {watershed.path.length > 0 && (
                <div className="col-span-2">
                  <p className="text-zinc-500 text-xs mb-0.5">Polygon vertices</p>
                  <p className="text-zinc-900 dark:text-white font-semibold">{watershed.path.length} points</p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearWatershed}
              className="w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Watershed
            </Button>
          </CardContent>
        </Card>
      )}

      {!watershed && (
        <p className="text-xs text-zinc-500 text-center py-4">
          No watershed defined yet. Draw on the map or enter area manually.
        </p>
      )}
    </div>
  )
}
