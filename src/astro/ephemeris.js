// 오늘 하늘의 실제 천체 배치 (astronomy-engine, 브라우저 내 계산)
import * as Astronomy from 'astronomy-engine';

export const BODIES = [
  { key: 'Sun',     kr: '태양' },
  { key: 'Moon',    kr: '달' },
  { key: 'Mercury', kr: '수성' },
  { key: 'Venus',   kr: '금성' },
  { key: 'Mars',    kr: '화성' },
  { key: 'Jupiter', kr: '목성' },
  { key: 'Saturn',  kr: '토성' },
];

function eclipticLon(body, date) {
  const vec = Astronomy.GeoVector(body, date, true);
  return Astronomy.Ecliptic(vec).elon;
}

/**
 * @param {Date} date
 * @returns {{ bodies: Record<string,{kr:string, ra:number, dec:number, lon:number, signIndex:number, retrograde:boolean, mag:number}>,
 *            moon: {phase:number, illum:number, phaseName:string} }}
 *   ra, dec: J2000 적도좌표(도). lon: 황경(도). signIndex: 0=양자리 (회귀황도 30° 구간)
 */
export function computeSky(date = new Date()) {
  const bodies = {};
  const tomorrow = new Date(date.getTime() + 86400000);
  for (const { key, kr } of BODIES) {
    const vec = Astronomy.GeoVector(key, date, true);
    const eq = Astronomy.EquatorFromVector(vec);
    const lon = Astronomy.Ecliptic(vec).elon;
    let d = eclipticLon(key, tomorrow) - lon;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    let mag = -26.7;
    if (key === 'Moon') mag = -11;
    else if (key !== 'Sun') mag = Astronomy.Illumination(key, date).mag;
    bodies[key] = {
      kr,
      ra: eq.ra * 15,
      dec: eq.dec,
      lon,
      signIndex: Math.floor(lon / 30) % 12,
      retrograde: key !== 'Sun' && key !== 'Moon' && d < 0,
      mag,
    };
  }
  const phase = Astronomy.MoonPhase(date); // 0 삭, 90 상현, 180 망, 270 하현
  const illum = Astronomy.Illumination('Moon', date).phase_fraction;
  return { bodies, moon: { phase, illum, phaseName: phaseName(phase) } };
}

export function phaseName(p) {
  if (p < 11.25 || p >= 348.75) return '삭';
  if (p < 78.75) return '초승달';
  if (p < 101.25) return '상현달';
  if (p < 168.75) return '차오르는 달';
  if (p < 191.25) return '보름달';
  if (p < 258.75) return '기우는 달';
  if (p < 281.25) return '하현달';
  return '그믐달';
}
