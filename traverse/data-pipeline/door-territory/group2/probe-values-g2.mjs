/* Group 2 stage B check (2026-10-28): how the statewide parcel layer spells the three counties' names, and how many of their parcels carry
   an appraised value (apprValTot), the field sample-value.mjs reads. Light: statistics queries only. Usage: node probe-values-g2.mjs */
const LAYER = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const q = async (p) => (await (await fetch(LAYER, { method: 'POST', body: new URLSearchParams({ f: 'json', ...p }) })).json());
const names = await q({ where: "UPPER(countyName) IN ('LARIMER','MESA','PUEBLO')", returnGeometry: 'false', groupByFieldsForStatistics: 'countyName',
  outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]) });
console.log('parcels by countyName:', JSON.stringify((names.features || []).map((f) => f.attributes)), names.error ? JSON.stringify(names.error) : '');
for (const f of names.features || []) {
  const c = f.attributes.countyName;
  const v = await q({ where: `countyName='${c}' AND apprValTot > 0`, returnCountOnly: 'true' });
  const y = await q({ where: `countyName='${c}'`, returnGeometry: 'false', outFields: '*', resultRecordCount: '1' });
  const fields = y.features && y.features[0] ? Object.entries(y.features[0].attributes).filter(([k, x]) => x != null && x !== '' && x !== 0).map(([k]) => k) : [];
  console.log(`${c}: ${v.count} of ${f.attributes.n} with apprValTot > 0; fields filled on a sample row: ${fields.join(' ')}`);
}
