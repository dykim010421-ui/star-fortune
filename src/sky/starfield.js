// 실제 별(Yale BSC) + 은하면에 몰린 희미한 배경 별. 등급→밝기/크기, 색온도→색, PSF + 회절 스파이크 + 반짝임
import * as THREE from 'three';
import { raDecToVec3, galToRaDec, kelvinToRgb } from './coords.js';

export const SKY_R = 1000;

const vert = /* glsl */ `
  attribute float aMag;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uZoom;      // 기본 화각 대비 확대 배율
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float zoomBoost = pow(uZoom, 0.45);
    // 코어 크기(px): 밝을수록 크게, 확대하면 조금 더 크게
    float core = (1.25 + 3.8 * pow(10.0, -0.17 * (aMag + 1.5))) * zoomBoost;
    // 밝은 별은 헤일로/스파이크를 담기 위해 스프라이트를 더 크게
    vBright = clamp((2.2 - aMag) / 3.7, 0.0, 1.0);
    float sprite = core * mix(5.0, 11.0, vBright);
    gl_PointSize = sprite * uPixelRatio;
    // 대기 반짝임(신틸레이션): 저고도 느낌의 불규칙한 두 주파수 합
    float tw = sin(uTime * (1.7 + fract(aPhase * 7.13) * 2.9) + aPhase)
             * sin(uTime * (0.6 + fract(aPhase * 3.71)) + aPhase * 2.0);
    float flux = pow(10.0, -0.4 * (aMag - 2.4));
    vAlpha = pow(clamp(flux, 0.0, 1.0), 0.5) * 1.15 * (1.0 + uTwinkle * 0.28 * tw) * min(1.0, 0.75 + 0.25 * uZoom);
    vColor = aColor;
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float s = mix(0.2, 0.09, vBright);               // 스프라이트 대비 코어 폭
    float core = exp(-r2 / (2.0 * s * s));
    float halo = exp(-sqrt(r2) * 7.0) * 0.22 * (0.3 + vBright);
    float sx = exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 3.2);
    float sy = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 3.2);
    float spikes = (sx + sy) * vBright * vBright * 0.55;
    float edge = 1.0 - smoothstep(0.7, 1.0, sqrt(r2));
    float i = (core + halo + spikes) * vAlpha * edge;
    // 코어 중심은 하얗게 타도록 (실제 사진처럼)
    vec3 col = mix(vColor, vec3(1.0), core * core * 0.6);
    gl_FragColor = vec4(col, i); // AdditiveBlending: src * alpha + dst
  }
`;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number[]} flat  [ra, dec, mag, K, ...]
 * @param {{faintCount:number, pixelRatio:number}} opts
 */
export function createStarfield(flat, { faintCount, pixelRatio }) {
  const rand = mulberry32(20260930);
  const n = flat.length / 4;
  const total = n + faintCount;
  const pos = new Float32Array(total * 3);
  const mag = new Float32Array(total);
  const col = new Float32Array(total * 3);
  const phase = new Float32Array(total);
  const v = new THREE.Vector3();

  const setColor = (i, k, sat) => {
    const [r, g, b] = kelvinToRgb(k);
    // 실제 별빛은 채도가 낮다 → 흰색 쪽으로 섞기
    col[i * 3] = r * sat + (1 - sat);
    col[i * 3 + 1] = g * sat + (1 - sat);
    col[i * 3 + 2] = b * sat + (1 - sat);
  };

  for (let i = 0; i < n; i++) {
    raDecToVec3(flat[i * 4], flat[i * 4 + 1], SKY_R, v).toArray(pos, i * 3);
    mag[i] = flat[i * 4 + 2];
    setColor(i, flat[i * 4 + 3], 0.62);
    phase[i] = rand() * 100;
  }

  // 배경 별: 60%는 은하면(|b| 작음) 근처, 나머지는 전천 균일. 등급 6.4~8.6
  for (let j = 0; j < faintCount; j++) {
    const i = n + j;
    let ra, dec;
    if (rand() < 0.6) {
      const g = (rand() + rand() + rand() - 1.5) * 16; // 근사 가우시안
      const l = rand() * 360;
      ({ ra, dec } = galToRaDec(l, g));
    } else {
      ra = rand() * 360;
      dec = (Math.asin(rand() * 2 - 1) * 180) / Math.PI;
    }
    raDecToVec3(ra, dec, SKY_R, v).toArray(pos, i * 3);
    mag[i] = 6.4 + Math.pow(rand(), 0.6) * 2.2;
    setColor(i, 3500 + rand() * 7000, 0.45);
    phase[i] = rand() * 100;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uZoom: { value: 1 },
      uTwinkle: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  return points;
}
