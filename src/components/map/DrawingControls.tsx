import { DrawingManager } from '@react-google-maps/api'

interface DrawingControlsProps {
  onPolygonComplete: (polygon: google.maps.Polygon) => void
}

export function DrawingControls({ onPolygonComplete }: DrawingControlsProps) {
  return (
    <DrawingManager
      drawingMode={google.maps.drawing.OverlayType.POLYGON}
      options={{
        drawingControl: false,
        polygonOptions: {
          fillColor: '#3b82f6',
          fillOpacity: 0.25,
          strokeColor: '#3b82f6',
          strokeWeight: 2,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
      }}
      onPolygonComplete={onPolygonComplete}
    />
  )
}
