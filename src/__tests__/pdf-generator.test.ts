import { describe, it, expect } from 'vitest'
import { PdfGenerator, PdfPage } from '../services/pdf-generator'

describe('PdfGenerator', () => {
    it('outputs valid PDF starting with %PDF-1.4', () => {
        const pdf = new PdfGenerator()
        pdf.addPage()
        const bytes = pdf.generate()
        const text = new TextDecoder().decode(bytes.slice(0, 10))
        expect(text).toContain('%PDF-1.4')
    })

    it('contains %%EOF trailer', () => {
        const pdf = new PdfGenerator()
        pdf.addPage()
        const bytes = pdf.generate()
        const text = new TextDecoder().decode(bytes)
        expect(text).toContain('%%EOF')
    })

    it('encodes Japanese text as UTF-16BE hex', () => {
        const pdf = new PdfGenerator()
        const page = pdf.addPage()
        page.setFont('F2', 12)
        page.drawText(50, 700, '\u8ACB\u6C42\u66F8', true) // 請求書
        const bytes = pdf.generate()
        const text = new TextDecoder().decode(bytes)
        // UTF-16BE hex of 請求書: 8ACB 6C42 66F8
        expect(text).toContain('8ACB6C4266F8')
    })

    it('includes A4 MediaBox dimensions', () => {
        const pdf = new PdfGenerator()
        pdf.addPage()
        const bytes = pdf.generate()
        const text = new TextDecoder().decode(bytes)
        expect(text).toContain('595.28')
        expect(text).toContain('841.89')
    })

    it('supports drawing lines and rectangles', () => {
        const pdf = new PdfGenerator()
        const page = pdf.addPage()
        page.drawLine(50, 700, 545, 700, 1)
        page.drawRect(50, 680, 495, 16, 0.9)
        const bytes = pdf.generate()
        const text = new TextDecoder().decode(bytes)
        // Line command
        expect(text).toContain('50 700 m 545 700 l S')
        // Rect command
        expect(text).toContain('50 680 495 16 re f')
    })
})
