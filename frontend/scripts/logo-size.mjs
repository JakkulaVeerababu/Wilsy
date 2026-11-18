import fs from 'node:fs';
import path from 'node:path';

// The intrinsic shape of a cached logo, read from the PNG header or the SVG viewBox at build time.
// The homepage logo strip uses it to show wide wordmarks (Stripe, NVIDIA, Amazon) at their real
// proportions instead of squeezing them into a square. Returns null when the shape is unknown.
const sizes = new Map();
export function logoSize(file, root = process.cwd()) {
  const key = path.resolve(root, String(file || ''));
  if(sizes.has(key)) return sizes.get(key);
  let size = null;
  try {
    const data = fs.readFileSync(key);
    if(data.length >= 24 && data.toString('latin1', 1, 4) === 'PNG') size = {width: data.readUInt32BE(16), height: data.readUInt32BE(20)};
    else {
      const tag = /<svg\b[^>]*>/i.exec(data.toString('utf8', 0, 4096))?.[0] || '';
      const box = /\bviewBox\s*=\s*["']\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
      if(box) size = {width: Number(box[1]), height: Number(box[2])};
    }
  } catch {}
  if(!(size?.width > 0 && size?.height > 0)) size = null;
  sizes.set(key, size);
  return size;
}

// Whether a cached logo is a raster with no transparency (a solid background). Such logos cannot be
// inverted for the dark theme without turning into hard black or white squares, so they sit on a white tile.
const opaque = new Map();
export function logoOpaque(file, root = process.cwd()) {
  const key = path.resolve(root, String(file || ''));
  if(opaque.has(key)) return opaque.get(key);
  let result = /\.jpe?g$/i.test(key);
  try {
    const data = fs.readFileSync(key);
    if(data.length >= 33 && data.toString('latin1', 1, 4) === 'PNG') {
      result = data[25] !== 4 && data[25] !== 6;
      // Walk the chunks up to the image data: a tRNS chunk means the palette or colour has transparency.
      for(let at = 8; result && at + 8 <= data.length;) {
        const type = data.toString('latin1', at + 4, at + 8);
        if(type === 'tRNS') result = false;
        if(type === 'IDAT' || type === 'IEND') break;
        at += 12 + data.readUInt32BE(at);
      }
    }
  } catch {}
  opaque.set(key, result);
  return result;
}
