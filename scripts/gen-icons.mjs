// Generates simple PNG icons for Daybook without any external dependencies
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

function makePNG(size) {
  // Colors
  const BG   = [26,  26,  46]   // #1a1a2e
  const ACC  = [124, 106, 247]  // #7c6af7
  const CR   = [52,  211, 153]  // #34d399
  const DR   = [248, 113, 113]  // #f87171
  const WH   = [240, 240, 245]  // #f0f0f5

  // Build pixel buffer (RGBA)
  const pixels = new Uint8Array(size * size * 4)

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // Alpha blend over existing
    const alpha = a / 255
    pixels[i]     = Math.round(pixels[i]     * (1 - alpha) + r * alpha)
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + g * alpha)
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + b * alpha)
    pixels[i + 3] = 255
  }

  function fillRect(x, y, w, h, color, alpha = 255) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        setPixel(col, row, ...color, alpha)
      }
    }
  }

  function drawLine(x0, y0, x1, color, thickness = 1) {
    const half = Math.floor(thickness / 2)
    for (let x = x0; x <= x1; x++) {
      for (let t = -half; t <= half; t++) {
        setPixel(x, y0 + t, ...color)
      }
    }
  }

  function roundedRect(x, y, w, h, r, color, alpha = 255) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        const dx = col - x, dy = row - y
        let inCorner = false
        // top-left
        if (dx < r && dy < r) inCorner = Math.hypot(dx - r, dy - r) > r
        // top-right
        else if (dx >= w - r && dy < r) inCorner = Math.hypot(dx - (w - r), dy - r) > r
        // bottom-left
        else if (dx < r && dy >= h - r) inCorner = Math.hypot(dx - r, dy - (h - r)) > r
        // bottom-right
        else if (dx >= w - r && dy >= h - r) inCorner = Math.hypot(dx - (w - r), dy - (h - r)) > r
        if (!inCorner) setPixel(col, row, ...color, alpha)
      }
    }
  }

  // Background
  fillRect(0, 0, size, size, BG)

  // Rounded corners for the whole icon
  const iconR = Math.round(size * 0.22)
  for (let y = 0; y < iconR; y++) {
    for (let x = 0; x < iconR; x++) {
      if (Math.hypot(x - iconR, y - iconR) > iconR) {
        setPixel(x, y, 0, 0, 0, 0)
        setPixel(size - 1 - x, y, 0, 0, 0, 0)
        setPixel(x, size - 1 - y, 0, 0, 0, 0)
        setPixel(size - 1 - x, size - 1 - y, 0, 0, 0, 0)
      }
    }
  }

  // Book card
  const pad = Math.round(size * 0.15)
  const bx = pad, by = Math.round(size * 0.17)
  const bw = size - pad * 2, bh = Math.round(size * 0.66)
  const cardR = Math.round(size * 0.06)
  roundedRect(bx, by, bw, bh, cardR, ACC, 28)

  // Horizontal lines
  const t = Math.max(2, Math.round(size * 0.025))
  const lx0 = bx + Math.round(size * 0.07)
  const lineData = [
    { y: 0.42, color: ACC, w: 0.44 },
    { y: 0.52, color: CR,  w: 0.36 },
    { y: 0.62, color: DR,  w: 0.32 },
    { y: 0.72, color: ACC, w: 0.40 },
  ]
  for (const { y, color, w } of lineData) {
    drawLine(lx0, Math.round(size * y), lx0 + Math.round(size * w), color, t)
  }

  // ₹ label (simple pixel art R with two bars)
  const rx = Math.round(size * 0.63), ry = Math.round(size * 0.19)
  const fs = Math.round(size * 0.19)
  // Draw a simplified ₹ as a rectangle with lines
  fillRect(rx, ry, Math.round(fs * 0.08), Math.round(fs * 0.75), ACC)
  fillRect(rx, ry, Math.round(fs * 0.55), Math.round(fs * 0.08), ACC)
  fillRect(rx, ry + Math.round(fs * 0.25), Math.round(fs * 0.55), Math.round(fs * 0.08), ACC)
  // diagonal
  for (let i = 0; i < Math.round(fs * 0.45); i++) {
    const px = rx + Math.round(fs * 0.1) + i
    const py = ry + Math.round(fs * 0.35) + Math.round(i * 0.8)
    fillRect(px, py, t, t, ACC)
  }

  // Build PNG bytes
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crcBuf = Buffer.concat([typeBytes, data])
    const crc = crc32(crcBuf)
    const crcBytes = Buffer.alloc(4); crcBytes.writeInt32BE(crc)
    return Buffer.concat([len, typeBytes, data, crcBytes])
  }

  function crc32(buf) {
    let c = 0xffffffff
    for (const b of buf) {
      c ^= b
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
    }
    return (c ^ 0xffffffff) | 0
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // colour type RGB (3 = indexed, 2 = RGB, 6 = RGBA)
  // Use RGBA (colour type 6)
  ihdr[9] = 6
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // IDAT — filter byte 0 (None) before each row
  const rowSize = size * 4
  const raw = Buffer.alloc(size * (rowSize + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (rowSize + 1)] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (rowSize + 1) + 1 + x * 4
      raw[dst]     = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
    }
  }
  const compressed = deflateSync(raw, { level: 6 })

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', makePNG(192))
writeFileSync('public/icons/icon-512.png', makePNG(512))
console.log('Icons generated: public/icons/icon-192.png, public/icons/icon-512.png')
