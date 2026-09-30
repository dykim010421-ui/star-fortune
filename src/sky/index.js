// 하이퍼리얼 밤하늘: 관측자가 천구 안에 서 있는 플라네타리움 시점
import * as THREE from 'three';
import { createStarfield } from './starfield.js';
import { createMilkyWay } from './milkyway.js';
import { createConstellations } from './constellations.js';
import { createBodies } from './bodies.js';
import { createComposer, createMeteors } from './effects.js';
import { raDecToVec3 } from './coords.js';

const BASE_FOV = 60;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * @param {{canvas:HTMLCanvasElement, labelLayer:HTMLElement, stars:number[], signs:object[],
 *          mobile:boolean, reducedMotion:boolean}} opts
 */
export function createSky({ canvas, labelLayer, stars, signs, mobile, reducedMotion }) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 1, 3000);

  const milky = createMilkyWay();
  const starfield = createStarfield(stars, { faintCount: mobile ? 12000 : 28000, pixelRatio });
  const constellations = createConstellations(signs);
  const bodies = createBodies(pixelRatio);
  scene.add(milky, constellations.group, starfield, bodies.group);
  const meteors = createMeteors(scene, { reducedMotion });
  const fx = createComposer(renderer, scene, camera, { mobile });

  // ── 시점 상태 ──
  const view = { ra: 0, dec: 0, fov: BASE_FOV, offX: 0, offY: 0 };
  let free = { ...view };          // 포커스 해제 시 돌아갈 자유 시점
  let tween = null;
  let focused = null;
  let autoRotate = !reducedMotion;
  let interactive = true;
  let mineId = null;
  let hovered = null;
  const listeners = { hover: [], select: [], interact: [] };
  const emit = (e, v) => listeners[e].forEach((f) => f(v));

  function applyCamera() {
    const target = raDecToVec3(view.ra, view.dec, 1);
    camera.fov = view.fov;
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(view.offX) > 0.5 || Math.abs(view.offY) > 0.5) camera.setViewOffset(w, h, view.offX, view.offY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ── 라벨 (DOM) ──
  const labels = constellations.items.map((it) => {
    const el = document.createElement('div');
    el.className = 'sky-label';
    el.style.setProperty('--c', it.sign.color);
    el.innerHTML = `<span class="kr">${it.sign.kr}</span><span class="en">${it.sign.en}</span>`;
    labelLayer.appendChild(el);
    return { it, el };
  });
  const bodyLabels = {};
  for (const [k, kr] of [['Sun', '태양'], ['Moon', '달'], ['Mercury', '수성'], ['Venus', '금성'], ['Mars', '화성'], ['Jupiter', '목성'], ['Saturn', '토성']]) {
    const el = document.createElement('div');
    el.className = 'body-label';
    el.textContent = kr;
    labelLayer.appendChild(el);
    bodyLabels[k] = el;
  }

  function updateLabels(w, h) {
    for (const { it, el } of labels) {
      const c = it.centerScreen;
      const show = c && it.visible && (!focused || focused === it) && c[0] > -50 && c[0] < w + 50 && c[1] > -50 && c[1] < h + 50;
      el.classList.toggle('show', !!show);
      el.classList.toggle('hot', it.level > 0.3);
      el.classList.toggle('mine', it.sign.id === mineId);
      if (c) {
        // 별자리 아래쪽 가장자리에 라벨
        let maxY = c[1];
        for (const s of it.screen) if (s && Math.abs(s[0] - c[0]) < 200) maxY = Math.max(maxY, s[1]);
        el.style.transform = `translate(${c[0].toFixed(1)}px, ${Math.min(maxY + 18, c[1] + 160).toFixed(1)}px) translate(-50%, 0)`;
      }
    }
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const v = new THREE.Vector3();
    for (const [k, el] of Object.entries(bodyLabels)) {
      const p = bodies.positions[k];
      if (!p) continue;
      const front = p.clone().normalize().dot(fwd) > 0.1;
      v.copy(p).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      el.classList.toggle('show', front && !focused);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(12px, -50%)`;
    }
  }

  // ── 입력 ──
  const pointers = new Map();
  let drag = null;
  let vel = { ra: 0, dec: 0 };
  let pinchDist = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (!interactive) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      drag = null;
    }
    vel = { ra: 0, dec: 0 };
    emit('interact');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!interactive) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) view.fov = THREE.MathUtils.clamp(view.fov * (pinchDist / d), 18, 100);
      pinchDist = d;
      return;
    }
    if (drag && !focused) {
      const k = view.fov / window.innerHeight;
      const dra = (e.clientX - drag.x) * k, ddec = (e.clientY - drag.y) * k;
      view.ra = (view.ra + dra + 360) % 360;
      view.dec = THREE.MathUtils.clamp(view.dec + ddec, -85, 85);
      vel = { ra: dra, dec: ddec };
      drag.x = e.clientX; drag.y = e.clientY;
    } else if (e.pointerType === 'mouse') {
      setHover(constellations.pick(e.clientX, e.clientY));
    }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (!drag || !interactive) { drag = null; return; }
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    const quick = performance.now() - drag.t < 450;
    drag = null;
    if (moved < 8 && quick && !focused) {
      const hit = constellations.pick(e.clientX, e.clientY, e.pointerType === 'mouse' ? 26 : 40);
      if (hit) { vel = { ra: 0, dec: 0 }; emit('select', hit.sign); }
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => setHover(null));
  canvas.addEventListener('wheel', (e) => {
    if (!interactive || focused) return;
    e.preventDefault();
    view.fov = THREE.MathUtils.clamp(view.fov * Math.exp(e.deltaY * 0.001), 18, 100);
    emit('interact');
  }, { passive: false });

  function setHover(it) {
    if (hovered === it) return;
    hovered = it;
    canvas.style.cursor = it ? 'pointer' : 'grab';
    emit('hover', it ? it.sign : null);
  }

  function refreshTargets() {
    constellations.setTargets((s) => {
      if (focused) return focused.sign === s ? 1 : 0;
      if (hovered && hovered.sign === s) return 0.85;
      return s.id === mineId ? 0.3 : 0;
    });
  }

  // ── 애니메이션 ──
  function animateTo(to, dur) {
    return new Promise((resolve) => {
      const from = { ...view };
      const dRa = wrap180(to.ra - from.ra);
      tween = { from, to, dRa, start: performance.now(), dur: reducedMotion ? Math.min(dur, 0.35) : dur, resolve };
    });
  }

  function focusFrame(it, layout) {
    const w = window.innerWidth, h = window.innerHeight;
    const need = it.radiusDeg * 2.5 + 6;
    let fov, offX = 0, offY = 0;
    if (layout === 'side') {
      const vis = w - layout_panel_w(w);
      offX = (w - vis) / 2;
      fov = need * (h / vis);
    } else {
      // 모바일: 화면 위쪽 약 38% 영역에 별자리가 보이도록
      const visH = h * 0.38;
      offY = h / 2 - visH / 2;
      fov = Math.max(need * (h / w), need * (h / visH) * 0.8);
    }
    return { ra: it.ra, dec: it.dec, fov: THREE.MathUtils.clamp(fov, 20, 110), offX, offY };
  }
  const layout_panel_w = (w) => Math.min(480, w * 0.42);

  // ── 루프 ──
  let last = performance.now();
  let firstFrame;
  const firstFramePromise = new Promise((r) => (firstFrame = r));
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    if (tween) {
      // 프레임 수가 아닌 실제 경과 시간 기준 → 느린 기기에서도 같은 시간에 도착
      tween.t = (now - tween.start) / 1000 / tween.dur;
      const k = easeInOut(Math.min(1, tween.t));
      view.ra = (tween.from.ra + tween.dRa * k + 360) % 360;
      for (const key of ['dec', 'fov', 'offX', 'offY']) view[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * k;
      if (tween.t >= 1) { const r = tween.resolve; tween = null; r(); }
    } else if (!focused) {
      if (!drag && (Math.abs(vel.ra) > 0.001 || Math.abs(vel.dec) > 0.001)) {
        view.ra = (view.ra + vel.ra + 360) % 360;
        view.dec = THREE.MathUtils.clamp(view.dec + vel.dec, -85, 85);
        vel.ra *= 0.92; vel.dec *= 0.92;
      }
      if (autoRotate && !drag) view.ra = (view.ra + dt * 0.5) % 360;
    }

    applyCamera();
    const zoom = Math.tan((BASE_FOV / 2) * (Math.PI / 180)) / Math.tan((view.fov / 2) * (Math.PI / 180));
    starfield.material.uniforms.uTime.value = time;
    starfield.material.uniforms.uZoom.value = zoom;
    bodies.update(camera, zoom);
    const w = window.innerWidth, h = window.innerHeight;
    constellations.project(camera, w, h);
    refreshTargets();
    constellations.update(dt);
    meteors.update(dt, camera);
    updateLabels(w, h);
    fx.render(time);
    if (firstFrame) { firstFrame(); firstFrame = null; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fx.setSize(w, h);
    if (focused) Object.assign(view, focusFrame(focused, focused.layout));
  });

  return {
    ready: firstFramePromise,
    on(ev, fn) { listeners[ev].push(fn); },
    setSky(sky) { bodies.setSky(sky); },
    lookAt(ra, dec, fov = BASE_FOV) { Object.assign(view, { ra, dec, fov }); },
    lookAtSign(signId, fov = BASE_FOV) {
      const it = constellations.items.find((x) => x.sign.id === signId);
      if (it) Object.assign(view, { ra: it.ra, dec: it.dec, fov });
    },
    setMine(id) { mineId = id; },
    setAutoRotate(v) { autoRotate = v; },
    get autoRotate() { return autoRotate; },
    /** 별자리로 날아가 포커스. layout: 'side'(데스크톱 오른쪽 패널) | 'sheet'(모바일) */
    async focus(signId, layout) {
      const it = constellations.items.find((x) => x.sign.id === signId);
      if (!it) return;
      if (!focused) free = { ...view, offX: 0, offY: 0 };
      focused = it;
      it.layout = layout;
      setHover(null);
      vel = { ra: 0, dec: 0 };
      const dist = Math.abs(wrap180(it.ra - view.ra)) + Math.abs(it.dec - view.dec);
      await animateTo(focusFrame(it, layout), 1.1 + Math.min(1.2, dist / 120));
    },
    async release() {
      if (!focused) return;
      focused = null;
      await animateTo({ ...free, ra: view.ra, dec: view.dec }, 1.0);
    },
    setInteractive(v) { interactive = v; },
    _debug: () => ({ view: { ...view }, items: constellations.items.map((i) => [i.sign.id, i.ra.toFixed(1), i.dec.toFixed(1), i.radiusDeg.toFixed(1), i.centerScreen]) }),
  };
}
