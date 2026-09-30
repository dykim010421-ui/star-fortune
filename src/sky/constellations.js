// 황도 12궁 실제 별자리 선 (d3-celestial, BSD-3) + 화면상 호버 판정
import * as THREE from 'three';
import LINES from './zodiac-lines.json';
import { raDecToVec3, vec3ToRaDec } from './coords.js';

const R = 985;

/**
 * @param {Array<{id:string,color:string}>} signs
 */
export function createConstellations(signs) {
  const group = new THREE.Group();
  const items = signs.map((sign) => {
    const polys = LINES[sign.id];
    const segs = [];
    const verts = [];
    const center = new THREE.Vector3();
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const v = raDecToVec3(poly[i][0], poly[i][1], R);
        verts.push(v);
        center.add(v);
        if (i > 0) segs.push(verts.length - 2, verts.length - 1);
      }
    }
    center.divideScalar(verts.length).setLength(R);
    const radiusDeg = Math.max(...verts.map((v) => v.angleTo(center))) * (180 / Math.PI);

    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(segs.length * 3);
    segs.forEach((vi, k) => verts[vi].toArray(arr, k * 3));
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.72, 0.78, 1.0),
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.renderOrder = 1;
    lines.frustumCulled = false;
    group.add(lines);

    return {
      sign,
      verts,
      segs,
      center,
      radiusDeg,
      ...vec3ToRaDec(center),
      mat,
      signColor: new THREE.Color(sign.color),
      baseColor: new THREE.Color(0.72, 0.78, 1.0),
      level: 0,      // 현재 강조 정도 0~1 (부드럽게 보간)
      target: 0,
      screen: [],    // 투영된 꼭짓점 [x, y] | null
    };
  });

  const tmp = new THREE.Vector3();

  function project(camera, w, h) {
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    for (const it of items) {
      it.visible = it.center.clone().normalize().dot(fwd) > 0.2;
      it.screen = it.verts.map((v) => {
        tmp.copy(v).project(camera);
        if (tmp.z > 1) return null;
        return [(tmp.x * 0.5 + 0.5) * w, (-tmp.y * 0.5 + 0.5) * h];
      });
      tmp.copy(it.center).project(camera);
      it.centerScreen = tmp.z > 1 ? null : [(tmp.x * 0.5 + 0.5) * w, (-tmp.y * 0.5 + 0.5) * h];
    }
  }

  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }

  return {
    group,
    items,
    project,
    /** 화면 좌표에서 가장 가까운 별자리 (선에서 threshold px 이내) */
    pick(px, py, threshold = 26) {
      let best = null, bestD = threshold;
      for (const it of items) {
        if (!it.visible) continue;
        for (let k = 0; k < it.segs.length; k += 2) {
          const a = it.screen[it.segs[k]], b = it.screen[it.segs[k + 1]];
          if (!a || !b) continue;
          const d = segDist(px, py, a, b);
          if (d < bestD) { bestD = d; best = it; }
        }
      }
      return best;
    },
    /** 강조 상태 설정: map id → 0~1 */
    setTargets(fn) {
      for (const it of items) it.target = fn(it.sign);
    },
    update(dt) {
      for (const it of items) {
        it.level += (it.target - it.level) * Math.min(1, dt * 6);
        it.mat.opacity = 0.14 + it.level * 0.7;
        it.mat.color.copy(it.baseColor).lerp(it.signColor, Math.min(1, it.level * 1.4));
      }
    },
  };
}
