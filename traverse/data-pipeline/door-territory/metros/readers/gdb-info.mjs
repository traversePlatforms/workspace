// A File Geodatabase's layers and fields, read with GDAL compiled to WebAssembly (gdal3.js; no GDAL build runs natively on this ARM
// laptop). Harris CAD ships its parcels as a .gdb inside Parcels.zip (16 Nov 2026).
//   node metros/readers/gdb-info.mjs <file.zip | file.gdb folder>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const initGdalJs = require('gdal3.js/node.js');
/* gdal3.js joins its path option onto the working folder, so it gets the package folder relative to it */
const { relative } = await import('node:path');
const PKG = relative(process.cwd(), require.resolve('gdal3.js/node.js').replace(/node\.js$/, 'dist/package')).replace(/\\/g, '/');
const Gdal = await initGdalJs({ path: PKG });
const r = await Gdal.open(process.argv[2]);
if (r.errors && r.errors.length) console.log('errors:', r.errors);
for (const ds of r.datasets) { const info = await Gdal.getInfo(ds); console.log(JSON.stringify(info, null, 1).slice(0, 4000)); }
