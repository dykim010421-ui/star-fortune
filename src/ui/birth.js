// 생일 입력 → 별자리. localStorage 에만 저장 (접근 실패 시에도 동작)
import { signFromDate } from '../fortune/signs.js';

const KEY = 'sf.birth';
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function loadBirth() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= 31) return v;
  } catch {}
  return null;
}
function saveBirth(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}
export function birthAsked() {
  try { return localStorage.getItem(KEY + '.asked') === '1'; } catch { return false; }
}
function markAsked() {
  try { localStorage.setItem(KEY + '.asked', '1'); } catch {}
}

/** 모달 열기. 확인 시 onDone({m,d,sign}), 건너뛰면 onDone(null) */
export function openBirth(onDone) {
  const root = document.getElementById('birth');
  const mSel = document.getElementById('birth-month');
  const dSel = document.getElementById('birth-day');
  const preview = document.getElementById('birth-preview');
  const cur = loadBirth() || { m: new Date().getMonth() + 1, d: new Date().getDate() };

  mSel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('');
  mSel.value = cur.m;
  const fillDays = () => {
    const keep = +dSel.value || cur.d;
    const n = DAYS[+mSel.value - 1];
    dSel.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('');
    dSel.value = Math.min(keep, n);
  };
  const upd = () => {
    const s = signFromDate(+mSel.value, +dSel.value);
    preview.innerHTML = `<span style="color:${s.color}">${s.kr}</span> <em>${s.en}</em>`;
  };
  dSel.innerHTML = '';
  fillDays(); upd();
  mSel.onchange = () => { fillDays(); upd(); };
  dSel.onchange = upd;

  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  document.getElementById('birth-ok').focus();

  const close = (result) => {
    markAsked();
    root.classList.remove('open');
    setTimeout(() => (root.hidden = true), 250);
    document.removeEventListener('keydown', onKey);
    onDone(result);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(null); };
  document.addEventListener('keydown', onKey);
  document.getElementById('birth-skip').onclick = () => close(null);
  document.getElementById('birth-ok').onclick = () => {
    const v = { m: +mSel.value, d: +dSel.value };
    saveBirth(v);
    close({ ...v, sign: signFromDate(v.m, v.d) });
  };
}
