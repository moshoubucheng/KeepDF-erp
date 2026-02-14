/**
 * PdfGenerator - Pure TypeScript PDF 1.4 builder for Cloudflare Workers
 * No external dependencies, builds raw PDF binary using TextEncoder + Uint8Array
 * Supports CIDFont + Identity-H encoding for Japanese text (UTF-16BE hex)
 */

const PAGE_WIDTH = 595.28  // A4 width in points
const PAGE_HEIGHT = 841.89 // A4 height in points

/** Encode string to UTF-16BE hex for CIDFont text rendering */
function toUTF16BEHex(text: string): string {
    const codes: string[] = []
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i)
        codes.push(code.toString(16).padStart(4, '0').toUpperCase())
    }
    return codes.join('')
}

/** Escape special characters in PDF strings */
function pdfEscapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

interface PdfObject {
    id: number
    data: string
}

export class PdfPage {
    private commands: string[] = []

    /** Set font: name = 'F1' (ASCII) or 'F2' (CID/Japanese), size in points */
    setFont(name: string, size: number): void {
        this.commands.push(`/${name} ${size} Tf`)
    }

    /** Draw text at position (x, y from bottom-left). Uses hex encoding for CID font. */
    drawText(x: number, y: number, text: string, useHex = false): void {
        if (useHex) {
            const hex = toUTF16BEHex(text)
            this.commands.push(`BT ${x} ${y} Td <${hex}> Tj ET`)
        } else {
            this.commands.push(`BT ${x} ${y} Td (${pdfEscapeString(text)}) Tj ET`)
        }
    }

    /** Draw a horizontal line */
    drawLine(x1: number, y1: number, x2: number, y2: number, width = 0.5): void {
        this.commands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`)
    }

    /** Draw a filled rectangle */
    drawRect(x: number, y: number, w: number, h: number, fillGray = 0.9): void {
        this.commands.push(`${fillGray} g ${x} ${y} ${w} ${h} re f`)
    }

    /** Set stroke/fill color (grayscale 0-1) */
    setGray(g: number): void {
        this.commands.push(`${g} g ${g} G`)
    }

    getContentStream(): string {
        return this.commands.join('\n')
    }
}

export class PdfGenerator {
    private objects: PdfObject[] = []
    private pages: { contentId: number }[] = []
    private nextId = 1

    private addObject(data: string): number {
        const id = this.nextId++
        this.objects.push({ id, data })
        return id
    }

    addPage(): PdfPage {
        const page = new PdfPage()
        // We'll finalize in generate()
        ;(this.pages as any).push({ page, contentId: 0 })
        return page
    }

    generate(): Uint8Array {
        // Rebuild objects from scratch
        this.objects = []
        this.nextId = 1

        // 1. Catalog (obj 1)
        const catalogId = this.addObject('')
        // 2. Pages (obj 2)
        const pagesId = this.addObject('')
        // 3. Font F1 - Helvetica (ASCII)
        const fontF1Id = this.addObject(
            `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
        )
        // 4. CIDFont for Japanese (Identity-H)
        const cidFontDescId = this.addObject(
            `<< /Type /FontDescriptor /FontName /KozGoPr6N-Medium /Flags 4 /FontBBox [-437 -340 1147 1317] /ItalicAngle 0 /Ascent 1317 /Descent -349 /CapHeight 742 /StemV 80 >>`
        )
        const cidFontId = this.addObject(
            `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozGoPr6N-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor ${cidFontDescId} 0 R /DW 1000 >>`
        )
        const fontF2Id = this.addObject(
            `<< /Type /Font /Subtype /Type0 /BaseFont /KozGoPr6N-Medium /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] >>`
        )

        // Resources dictionary
        const resourcesStr = `<< /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> >>`

        // Build page objects
        const pageIds: number[] = []
        for (const entry of this.pages as any[]) {
            const page = entry.page as PdfPage
            const stream = page.getContentStream()
            const streamBytes = new TextEncoder().encode(stream)
            const contentId = this.addObject(
                `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`
            )
            const pageId = this.addObject(
                `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources ${resourcesStr} >>`
            )
            pageIds.push(pageId)
        }

        // Update catalog
        this.objects[0].data = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
        // Update pages
        const kidsStr = pageIds.map(id => `${id} 0 R`).join(' ')
        this.objects[1].data = `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageIds.length} >>`

        // Serialize PDF
        const parts: string[] = []
        parts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

        const offsets: number[] = []
        let currentOffset = new TextEncoder().encode(parts[0]).length

        for (const obj of this.objects) {
            offsets.push(currentOffset)
            const objStr = `${obj.id} 0 obj\n${obj.data}\nendobj\n`
            parts.push(objStr)
            currentOffset += new TextEncoder().encode(objStr).length
        }

        // Cross-reference table
        const xrefOffset = currentOffset
        parts.push('xref\n')
        parts.push(`0 ${this.objects.length + 1}\n`)
        parts.push('0000000000 65535 f \n')
        for (const offset of offsets) {
            parts.push(`${offset.toString().padStart(10, '0')} 00000 n \n`)
        }

        // Trailer
        parts.push('trailer\n')
        parts.push(`<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\n`)
        parts.push('startxref\n')
        parts.push(`${xrefOffset}\n`)
        parts.push('%%EOF\n')

        return new TextEncoder().encode(parts.join(''))
    }
}
