// 실제 별자리 선을 작은 SVG/캔버스용 2D 좌표로 (중심 기준 그노몬 투영, 동쪽이 왼쪽)
import LINES from '../sky/zodiac-lines.json';

const D2R = Math.PI / 180;

/** @returns {{polys: number[][][], pts: number[][]}} 0~1 정규화 좌표 */
export function constellationShape(id) {
  const polys = LINES[id];
  const all = polys.flat();
  // 중심: 단위벡터 평균
  let cx = 0, cy = 0, cz = 0;
  for (const [ra, dec] of all) {
    cx += Math.cos(dec * D2R) * Math.cos(ra * D2R);
    cy += Math.cos(dec * D2R) * Math.sin(ra * D2R);
    cz += Math.sin(dec * D2R);
  }
  const ra0 = Math.atan2(cy, cx), dec0 = Math.atan2(cz, Math.hypot(cx, cy));
  const proj = ([ra, dec]) => {
    const a = ra * D2R - ra0, d = dec * D2R;
    const cosc = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a);
    const x = (Math.cos(d) * Math.sin(a)) / cosc;
    const y = (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a)) / cosc;
    return [-x, -y];
  };
  const pp = polys.map((poly) => poly.map(proj));
  const flat = pp.flat();
  const xs = flat.map((p) => p[0]), ys = flat.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const ox = (1 - (maxX - minX) / span) / 2, oy = (1 - (maxY - minY) / span) / 2;
  const norm = ([x, y]) => [ox + (x - minX) / span, oy + (y - minY) / span];
  const polysN = pp.map((poly) => poly.map(norm));
  const seen = new Set();
  const pts = polysN.flat().filter(([x, y]) => {
    const k = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { polys: polysN, pts };
}

export function constellationSvg(sign, size = 88) {
  const { polys, pts } = constellationShape(sign.id);
  const pad = 8, s = size - pad * 2;
  const P = ([x, y]) => `${(pad + x * s).toFixed(1)},${(pad + y * s).toFixed(1)}`;
  const lines = polys.map((poly) => `<polyline points="${poly.map(P).join(' ')}"/>`).join('');
  const dots = pts.map((p) => {
    const [x, y] = P(p).split(',');
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${sign.color}" opacity="0.18"/><circle cx="${x}" cy="${y}" r="1.7" fill="#fff"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><g fill="none" stroke="${sign.color}" stroke-opacity="0.55" stroke-width="0.9" stroke-linejoin="round">${lines}</g>${dots}</svg>`;
}
