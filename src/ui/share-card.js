// 운세 결과를 1080x1350 PNG 카드로 그려 저장/공유 (서버 없이 캔버스로만)
import { constellationShape } from './constellation-svg.js';

const W = 1080, H = 1350;

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) { line = test; continue; }
    if (line) lines.push(line);
    line = w;
    while (ctx.measureText(line).width > maxW) {
      let i = line.length;
      while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
      lines.push(line.slice(0, i));
      line = line.slice(i);
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function drawShareCard(f, { dateLabel, url }) {
  await Promise.all([
    document.fonts.load('500 64px Cinzel'),
    document.fonts.load('400 40px "Noto Serif KR"'),
    document.fonts.load('500 40px "Noto Serif KR"'),
  ]).catch(() => {});

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const [cr, cg, cb] = hexToRgb(f.sign.color);
  const col = (a) => `rgba(${cr},${cg},${cb},${a})`;

  // 배경
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#060818');
  bg.addColorStop(0.55, '#03040d');
  bg.addColorStop(1, '#070514');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 은하수 띠
  ctx.save();
  ctx.translate(W / 2, H * 0.3);
  ctx.rotate(-0.5);
  const mw = ctx.createLinearGradient(0, -260, 0, 260);
  mw.addColorStop(0, 'rgba(120,130,200,0)');
  mw.addColorStop(0.5, 'rgba(150,150,215,0.10)');
  mw.addColorStop(1, 'rgba(120,130,200,0)');
  ctx.fillStyle = mw;
  ctx.fillRect(-W, -260, W * 2, 520);
  ctx.restore();

  // 별
  const r = rng(f.sign.index * 7919 + f.date.length * 31 + parseInt(f.date.replace(/-/g, ''), 10));
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, m = Math.pow(r(), 3);
    const rad = 0.4 + m * 1.9;
    ctx.fillStyle = `rgba(${220 + r() * 35},${225 + r() * 30},255,${0.15 + m * 0.75})`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    if (m > 0.6) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 7);
      g.addColorStop(0, 'rgba(210,220,255,0.25)'); g.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 비네트
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // 별자리
  const { polys, pts } = constellationShape(f.sign.id);
  const box = { x: W / 2 - 200, y: 112, s: 400 };
  const P = ([x, y]) => [box.x + x * box.s, box.y + y * box.s];
  ctx.strokeStyle = col(0.6); ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.shadowColor = col(0.8); ctx.shadowBlur = 12;
  for (const poly of polys) {
    ctx.beginPath();
    poly.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const p of pts) {
    const [x, y] = P(p);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
    g.addColorStop(0, col(0.55)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(200,190,255,0.6)';
  ctx.font = '400 26px Cinzel';
  ctx.letterSpacing = '10px';
  ctx.fillText('STAR FORTUNE', W / 2, 78);

  ctx.fillStyle = 'rgba(235,230,255,0.97)';
  ctx.font = '500 72px Cinzel';
  ctx.letterSpacing = '14px';
  ctx.fillText(f.sign.en.toUpperCase(), W / 2, 610);
  ctx.letterSpacing = '6px';
  ctx.fillStyle = col(0.9);
  ctx.font = '400 36px "Noto Serif KR"';
  ctx.fillText(f.sign.kr, W / 2, 664);
  ctx.letterSpacing = '2px';
  ctx.fillStyle = 'rgba(170,180,230,0.65)';
  ctx.font = '400 28px "Noto Serif KR"';
  ctx.fillText(dateLabel, W / 2, 710);
  ctx.letterSpacing = '0px';

  // 한 줄 요약
  ctx.fillStyle = 'rgba(225,232,255,0.95)';
  ctx.font = '400 38px "Noto Serif KR"';
  const lines = wrap(ctx, f.summary, 860).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 800 + i * 58));

  // 종합 점수 + 영역 점수 (3 x 2)
  let scoreY = 800 + (lines.length - 1) * 58 + 92;
  ctx.fillStyle = col(0.95);
  ctx.font = '500 30px "Noto Serif KR"';
  ctx.fillText(`종합 ${f.total}점  ·  ${f.keywords.join('  ·  ')}`, W / 2, scoreY);
  scoreY += 62;
  const meta = [['총운', 'overall', '#c9bcff'], ['애정', 'love', '#ff8fad'], ['관계', 'social', '#ffb38a'],
    ['일·학업', 'work', '#8bb8ff'], ['금전', 'money', '#f5d37a'], ['건강', 'health', '#a5d6a7']];
  meta.forEach(([label, key, color], i) => {
    const cx = W / 2 + ((i % 3) - 1) * 280;
    const y = scoreY + Math.floor(i / 3) * 78;
    ctx.fillStyle = 'rgba(180,190,240,0.7)';
    ctx.font = '400 24px "Noto Serif KR"';
    ctx.fillText(label, cx, y);
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k < f.scores[key] ? color : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx + (k - 2) * 24, y + 30, 7, 0, Math.PI * 2); ctx.fill();
    }
  });
  scoreY += 78;

  // 하단
  ctx.fillStyle = 'rgba(200,210,255,0.55)';
  ctx.font = '400 24px "Noto Serif KR"';
  ctx.fillText(`Lucky  ${f.lucky.color} · ${f.lucky.item} · ${f.lucky.numbers.join(', ')} · ${f.lucky.direction}`, W / 2, H - 92);
  ctx.fillStyle = 'rgba(160,170,220,0.4)';
  ctx.font = '400 22px Cinzel';
  ctx.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, H - 50);

  return new Promise((res) => c.toBlob(res, 'image/png'));
}

/** 모바일은 공유 시트, 아니면 파일 다운로드 */
export async function shareOrDownload(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
