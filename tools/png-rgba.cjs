const zlib = require('zlib')

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

const crc32 = (buffer) => {
  let value = 0xffffffff
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

const pngChunk = (type, data) => {
  const name = Buffer.from(type, 'ascii')
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  name.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length)
  return result
}

const paeth = (left, above, upperLeft) => {
  const prediction = left + above - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const aboveDistance = Math.abs(prediction - above)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left
    : aboveDistance <= upperLeftDistance
      ? above
      : upperLeft
}

const decodeRgbaPng = (buffer) => {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Invalid PNG signature')
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error('Only non-interlaced 8-bit RGBA PNGs are supported')
      }
    } else if (type === 'IDAT') idat.push(data)
    offset += 12 + length
  }
  const packed = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  let packedOffset = 0
  for (let y = 0; y < height; y += 1) {
    const filter = packed[packedOffset]
    packedOffset += 1
    const rowOffset = y * stride
    const previousOffset = rowOffset - stride
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[packedOffset + x]
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0
      const above = y > 0 ? pixels[previousOffset + x] : 0
      const upperLeft = y > 0 && x >= 4 ? pixels[previousOffset + x - 4] : 0
      const reconstructed =
        filter === 0
          ? raw
          : filter === 1
            ? raw + left
            : filter === 2
              ? raw + above
              : filter === 3
                ? raw + Math.floor((left + above) / 2)
                : filter === 4
                  ? raw + paeth(left, above, upperLeft)
                  : NaN
      if (!Number.isFinite(reconstructed)) throw new Error(`Unsupported PNG filter ${filter}`)
      pixels[rowOffset + x] = reconstructed & 0xff
    }
    packedOffset += stride
  }
  return { width, height, pixels }
}

const encodeRgbaPng = ({ width, height, pixels }) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const stride = width * 4
  const scanlines = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const outputOffset = y * (stride + 1)
    scanlines[outputOffset] = 0
    pixels.copy(scanlines, outputOffset + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const cropTransparentPng = (buffer, padding = 2, alphaThreshold = 8) => {
  const decoded = decodeRgbaPng(buffer)
  let left = decoded.width
  let top = decoded.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] < alphaThreshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) return { buffer, width: decoded.width, height: decoded.height }
  left = Math.max(0, left - padding)
  top = Math.max(0, top - padding)
  right = Math.min(decoded.width - 1, right + padding)
  bottom = Math.min(decoded.height - 1, bottom + padding)
  const width = right - left + 1
  const height = bottom - top + 1
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((top + y) * decoded.width + left) * 4
    decoded.pixels.copy(pixels, y * width * 4, sourceStart, sourceStart + width * 4)
  }
  return { buffer: encodeRgbaPng({ width, height, pixels }), width, height }
}

const adjustPngBrightness = (buffer, factor) => {
  const decoded = decodeRgbaPng(buffer)
  for (let offset = 0; offset < decoded.pixels.length; offset += 4) {
    if (decoded.pixels[offset + 3] === 0) continue
    decoded.pixels[offset] = Math.round(decoded.pixels[offset] * factor)
    decoded.pixels[offset + 1] = Math.round(decoded.pixels[offset + 1] * factor)
    decoded.pixels[offset + 2] = Math.round(decoded.pixels[offset + 2] * factor)
  }
  return encodeRgbaPng(decoded)
}

const darkenPngNeutrals = (buffer, factor, saturationThreshold = 0.22) => {
  const decoded = decodeRgbaPng(buffer)
  for (let offset = 0; offset < decoded.pixels.length; offset += 4) {
    if (decoded.pixels[offset + 3] === 0) continue
    const red = decoded.pixels[offset]
    const green = decoded.pixels[offset + 1]
    const blue = decoded.pixels[offset + 2]
    const maximum = Math.max(red, green, blue)
    const minimum = Math.min(red, green, blue)
    const saturation = maximum ? (maximum - minimum) / maximum : 0
    if (saturation > saturationThreshold) continue
    decoded.pixels[offset] = Math.round(red * factor)
    decoded.pixels[offset + 1] = Math.round(green * factor)
    decoded.pixels[offset + 2] = Math.round(blue * factor)
  }
  return encodeRgbaPng(decoded)
}

module.exports = {
  adjustPngBrightness,
  cropTransparentPng,
  darkenPngNeutrals,
  decodeRgbaPng,
  encodeRgbaPng,
}
