import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS, signFromDate } from '../src/fortune/signs.js';
import { computeSky } from '../src/astro/ephemeris.js';
import { buildFortune, interpretSky, josa, DOMAINS } from '../src/fortune/engine.js';
import { aspectsFor } from '../src/fortune/aspects.js';
import { POOLS, ASPECT_LINES, TIME, DO, DONT, KEYWORDS, TRAITS } from '../src/fortune/content/index.js';

const strip = (h) => h.replace(/<[^>]+>/g, '');

test('생일 → 별자리 경계', () => {
  const cases = [
    [1, 1, 'Cap'], [1, 19, 'Cap'], [1, 20, 'Aqr'], [2, 18, 'Aqr'], [2, 19, 'Psc'],
    [3, 20, 'Psc'], [3, 21, 'Ari'], [7, 22, 'Cnc'], [7, 23, 'Leo'],
    [12, 21, 'Sgr'], [12, 22, 'Cap'], [12, 31, 'Cap'],
  ];
  for (const [m, d, id] of cases) assert.equal(signFromDate(m, d).id, id, `${m}/${d}`);
});

test('천체 위치가 알려진 값과 일치', () => {
  assert.equal(computeSky(new Date('2026-01-01T12:00:00Z')).bodies.Sun.signIndex, 9);
  assert.equal(computeSky(new Date('2026-04-10T12:00:00Z')).bodies.Sun.signIndex, 0);
  const sky = computeSky(new Date('2026-09-30T03:00:00Z'));
  for (const b of Object.values(sky.bodies)) assert.ok(b.ra >= 0 && b.ra < 360 && b.dec >= -90 && b.dec <= 90);
});

test('콘텐츠 풀 구조와 개수', () => {
  assert.ok(POOLS.overall.length >= 100);
  assert.ok(POOLS.advice.length >= 100);
  for (const k of ['loveCouple', 'loveSingle', 'social', 'money']) assert.ok(POOLS[k].length >= 30, k);
  for (const p of Object.values(ASPECT_LINES)) for (const a of ['conj', 'trine', 'sextile', 'square', 'opp']) assert.ok(p[a].length >= 3);
  for (const t of Object.values(TIME)) for (const k of ['good', 'mid', 'care']) assert.ok(t[k].length >= 5);
  for (const d of DOMAINS) { assert.ok(DO[d].length >= 5, d); assert.ok(DONT[d].length >= 5, d); }
  for (const k of ['harmony', 'tension', 'neutral']) assert.ok(KEYWORDS[k].length >= 10);
  for (const s of SIGNS) {
    const t = TRAITS[s.id];
    assert.ok(t, s.id);
    for (const k of ['strengths', 'shadows', 'love', 'work', 'money', 'health', 'social']) assert.ok(t[k].length >= 2, s.id + k);
  }
});

test('남은 치환자·빈 문장 없이 모든 별자리·여러 날짜 운세 생성', () => {
  for (let i = 0; i < 40; i++) {
    const date = new Date(2026, 0, 1 + i * 9, 9);
    const sky = computeSky(date);
    for (const s of SIGNS) {
      const f = buildFortune(s, date, sky);
      const all = JSON.stringify([f.sections, f.time, f.todo, f.avoid, f.match, f.keywords, f.wisdom, f.summary]);
      assert.ok(!/\{[a-z_]+\}/.test(all), `치환자 남음 ${s.id} ${f.date}: ${all.match(/\{[a-z_]+\}/)}`);
      assert.ok(!all.includes('undefined'), `undefined ${s.id} ${f.date}`);
      for (const d of DOMAINS) {
        assert.ok(f.scores[d] >= 1 && f.scores[d] <= 5);
        assert.ok(f.sections[d].paras.length >= 2);
      }
      assert.ok(f.total >= 35 && f.total <= 99);
      assert.equal(f.keywords.length, 3);
      assert.equal(new Set(f.keywords).size, 3);
      assert.ok(Math.abs(f.lucky.numbers[0] - f.lucky.numbers[1]) > 1);
    }
  }
});

test('같은 날·같은 별자리는 동일, 긴 운세 분량', () => {
  const date = new Date(2026, 8, 30, 9);
  const sky = computeSky(date);
  for (const s of SIGNS) {
    const a = buildFortune(s, date, sky);
    assert.deepEqual(a, buildFortune(s, date, sky));
    const chars = strip(Object.values(a.sections).flatMap((x) => [...x.paras, x.couple || '', x.single || '']).join(''));
    assert.ok(chars.length > 1400, `${s.id} 분량 ${chars.length}`);
  }
});

test('전체운 본문은 풀 크기만큼 연속된 날짜에서 반복되지 않음', () => {
  const s = SIGNS[3];
  const seen = new Set();
  const n = POOLS.overall.length;
  for (let i = 0; i < n; i++) {
    const date = new Date(2026, 0, 1 + i, 9);
    seen.add(buildFortune(s, date, computeSky(date)).sections.overall.paras[0]);
  }
  assert.equal(seen.size, n);
});

test('행성 각: 같은 별자리는 합, 6칸 떨어지면 대립', () => {
  const sky = computeSky(new Date('2026-09-30T03:00:00Z'));
  const moonSign = SIGNS[sky.bodies.Moon.signIndex];
  assert.equal(aspectsFor(moonSign, sky).find((a) => a.planet === 'Moon').aspect, 'conj');
  const opp = SIGNS[(moonSign.index + 6) % 12];
  assert.equal(aspectsFor(opp, sky).find((a) => a.planet === 'Moon').aspect, 'opp');
  assert.ok(interpretSky(moonSign, sky)[0].includes('달이'));
});

test('조사 처리', () => {
  assert.equal(josa('추진력', '이', '가'), '추진력이');
  assert.equal(josa('솔직함', '을', '를'), '솔직함을');
  assert.equal(josa('배려', '이', '가'), '배려가');
  assert.equal(josa('끈기', '으로', '로'), '끈기로');
  assert.equal(josa('열정', '으로', '로'), '열정으로');
  assert.equal(josa('직관력', '으로', '로'), '직관력으로');
  assert.equal(josa('고집불통', '으로', '로'), '고집불통으로');
  assert.equal(josa('활달', '으로', '로'), '활달로');
});
