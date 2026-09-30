// 행성 ↔ 내 별자리의 전체 별자리 각(whole-sign aspect)
import { SIGNS } from './signs.js';

export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export const ASPECT_OF_DIST = { 0: 'conj', 2: 'sextile', 10: 'sextile', 3: 'square', 9: 'square', 4: 'trine', 8: 'trine', 6: 'opp' };

export const ASPECT_KR = {
  conj: { name: '합', tone: '강하게 머묾' },
  trine: { name: '삼각', tone: '순풍' },
  sextile: { name: '육각', tone: '작은 기회' },
  square: { name: '사각', tone: '긴장' },
  opp: { name: '대립', tone: '균형 필요' },
};

// 행성별로 영향을 주는 영역
export const PLANET_DOMAINS = {
  Sun: ['overall'],
  Moon: ['overall', 'health', 'social'],
  Mercury: ['work', 'social'],
  Venus: ['love', 'money'],
  Mars: ['work', 'health'],
  Jupiter: ['overall', 'money'],
  Saturn: ['work', 'money'],
};

// 행성 영향력(빠른 달·내행성은 오늘의 체감이 크다)
const WEIGHT = { Sun: 1, Moon: 1.2, Mercury: 0.8, Venus: 1, Mars: 0.9, Jupiter: 0.8, Saturn: 0.7 };

function aspectValue(planet, aspect) {
  if (aspect === 'conj') return planet === 'Saturn' ? -0.4 : planet === 'Mars' ? 0.5 : 1;
  return { trine: 1, sextile: 0.5, square: -0.8, opp: -0.5 }[aspect] ?? 0;
}

/** @returns {Array<{planet, kr, at, atIndex, aspect|null, value, strength, retrograde}>} */
export function aspectsFor(sign, sky) {
  return PLANETS.map((planet) => {
    const b = sky.bodies[planet];
    const dist = (b.signIndex - sign.index + 12) % 12;
    const aspect = ASPECT_OF_DIST[dist] || null;
    const value = aspect ? aspectValue(planet, aspect) * WEIGHT[planet] : 0;
    const order = { conj: 5, opp: 4, square: 3, trine: 2, sextile: 1 };
    return {
      planet,
      kr: b.kr,
      at: SIGNS[b.signIndex].kr,
      atIndex: b.signIndex,
      aspect,
      value,
      strength: aspect ? order[aspect] * WEIGHT[planet] : 0,
      retrograde: b.retrograde,
    };
  });
}

/** 영역별 천문 보정값 합계 */
export function domainModifiers(aspects) {
  const mod = { overall: 0, love: 0, social: 0, work: 0, money: 0, health: 0 };
  for (const a of aspects) {
    for (const d of PLANET_DOMAINS[a.planet]) mod[d] += a.value;
    if (a.retrograde && a.planet === 'Mercury') { mod.work -= 0.5; mod.social -= 0.3; }
    if (a.retrograde && a.planet === 'Venus') { mod.love -= 0.4; mod.money -= 0.3; }
  }
  return mod;
}
