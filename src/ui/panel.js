// 운세 패널 렌더링
import { icon } from './icons.js';
import { constellationSvg } from './constellation-svg.js';
import { ELEMENT_KR } from '../fortune/signs.js';

const SCORE_META = [
  { key: 'overall', label: '총운', icon: 'sparkles', cls: 'overall' },
  { key: 'love', label: '애정', icon: 'heart', cls: 'love' },
  { key: 'social', label: '관계', icon: 'users', cls: 'social' },
  { key: 'work', label: '일·학업', icon: 'briefcase', cls: 'work' },
  { key: 'money', label: '금전', icon: 'wallet', cls: 'money' },
  { key: 'health', label: '건강', icon: 'heart-pulse', cls: 'health' },
];
const SECTIONS = [
  ['overall', '오늘의 전체 운세', 'sparkles'],
  ['love', '애정운', 'heart'],
  ['social', '인간관계운', 'users'],
  ['work', '직업 · 학업운', 'briefcase'],
  ['money', '금전운', 'wallet'],
  ['health', '건강운', 'heart-pulse'],
];
const TIME_ICON = { morning: 'sunrise', afternoon: 'sun', evening: 'moon-star' };
const TONE_KR = { good: '좋음', mid: '무난', care: '신중' };
const TOTAL_WORD = (t) => (t >= 88 ? '아주 맑음' : t >= 76 ? '맑음' : t >= 62 ? '구름 조금' : t >= 50 ? '흐림 뒤 갬' : '쉬어가는 날');

const pips = (n, cls) =>
  Array.from({ length: 5 }, (_, i) => `<i class="pip${i < n ? ' on ' + cls : ''}"></i>`).join('');

function gauge(total, color) {
  const r = 34, c = 2 * Math.PI * r;
  return `<svg class="gauge" viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${((total / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/>
  </svg>`;
}

const divider = (label) => `<div class="divider"><span>${label}</span></div>`;

export function renderPanel(f, { dateLabel }) {
  const s = f.sign;
  return `
    <div class="p-bar">
      <button class="btn ghost small" data-act="back">${icon('arrow-left', 16)}<span>하늘로</span></button>
      <div class="font-ctrl" role="group" aria-label="글자 크기">
        <button class="icon-btn ghost" data-act="font-down" aria-label="글자 작게">${icon('font-down', 17)}</button>
        <button class="icon-btn ghost" data-act="font-up" aria-label="글자 크게">${icon('font-up', 17)}</button>
      </div>
    </div>

    <div class="p-title" style="--c:${s.color}">
      <div class="p-glyph">${constellationSvg(s, 92)}</div>
      <div class="p-en">${s.en}</div>
      <div class="p-kr">${s.kr}</div>
      <div class="p-meta">${s.dates} <span>·</span> ${ELEMENT_KR[s.element]}의 별자리 <span>·</span> ${dateLabel}</div>
    </div>

    <div class="total" style="--c:${s.color}">
      <div class="total-gauge">${gauge(f.total, s.color)}<div class="total-num"><b>${f.total}</b><small>점</small></div></div>
      <div class="total-side">
        <div class="total-label">오늘의 종합 운세 <span>${TOTAL_WORD(f.total)}</span></div>
        <div class="chips">${f.keywords.map((k) => `<span class="chip">${k}</span>`).join('')}</div>
      </div>
    </div>

    <p class="p-summary">${f.summary}</p>

    <div class="scores">
      ${SCORE_META.map((m) => `
        <div class="score">
          <div class="score-label">${icon(m.icon, 14)}<span>${m.label}</span></div>
          <div class="pips" aria-label="${m.label} ${f.scores[m.key]}점">${pips(f.scores[m.key], m.cls)}</div>
        </div>`).join('')}
    </div>

    <section class="card sky-card">
      <h3>${icon('telescope', 15)}<span>오늘의 하늘</span></h3>
      <ul>${f.sky.map((t) => `<li>${t}</li>`).join('')}</ul>
      <details class="planets">
        <summary>${icon('chevron-down', 14)}<span>행성 배치와 나와의 각도 자세히</span></summary>
        <table>
          <thead><tr><th>천체</th><th>위치</th><th>나와의 각</th></tr></thead>
          <tbody>${f.planets.map((p) => `
            <tr class="${p.good ? 'good' : p.bad ? 'bad' : ''}">
              <td>${p.kr}${p.retrograde ? '<em>역행</em>' : ''}</td>
              <td>${p.at}</td>
              <td>${p.aspect ? `${p.aspect} <span>${p.tone}</span>` : `<span>${p.tone}</span>`}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <p class="planets-note">각은 행성이 있는 별자리와 ${s.kr} 사이의 거리로 봐요. 삼각·육각은 조화, 사각·대립은 긴장, 합은 강한 영향이에요.</p>
      </details>
      <div class="sky-foot">실제 천체 위치를 이 기기에서 계산했어요 · 별자리 구분은 점성술 기준(황도 30° 구간)이라 하늘의 성좌 경계와 조금 다를 수 있어요</div>
    </section>

    ${divider('시간대별 흐름')}
    <div class="timeflow">
      ${f.time.map((t) => `
        <div class="tf ${t.tone}">
          <div class="tf-head">${icon(TIME_ICON[t.key], 15)}<span>${t.label}</span><em>${TONE_KR[t.tone]}</em></div>
          <p>${t.text}</p>
        </div>`).join('')}
    </div>

    ${SECTIONS.map(([k, label]) => `
      ${divider(label)}
      <section class="card text">
        ${f.sections[k].paras.map((p) => `<p>${p}</p>`).join('')}
        ${k === 'love' ? `
          <div class="sub-cards">
            <div class="sub"><div class="sub-h">연인이 있다면</div><p>${f.sections.love.couple}</p></div>
            <div class="sub"><div class="sub-h">혼자라면</div><p>${f.sections.love.single}</p></div>
          </div>` : ''}
      </section>`).join('')}

    ${divider('오늘의 실천')}
    <div class="dodont">
      <div class="dd do"><div class="dd-h">${icon('check', 15)}<span>해보면 좋은 것</span></div><ul>${f.todo.map((t) => `<li>${t}</li>`).join('')}</ul></div>
      <div class="dd dont"><div class="dd-h">${icon('slash', 15)}<span>피하면 좋은 것</span></div><ul>${f.avoid.map((t) => `<li>${t}</li>`).join('')}</ul></div>
    </div>

    ${divider('오늘의 궁합')}
    <div class="match">
      ${f.match.good.map((m) => `
        <div class="mt good" style="--c:${m.sign.color}"><div class="mt-h"><i class="dot"></i><b>${m.sign.kr}</b><span>잘 맞아요</span></div><p>${m.reason}</p></div>`).join('')}
      <div class="mt careful" style="--c:${f.match.careful.sign.color}"><div class="mt-h"><i class="dot"></i><b>${f.match.careful.sign.kr}</b><span>살짝 조심</span></div><p>${f.match.careful.reason}</p></div>
    </div>

    ${divider('오늘의 지혜')}
    <blockquote class="wisdom">${icon('quote', 16)}<p>${f.wisdom}</p></blockquote>

    ${divider('행운의 기운')}
    <div class="lucky">
      <div class="lucky-item">${icon('palette', 15)}<div class="lk">Color</div><div class="lv">${f.lucky.color}</div></div>
      <div class="lucky-item">${icon('gem', 15)}<div class="lk">Item</div><div class="lv">${f.lucky.item}</div></div>
      <div class="lucky-item">${icon('hash', 15)}<div class="lk">Number</div><div class="lv">${f.lucky.numbers.join(' · ')}</div></div>
      <div class="lucky-item">${icon('compass', 15)}<div class="lk">Direction</div><div class="lv">${f.lucky.direction}</div></div>
      <div class="lucky-item">${icon('clock', 15)}<div class="lk">Time</div><div class="lv">${f.lucky.time}</div></div>
    </div>

    <div class="p-actions">
      <button class="btn primary" data-act="share">${icon('share', 16)}<span>운세 카드 저장·공유</span></button>
      <button class="btn ghost" data-act="list">${icon('orbit', 16)}<span>다른 별자리</span></button>
    </div>
    <footer class="p-credit">
      천체 위치 astronomy-engine · 별 데이터 Yale Bright Star Catalog · 별자리 선 d3-celestial<br>
      같은 날 같은 별자리는 언제 봐도 같은 운세예요. 재미로 즐겨주세요.
    </footer>
  `;
}
