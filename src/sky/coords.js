// 좌표 변환. 천구는 관측자(원점)를 둘러싼 구. Three.js 는 Y-up.
//   천문 표준 적도좌표 (x=cosδcosα, y=cosδsinα, z=sinδ) → three (x, z, -y)
//   안쪽에서 볼 때 적경이 왼쪽(동쪽)으로 증가하도록 맞춘 배치다.
import * as THREE from 'three';

const D2R = Math.PI / 180;

export function raDecToVec3(raDeg, decDeg, r = 1, out = new THREE.Vector3()) {
  const a = raDeg * D2R, d = decDeg * D2R;
  const cd = Math.cos(d);
  return out.set(r * cd * Math.cos(a), r * Math.sin(d), -r * cd * Math.sin(a));
}

export function vec3ToRaDec(v) {
  const n = v.clone().normalize();
  let ra = Math.atan2(-n.z, n.x) / D2R;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / D2R };
}

// J2000 적도 → 은하 좌표 회전 행렬 (천문 표준 프레임 기준)
export const EQ_TO_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];

/** 은하 좌표(l, b 도) → 적도 (ra, dec 도) */
export function galToRaDec(lDeg, bDeg) {
  const l = lDeg * D2R, b = bDeg * D2R;
  const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
  // 역행렬 = 전치
  const e = [0, 1, 2].map((i) => EQ_TO_GAL[0][i] * g[0] + EQ_TO_GAL[1][i] * g[1] + EQ_TO_GAL[2][i] * g[2]);
  let ra = Math.atan2(e[1], e[0]) / D2R;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(e[2]) / D2R };
}

/** 색온도(K) → 선형 RGB (Tanner Helland 근사) */
export function kelvinToRgb(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v) => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(b)];
}
