// 문장 풀 모음: v1 원본 + v2 확장
import { FORTUNE_POOL, LUCKY_COLORS, LUCKY_ITEMS } from '../pool.js';
import overall from './overall.js';
import advice from './advice.js';
import loveCouple from './love_couple.js';
import loveSingle from './love_single.js';
import social from './social.js';
import work from './work.js';
import money from './money.js';
import health from './health.js';

export { ASPECT_LINES } from './astro.js';
export { TIME } from './timeflow.js';
export { DO, DONT } from './actions.js';
export { KEYWORDS } from './keywords.js';
export { TRAITS } from './traits.js';
export { LUCKY_COLORS, LUCKY_ITEMS };

export const POOLS = {
  overall: [...FORTUNE_POOL.overall, ...overall],
  love: FORTUNE_POOL.love,
  loveCouple,
  loveSingle,
  social,
  work: [...FORTUNE_POOL.work, ...work],
  money,
  health: [...FORTUNE_POOL.health, ...health],
  advice: [...FORTUNE_POOL.advice, ...advice],
};
