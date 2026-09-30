// 운세 엔진: 문장 풀 + 오늘의 실제 천체 배치(행성 각) + 별자리 성향 → 결정적 운세
// 같은 날·같은 별자리 = 같은 결과. 문장은 날짜마다 순환해서 풀 크기만큼은 반복되지 않는다.
import { POOLS, ASPECT_LINES, TIME, DO, DONT, KEYWORDS, TRAITS, LUCKY_COLORS, LUCKY_ITEMS } from './content/index.js';
import { SIGNS, ELEMENT_KR } from './signs.js';
import { aspectsFor, domainModifiers, PLANET_DOMAINS, ASPECT_KR } from './aspects.js';

export const DOMAINS = ['overall', 'love', 'social', 'work', 'money', 'health'];

export function randSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
const dayNumber = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** 날짜마다 순환: n일 동안 같은 항목이 다시 나오지 않는다 */
function rotate(arr, day, salt) {
  const n = arr.length;
  if (n <= 1) return arr[0];
  const off = Math.floor(randSeed(salt) * n);
  let step = 1 + Math.floor(randSeed(salt + '#') * (n - 1));
  while (gcd(step, n) !== 1) step = (step % (n - 1)) + 1;
  return arr[(off + day * step) % n];
}
function pick(arr, seed) {
  return arr[Math.floor(randSeed(seed) * arr.length)];
}
function pickN(arr, n, seed) {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(randSeed(seed + i) * pool.length), 1)[0]);
  return out;
}

/** 받침에 맞는 조사 */
export function josa(word, withBatchim, without) {
  const ch = word.replace(/<[^>]+>/g, '').trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return word + without;
  const jong = code % 28;
  if (withBatchim === '으로' && jong === 8) return word + without; // ㄹ 받침 + 로
  return word + (jong ? withBatchim : without);
}

const clamp = (v, a = 1, b = 5) => Math.max(a, Math.min(b, v));

/** '오늘의 하늘' 설명 문장 (우선순위 순 최대 4개) */
export function interpretSky(sign, sky) {
  const b = sky.bodies;
  const same = (k) => b[k].signIndex === sign.index;
  const sameEl = (k) => SIGNS[b[k].signIndex].element === sign.element;
  const opposite = (k) => b[k].signIndex === (sign.index + 6) % 12;
  const at = (k) => SIGNS[b[k].signIndex].kr;
  const notes = [];

  if (same('Sun')) notes.push({ p: 9, text: `지금 태양이 <b>${sign.kr}</b>를 지나고 있어요. 1년 중 ${sign.kr}의 기운이 가장 밝게 빛나는 시즌이에요.` });
  if (same('Moon')) notes.push({ p: 10, text: `오늘 달이 <b>${sign.kr}</b>에 머물러요. 감정과 직감이 평소보다 또렷해지는 날이에요.` });
  else if (opposite('Moon')) notes.push({ p: 7, text: `달이 맞은편 <b>${at('Moon')}</b>에 있어요. 관계에서 내 입장과 상대 입장 사이의 균형이 필요한 날이에요.` });
  else if (sameEl('Moon')) notes.push({ p: 6, text: `달이 같은 ${ELEMENT_KR[sign.element]}의 원소인 <b>${at('Moon')}</b>에 있어 마음이 편안하게 흐르는 날이에요.` });
  if (same('Venus') || sameEl('Venus')) {
    notes.push({ p: same('Venus') ? 9 : 5, text: `금성이 <b>${at('Venus')}</b>에서 ${same('Venus') ? '당신의 별자리를 비추고' : '같은 원소의 기운을 보내고'} 있어요. 호감과 매력이 자연스럽게 드러나요.` });
  }
  if (same('Mars')) notes.push({ p: 8, text: `화성이 <b>${sign.kr}</b>에 있어 추진력이 강해지는 시기예요. 다만 조급함은 한 템포 늦춰주세요.` });
  if (b.Mercury.retrograde) notes.push({ p: 8, text: `수성이 <b>역행</b> 중이에요. 계약, 메시지, 일정은 보내기 전에 한 번 더 확인하세요.` });
  if (b.Venus.retrograde) notes.push({ p: 7, text: `금성이 <b>역행</b> 중이에요. 새 관계를 서두르기보다 지금 곁의 인연과 소비 습관을 돌아보기 좋은 때예요.` });
  if (same('Jupiter')) notes.push({ p: 7, text: `확장의 별 목성이 <b>${sign.kr}</b>에 머무는 해예요. 새로 시작한 일이 크게 자랄 수 있어요.` });
  if (same('Saturn')) notes.push({ p: 6, text: `토성이 <b>${sign.kr}</b>에 있어요. 느리지만 단단하게 쌓아가는 것이 결국 가장 빠른 길이에요.` });

  const { phaseName: pn, illum } = sky.moon;
  const phaseMeaning = {
    삭: '새로운 의도를 심기 좋은 때예요.',
    초승달: '작게 시작한 일에 힘을 실어주기 좋은 때예요.',
    상현달: '결정하고 행동으로 옮기기 좋은 때예요.',
    '차오르는 달': '다듬고 보완하며 마무리를 준비할 때예요.',
    보름달: '감정이 차오르고 결과가 드러나는 때예요.',
    '기우는 달': '받은 것을 나누고 감사하기 좋은 때예요.',
    하현달: '필요 없는 것을 정리하고 내려놓기 좋은 때예요.',
    그믐달: '쉬면서 다음 흐름을 기다리기 좋은 때예요.',
  }[pn];
  notes.push({ p: 4, text: `오늘의 달은 <b>${pn}</b>(밝기 ${Math.round(illum * 100)}%)이고 <b>${at('Moon')}</b>에 떠 있어요. ${phaseMeaning}` });

  notes.sort((a, z) => z.p - a.p);
  return notes.slice(0, 4).map((n) => n.text);
}

function fill(text, sign, extra = {}) {
  let t = text.replaceAll('{sign_kr}', sign.kr).replaceAll('{sign_en}', sign.en);
  for (const [k, v] of Object.entries(extra)) t = t.replaceAll(`{${k}}`, v);
  return t;
}

/** 영역에 영향을 주는 행성 각 해석 (강한 순 최대 2개). used: 섹션 간 같은 문장 중복 방지 */
function astroParagraph(domain, aspects, sign, day, seed, used) {
  const rel = aspects
    .filter((a) => a.aspect && PLANET_DOMAINS[a.planet].includes(domain))
    .sort((a, z) => z.strength - a.strength)
    .slice(0, 2);
  const lines = rel.map((a) => {
    const variants = ASPECT_LINES[a.planet][a.aspect];
    const first = variants.indexOf(rotate(variants, day, seed + domain + a.planet));
    let text = variants[first];
    for (let i = 0; i < variants.length && used.has(text); i++) text = variants[(first + i + 1) % variants.length];
    used.add(text);
    const tag = `<span class="astro-tag">${a.kr} · ${ASPECT_KR[a.aspect].name}</span>`;
    return tag + fill(text, sign, { planet: a.kr, at: a.at });
  });
  const merc = aspects.find((a) => a.planet === 'Mercury');
  if (merc.retrograde && (domain === 'work' || domain === 'social')) {
    lines.push('<span class="astro-tag">수성 · 역행</span>말과 문서는 <b>보내기 전에 한 번 더 확인</b>하는 습관이 특히 도움이 돼요.');
  }
  return lines.join(' ');
}

function traitParagraph(domain, sign, tone, day, seed) {
  const t = TRAITS[sign.id];
  if (domain === 'overall') {
    const s = pick(t.strengths, seed + 'st');
    const sh = pick(t.shadows, seed + 'sh');
    const mod = `${t.modality} 별자리`;
    if (tone === 'harmony') {
      return `오늘은 ${sign.kr}의 강점인 <b>${josa(s, '이', '가')}</b> 자연스럽게 빛나는 날이에요. 흐름이 좋을수록 ${josa(sh, '으로', '로')} 기울지 않도록 가끔 속도를 점검해 주세요.`;
    }
    if (tone === 'tension') {
      return `마찰이 느껴질수록 ${sign.kr} 특유의 ${josa(sh, '이', '가')} 고개를 들 수 있어요. 그럴 때는 당신의 강점인 <b>${josa(s, '을', '를')}</b> 믿고 한 걸음 물러서 보세요.`;
    }
    return `${mod}인 ${sign.kr}의 기질은 오늘 <b>${josa(s, '으로', '로')}</b> 드러나요. 평소 리듬대로 가되 ${sh}만 살짝 경계하면 충분한 하루예요.`;
  }
  const tip = rotate(t[domain], day, seed + 'trait' + domain);
  if (domain === 'health') return `${tip} 오늘은 특히 <b>${t.body}</b> 쪽을 부드럽게 살펴주세요.`;
  return tip;
}

function relationReason(a, b) {
  if (a.element === b.element) return `같은 ${ELEMENT_KR[a.element]}의 원소라 말하지 않아도 마음이 통하는 사이예요.`;
  const pair = [a.element, b.element].sort().join('-');
  if (pair === 'air-fire' || pair === 'earth-water') return '서로에게 부족한 기운을 자연스럽게 채워주는 조합이에요.';
  return '결이 달라서 오히려 새로운 시각을 얻을 수 있는 사이예요.';
}

/**
 * @param {object} sign  SIGNS 원소
 * @param {Date} date
 * @param {object} sky   computeSky(date) 결과
 */
export function buildFortune(sign, date, sky) {
  const dk = dayKey(date);
  const day = dayNumber(date);
  const seed = sign.en + dk;
  const aspects = aspectsFor(sign, sky);
  const mod = domainModifiers(aspects);
  const dayTone = aspects.reduce((s, a) => s + a.value, 0);
  const tone = dayTone > 0.8 ? 'harmony' : dayTone < -0.4 ? 'tension' : 'neutral';

  const scores = {};
  for (const d of DOMAINS) {
    const base = 2.6 + randSeed(seed + 'score' + d) * 1.8;
    scores[d] = clamp(Math.round(base + mod[d] * 0.9));
  }
  const avg = DOMAINS.reduce((s, d) => s + scores[d], 0) / DOMAINS.length;
  const total = clamp(Math.round(40 + ((avg - 1) / 4) * 55 + (randSeed(seed + 'total') - 0.5) * 8), 35, 99);

  const main = (pool) => fill(rotate(POOLS[pool], day, sign.en + pool), sign);
  const sections = {};
  const used = new Set();
  for (const d of DOMAINS) {
    const paras = [main(d), astroParagraph(d, aspects, sign, day, sign.en, used), traitParagraph(d, sign, tone, day, sign.en + dk)].filter(Boolean);
    sections[d] = { paras };
  }
  sections.love.couple = main('loveCouple');
  sections.love.single = main('loveSingle');

  // 시간대 흐름
  const LABEL = { morning: '오전', afternoon: '오후', evening: '저녁' };
  const time = Object.keys(LABEL).map((k) => {
    const r = randSeed(seed + 'time' + k) + dayTone * 0.1 + (k === 'evening' ? mod.health * 0.05 : 0);
    const t = r > 0.62 ? 'good' : r < 0.3 ? 'care' : 'mid';
    return { key: k, label: LABEL[k], tone: t, text: rotate(TIME[k][t], day, sign.en + 'time' + k) };
  });

  // 하면 좋은 것 / 피할 것
  const ranked = [...DOMAINS].sort((a, z) => scores[z] - scores[a]);
  const todo = [...new Set([pick(DO[ranked[0]], seed + 'do0'), pick(DO.overall, seed + 'do1'), pick(DO[ranked[1]], seed + 'do2')])];
  const avoid = [...new Set([pick(DONT[ranked[5]], seed + 'dn0'), pick(DONT.overall, seed + 'dn1'), pick(DONT[ranked[4]], seed + 'dn2')])];

  // 오늘의 키워드
  const other = tone === 'neutral' ? 'harmony' : 'neutral';
  const keywords = [...pickN(KEYWORDS[tone], 2, seed + 'kw'), pick(KEYWORDS[other], seed + 'kw2')];

  // 오늘 잘 맞는 / 조심할 별자리
  const trines = [SIGNS[(sign.index + 4) % 12], SIGNS[(sign.index + 8) % 12]];
  const sextiles = [SIGNS[(sign.index + 2) % 12], SIGNS[(sign.index + 10) % 12]];
  const moonSign = SIGNS[sky.bodies.Moon.signIndex];
  const good1 = pick(trines, seed + 'm1');
  const moonDist = (moonSign.index - sign.index + 12) % 12;
  const good2 = [2, 4, 8, 10].includes(moonDist) && moonSign !== good1 ? moonSign : pick(sextiles, seed + 'm2');
  const careful = pick([SIGNS[(sign.index + 3) % 12], SIGNS[(sign.index + 9) % 12]], seed + 'm3');
  const match = {
    good: [good1, good2].map((s) => ({ sign: s, reason: relationReason(sign, s) })),
    careful: { sign: careful, reason: '오늘은 리듬이 조금 엇갈릴 수 있어요. 한 박자 기다려주면 오히려 가까워져요.' },
  };

  // 행운
  const n1 = Math.floor(randSeed(seed + 'n1') * 9) + 1;
  const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => Math.abs(n - n1) > 1);
  const n2 = cands[Math.floor(randSeed(seed + 'n2') * cands.length)];
  const bestTime = time.find((t) => t.tone === 'good') || time.find((t) => t.tone === 'mid') || time[0];

  const planets = aspects.map((a) => ({
    kr: a.kr,
    at: a.at,
    aspect: a.aspect ? ASPECT_KR[a.aspect].name : null,
    tone: a.aspect ? ASPECT_KR[a.aspect].tone : '영향 약함',
    good: a.value > 0,
    bad: a.value < 0,
    retrograde: a.retrograde,
  }));

  return {
    sign,
    date: dk,
    tone,
    total,
    scores,
    keywords,
    sky: interpretSky(sign, sky),
    planets,
    sections,
    time,
    todo,
    avoid,
    match,
    wisdom: rotate(POOLS.advice, day, sign.en + 'advice'),
    lucky: {
      color: pick(LUCKY_COLORS, seed + 'color'),
      item: pick(LUCKY_ITEMS, seed + 'item'),
      numbers: [n1, n2].sort((a, z) => a - z),
      direction: pick(['동쪽', '서쪽', '남쪽', '북쪽', '남동쪽', '북서쪽', '남서쪽', '북동쪽'], seed + 'dir'),
      time: bestTime.label,
    },
    summary: firstSentence(sections.overall.paras[0]),
  };
}

function firstSentence(html) {
  const plain = html.replace(/<[^>]+>/g, '');
  const m = plain.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : plain).trim();
}
