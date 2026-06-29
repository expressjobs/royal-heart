// Pure-JS image inspection (no native deps) — safe to run in the Worker SSR runtime.
// Detects the real format from magic bytes and parses pixel dimensions from headers,
// so a renamed or spoofed file cannot pass server-side checks.

export type ImageFormat = "jpeg" | "png" | "webp";

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  const len = bytes.length;
  let offset = 2; // skip SOI (FF D8)
  while (offset + 1 < len) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    let marker = bytes[offset + 1];
    // Skip fill bytes (sequences of 0xFF).
    while (marker === 0xff && offset + 1 < len) {
      offset++;
      marker = bytes[offset + 1];
    }
    offset += 2;
    // Standalone markers with no length field.
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }
    if (offset + 1 >= len) break;
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    // Start Of Frame markers carry the dimensions (exclude DHT/JPG/DAC).
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (offset + 6 >= len) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }
    if (segLen <= 0) break;
    offset += segLen;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): { width: number; height: number } | null {
  const cc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (cc === "VP8 ") {
    // Lossy: 14-bit width/height at offsets 26 and 28 (little-endian).
    if (bytes.length < 30) return null;
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return { width, height };
  }
  if (cc === "VP8L") {
    // Lossless: 1 signature byte (0x2f) then packed 14-bit width-1/height-1.
    if (bytes.length < 25) return null;
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (cc === "VP8X") {
    // Extended: 24-bit width-1/height-1 (little-endian) at offset 24.
    if (bytes.length < 30) return null;
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  return null;
}

/** Returns the true format and pixel dimensions, or null if the bytes aren't a supported image. */
export function getImageInfo(bytes: Uint8Array): ImageInfo | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at offsets 16/20.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { format: "png", width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) };
  }
  // JPEG: FF D8.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const dims = parseJpeg(bytes);
    return dims ? { format: "jpeg", ...dims } : null;
  }
  // WebP: "RIFF"...."WEBP".
  if (
    bytes.length >= 16 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const dims = parseWebp(bytes);
    return dims ? { format: "webp", ...dims } : null;
  }
  return null;
}
