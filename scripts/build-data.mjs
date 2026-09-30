// 원본 카탈로그 → 앱에서 쓰는 압축 데이터로 변환
//   scripts/bsc.json   : Yale Bright Star Catalog (퍼블릭 도메인)
//   scripts/lines.json : d3-celestial constellations.lines.json (BSD-3)
import { readFileSync, writeFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);

function parseRA(s) {
  const m = s.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/);
  return (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15; // deg
}
function parseDec(s) {
  const m = s.match(/([+-])(\d+)°\s*(\d+)′\s*([\d.]+)″/);
  const v = +m[2] + +m[3] / 60 + +m[4] / 3600;
  return m[1] === '-' ? -v : v;
}

const bsc = JSON.parse(readFileSync(here('./bsc.json'), 'utf8'));
const flat = [];
for (const s of bsc) {
  if (!s.RA || !s.Dec || !s.V) continue;
  const k = +s.K || 6000;
  flat.push(+parseRA(s.RA).toFixed(3), +parseDec(s.Dec).toFixed(3), +(+s.V).toFixed(2), Math.round(k / 10) * 10);
}
writeFileSync(here('../public/data/stars.json'), JSON.stringify(flat));
console.log('stars:', flat.length / 4);

const ZODIAC = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];
const lines = JSON.parse(readFileSync(here('./lines.json'), 'utf8'));
const out = {};
for (const f of lines.features) {
  if (!ZODIAC.includes(f.id)) continue;
  // d3-celestial 경도는 -180~180 → RA 0~360
  out[f.id] = f.geometry.coordinates.map((poly) =>
    poly.map(([lon, lat]) => [+((lon + 360) % 360).toFixed(3), +lat.toFixed(3)])
  );
}
writeFileSync(here('../src/sky/zodiac-lines.json'), JSON.stringify(out));
console.log('zodiac constellations:', Object.keys(out).length);
