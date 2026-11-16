// A File Geodatabase layer to GeoJSON lines in WGS84 (16 Nov 2026, Harris CAD's parcels come as a .gdb), with GDAL compiled to
// WebAssembly (gdal3.js; no GDAL build runs natively on this ARM laptop). Prints the layer's fields first.
//   node --max-old-space-size=8000 metros/readers/gdb-to-ndjson.mjs <folder.gdb> <out.ndjson> [fields=A,B] [--info]
// The .gdb path is relative to the working folder (gdal3.js mounts its parent folder).
import { createRequire } from 'node:module'; import { relative, sep } from 'node:path'; import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const initGdalJs = require('gdal3.js/node.js');
/* gdal3.js joins its path option onto the working folder, so it gets the package folder relative to it */
const Gdal = await initGdalJs({ path: relative(process.cwd(), require.resolve('gdal3.js/node.js').replace(/node\.js$/, 'dist/package')).split(sep).join('/') });
const [gdb, out, fields] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const r = await Gdal.open(gdb); if (!r.datasets.length) throw new Error('could not open ' + gdb + ' ' + JSON.stringify(r.errors));
const ds = r.datasets[0];
console.log(await Gdal.ogrinfo(ds, ['-so', '-al']));
if (process.argv.includes('--info')) process.exit(0);
const t0 = Date.now();
const o = await Gdal.ogr2ogr(ds, ['-f', 'GeoJSONSeq', '-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=7', ...(fields ? ['-select', fields] : [])], 'out');
const bytes = await Gdal.getFileBytes(o);
writeFileSync(out, bytes);
console.log(`${out}: ${(bytes.length / 1e6).toFixed(0)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
