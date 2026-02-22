import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  filename?: string
  title?: string
}

export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const { filename = 'peakflow-report.pdf', title } = options

  const canvas = await html2canvas(element, {
    backgroundColor: '#18181b',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const pageWidth = 210
  const pageHeight = 297
  const margin = 10
  const usableWidth = pageWidth - 2 * margin
  const scale = usableWidth / (imgWidth / 2)
  const scaledHeight = (imgHeight / 2) * scale

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  if (title) {
    pdf.setFontSize(14)
    pdf.text(title, margin, margin + 5)
  }

  const topOffset = title ? margin + 12 : margin
  const usablePageHeight = pageHeight - topOffset - margin

  let yOffset = 0
  let page = 0

  while (yOffset < scaledHeight) {
    if (page > 0) pdf.addPage()
    const sliceHeight = Math.min(usablePageHeight, scaledHeight - yOffset)
    const srcY = (yOffset / scale) * 2

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = imgWidth
    sliceCanvas.height = (sliceHeight / scale) * 2
    const ctx = sliceCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, srcY, imgWidth, sliceCanvas.height, 0, 0, imgWidth, sliceCanvas.height)

    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, page === 0 ? topOffset : margin, usableWidth, sliceHeight)
    yOffset += sliceHeight
    page++
  }

  pdf.save(filename)
}

export function exportProjectJson(data: unknown, filename = 'peakflow-project.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
