// 황도 12궁 메타데이터. index 순서 = 황경 0°부터 30°씩 (양자리=0)
// element: index % 4 → 0 불, 1 흙, 2 공기, 3 물
export const SIGNS = [
  { id: 'Ari', en: 'Aries',       kr: '양자리',     dates: '3.21–4.19',   start: [3, 21],  color: '#ff8a7a' },
  { id: 'Tau', en: 'Taurus',      kr: '황소자리',   dates: '4.20–5.20',   start: [4, 20],  color: '#a8e6a3' },
  { id: 'Gem', en: 'Gemini',      kr: '쌍둥이자리', dates: '5.21–6.21',   start: [5, 21],  color: '#ffe082' },
  { id: 'Cnc', en: 'Cancer',      kr: '게자리',     dates: '6.22–7.22',   start: [6, 22],  color: '#90caf9' },
  { id: 'Leo', en: 'Leo',         kr: '사자자리',   dates: '7.23–8.22',   start: [7, 23],  color: '#ffcc80' },
  { id: 'Vir', en: 'Virgo',       kr: '처녀자리',   dates: '8.23–9.22',   start: [8, 23],  color: '#b39ddb' },
  { id: 'Lib', en: 'Libra',       kr: '천칭자리',   dates: '9.23–10.22',  start: [9, 23],  color: '#80deea' },
  { id: 'Sco', en: 'Scorpio',     kr: '전갈자리',   dates: '10.23–11.21', start: [10, 23], color: '#ef9a9a' },
  { id: 'Sgr', en: 'Sagittarius', kr: '사수자리',   dates: '11.22–12.21', start: [11, 22], color: '#f48fb1' },
  { id: 'Cap', en: 'Capricorn',   kr: '염소자리',   dates: '12.22–1.19',  start: [12, 22], color: '#80cbc4' },
  { id: 'Aqr', en: 'Aquarius',    kr: '물병자리',   dates: '1.20–2.18',   start: [1, 20],  color: '#81d4fa' },
  { id: 'Psc', en: 'Pisces',      kr: '물고기자리', dates: '2.19–3.20',   start: [2, 19],  color: '#ce93d8' },
].map((s, index) => ({ ...s, index, element: ELEMENT_OF(index) }));

function ELEMENT_OF(i) {
  return ['fire', 'earth', 'air', 'water'][i % 4];
}

export const ELEMENT_KR = { fire: '불', earth: '흙', air: '공기', water: '물' };

/** 생일(월, 일) → 별자리 */
export function signFromDate(month, day) {
  const md = month * 100 + day;
  // start 기준 내림차순으로 훑어 첫 번째로 md >= start 인 별자리. 1.1~1.19 는 염소자리.
  let best = SIGNS[9];
  let bestStart = -1;
  for (const s of SIGNS) {
    const st = s.start[0] * 100 + s.start[1];
    if (md >= st && st > bestStart) { best = s; bestStart = st; }
  }
  return best;
}

export function signById(id) {
  return SIGNS.find((s) => s.id === id || s.en === id) || null;
}
