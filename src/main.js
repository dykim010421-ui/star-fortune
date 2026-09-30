import './styles/base.css';
import './styles/panel.css';
import { createSky } from './sky/index.js';
import { computeSky } from './astro/ephemeris.js';
import { buildFortune } from './fortune/engine.js';
import { SIGNS, signById, signFromDate } from './fortune/signs.js';
import { hydrateIcons, icon } from './ui/icons.js';
import { renderPanel } from './ui/panel.js';
import { loadBirth, openBirth, birthAsked } from './ui/birth.js';
import { drawShareCard, shareOrDownload } from './ui/share-card.js';

const $ = (id) => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const layout = () => (window.innerWidth >= 900 ? 'side' : 'sheet');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dateLabel = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;

hydrateIcons();

async function boot() {
  const now = new Date();
  const skyNow = computeSky(now);

  $('today').textContent = dateLabel(now);
  const B = skyNow.bodies;
  $('today-sky').innerHTML =
    `${icon('moon', 13)}<span>${skyNow.moon.phaseName} · ${SIGNS[B.Moon.signIndex].kr}</span>` +
    `${icon('sun', 13)}<span>${SIGNS[B.Sun.signIndex].kr}</span>`;

  const res = await fetch(`${import.meta.env.BASE_URL}data/stars.json`);
  const stars = await res.json();

  const sky = createSky({ canvas: $('sky'), labelLayer: $('labels'), stars, signs: SIGNS, mobile, reducedMotion });
  sky.setSky(skyNow);
  if (import.meta.env.DEV) window.__sky = sky;

  const birth = loadBirth();
  let mine = null;
  setMine(birth ? signFromDate(birth.m, birth.d) : null);
  // 첫 시점: 내 별자리, 없으면 오늘 자정 무렵 남쪽 하늘(태양 반대편)
  if (mine) sky.lookAtSign(mine.id);
  else sky.lookAt((B.Sun.ra + 180) % 360, 5);

  await Promise.all([sky.ready, new Promise((r) => setTimeout(r, reducedMotion ? 300 : 1400))]);
  $('loading').classList.add('out');
  setTimeout(() => $('loading').remove(), 900);
  document.body.classList.add('ready');

  // ── 상태 ──
  let current = null;       // 열려 있는 운세의 별자리
  let fontScale = 1;
  try { fontScale = +localStorage.getItem('sf.fs') || 1; } catch {}

  function setMine(s) {
    mine = s;
    sky.setMine(s ? s.id : null);
    document.body.classList.toggle('has-mine', !!s);
    const btn = $('mine-btn');
    if (s) {
      btn.hidden = false;
      btn.innerHTML = `${icon('sparkles', 14)}<span>내 운세 · ${s.kr}</span>`;
      btn.style.setProperty('--c', s.color);
    } else btn.hidden = true;
  }

  // ── 운세 열기/닫기 ──
  async function openFortune(sign, { push = true } = {}) {
    if (current === sign) return;
    const first = !current;
    current = sign;
    if (push) history.pushState({ sign: sign.id }, '', `#${sign.en.toLowerCase()}`);
    document.body.classList.add('focused');
    hideHint();
    closeDrawer();

    const date = new Date();
    const f = buildFortune(sign, date, computeSky(date));
    const body = $('panel-body');
    const panel = $('panel');

    if (!first) panel.classList.remove('open');
    const flight = sky.focus(sign.id, layout());
    await new Promise((r) => setTimeout(r, first ? 450 : 250));
    if (current !== sign) return;
    body.innerHTML = renderPanel(f, { dateLabel: dateLabel(date) });
    body.style.setProperty('--fs', fontScale);
    $('panel-scroll').scrollTop = 0;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('open');
    bindPanel(f, date);
    await flight;
  }

  function closeFortune({ push = true } = {}) {
    if (!current) return;
    current = null;
    if (push) history.pushState({}, '', location.pathname + location.search);
    $('panel').classList.remove('open');
    $('panel').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focused');
    sky.release();
  }

  function bindPanel(f, date) {
    const body = $('panel-body');
    body.querySelector('[data-act="back"]').onclick = () => closeFortune();
    body.querySelector('[data-act="list"]').onclick = () => openDrawer();
    body.querySelector('[data-act="font-up"]').onclick = () => setFont(fontScale + 0.1);
    body.querySelector('[data-act="font-down"]').onclick = () => setFont(fontScale - 0.1);
    const shareBtn = body.querySelector('[data-act="share"]');
    shareBtn.onclick = async () => {
      shareBtn.disabled = true;
      try {
        const blob = await drawShareCard(f, { dateLabel: dateLabel(date), url: location.origin + location.pathname });
        const r = await shareOrDownload(blob, `star-fortune-${f.sign.en.toLowerCase()}-${f.date}.png`, `${f.sign.kr} 오늘의 운세 — ${f.summary}`);
        if (r === 'downloaded') toast('운세 카드를 저장했어요');
        else if (r === 'shared') toast('공유했어요');
      } catch (e) {
        console.error(e);
        toast('카드를 만들지 못했어요');
      } finally {
        shareBtn.disabled = false;
      }
    };
  }

  function setFont(v) {
    fontScale = Math.round(Math.min(1.4, Math.max(0.85, v)) * 100) / 100;
    $('panel-body').style.setProperty('--fs', fontScale);
    try { localStorage.setItem('sf.fs', fontScale); } catch {}
  }

  // ── 하늘 이벤트 ──
  sky.on('select', (s) => openFortune(s));
  sky.on('interact', hideHint);

  // ── 드로어 ──
  function buildList() {
    const here = {};
    for (const [k, b] of Object.entries(skyNow.bodies)) (here[b.signIndex] ||= []).push(b.kr);
    $('sign-list').innerHTML = SIGNS.map((s) => `
      <li><button data-id="${s.id}" style="--c:${s.color}">
        <i class="dot"></i>
        <span class="nm"><b>${s.kr}</b><em>${s.en}</em></span>
        <span class="dt">${s.dates}</span>
        ${here[s.index] ? `<span class="tags">${here[s.index].map((t) => `<small>${t}</small>`).join('')}</span>` : ''}
        ${mine && mine.id === s.id ? '<span class="me">MY</span>' : ''}
      </button></li>`).join('');
    $('sign-list').querySelectorAll('button').forEach((b) => (b.onclick = () => openFortune(signById(b.dataset.id))));
  }
  function openDrawer() {
    buildList();
    document.body.classList.add('drawer-open');
    $('drawer').setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    document.body.classList.remove('drawer-open');
    $('drawer').setAttribute('aria-hidden', 'true');
  }
  $('list-btn').onclick = openDrawer;
  $('drawer-close').onclick = closeDrawer;
  $('scrim').onclick = closeDrawer;

  // ── 상단 버튼 ──
  $('mine-btn').onclick = () => mine && openFortune(mine);
  $('birth-btn').onclick = () => openBirth(onBirth);
  function onBirth(r) {
    if (!r) return;
    setMine(r.sign);
    openFortune(r.sign);
  }
  const rot = $('rotate-btn');
  const syncRot = () => {
    rot.innerHTML = icon(sky.autoRotate ? 'pause' : 'play');
    rot.setAttribute('aria-label', sky.autoRotate ? '자동 회전 멈춤' : '자동 회전 시작');
  };
  rot.onclick = () => { sky.setAutoRotate(!sky.autoRotate); syncRot(); };
  syncRot();

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('drawer-open')) closeDrawer();
    else if (current) closeFortune();
  });

  // ── 주소(#aries)로 바로 열기 + 뒤로가기 ──
  const fromHash = () => SIGNS.find((s) => `#${s.en.toLowerCase()}` === location.hash.toLowerCase());
  window.addEventListener('popstate', () => {
    const s = fromHash();
    if (s) openFortune(s, { push: false });
    else closeFortune({ push: false });
  });

  const initial = fromHash();
  if (initial) openFortune(initial, { push: false });
  else if (!mine && !birthAsked()) setTimeout(() => openBirth(onBirth), 1200);
}

function hideHint() {
  document.body.classList.add('hint-done');
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

boot().catch((e) => {
  console.error(e);
  $('loading-sub').textContent = '하늘을 불러오지 못했어요. 새로고침해 주세요.';
});
