/* Read one MRMS MESH GRIB2 file (lat/lon grid, template 3.0; PNG packing, template 5.41) with Node only.
   Windows' application control blocks the usual eccodes library on this machine, so this reads the format
   directly: section 3 for the grid, section 5 for the scaling, section 7 is a 16-bit greyscale PNG.
   Values are millimetres of estimated hail; negative codes (-1, -3) mean no estimate. */
import { inflateSync } from 'node:zlib';

export function decodeMesh(b) {
  if (b.toString('ascii', 0, 4) !== 'GRIB' || b[7] !== 2) throw new Error('not a GRIB2 file');
  let p = 16, g = {}, png = null;
  while (p < b.length - 4 && b.toString('ascii', p, p + 4) !== '7777') {
    const len = b.readUInt32BE(p), sec = b[p + 4];
    if (sec === 3) {
      if (b.readUInt16BE(p + 12) !== 0) throw new Error('not a lat/lon grid');
      g = { nx: b.readUInt32BE(p + 30), ny: b.readUInt32BE(p + 34), lat1: b.readInt32BE(p + 46) / 1e6, lon1: b.readUInt32BE(p + 50) / 1e6,
            dx: b.readUInt32BE(p + 63) / 1e6, dy: b.readUInt32BE(p + 67) / 1e6 };
    }
    if (sec === 5) { if (b.readUInt16BE(p + 9) !== 41) throw new Error('not PNG packing'); g.R = b.readFloatBE(p + 11); g.E = b.readInt16BE(p + 15); g.D = b.readInt16BE(p + 17); }
    if (sec === 7) png = b.subarray(p + 5, p + len);
    p += len;
  }
  if (!png || !g.nx) throw new Error('incomplete GRIB2 file');
  let q = 8, idat = [], w, h;
  while (q < png.length) {
    const L = png.readUInt32BE(q), t = png.toString('ascii', q + 4, q + 8), d = png.subarray(q + 8, q + 8 + L);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 16 || d[9] !== 0) throw new Error('PNG is not 16-bit greyscale'); }
    if (t === 'IDAT') idat.push(d);
    q += 12 + L;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = 2, stride = w * bpp, img = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? img[row + x - bpp] : 0, c = y ? img[up + x] : 0, ul = (x >= bpp && y) ? img[up + x - bpp] : 0, v = raw[src + x];
      let o;
      if (f === 0) o = v; else if (f === 1) o = v + a; else if (f === 2) o = v + c; else if (f === 3) o = v + ((a + c) >> 1);
      else { const pp = a + c - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - ul); o = v + (pa <= pb && pa <= pc ? a : pb <= pc ? c : ul); }
      img[row + x] = o & 255;
    }
  }
  const scale = 2 ** g.E, div = 10 ** g.D;
  return {
    grid: g,
    row: (lat) => Math.round((g.lat1 - lat) / g.dy),
    col: (lon) => Math.round((lon + 360 - g.lon1) / g.dx),
    mm: (r, c) => { const v = (g.R + img.readUInt16BE(r * stride + c * 2) * scale) / div; return v < 0 ? 0 : v; },
  };
}
