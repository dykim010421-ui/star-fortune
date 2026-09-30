// 태양·달·행성 스프라이트. 달은 실제 위상(조명 방향)과 절차적 바다 무늬로 그린다.
import * as THREE from 'three';
import { raDecToVec3 } from './coords.js';

const R = 960;

const PLANET_COLOR = {
  Mercury: [0.85, 0.8, 0.75],
  Venus: [1.0, 0.96, 0.86],
  Mars: [1.0, 0.55, 0.35],
  Jupiter: [1.0, 0.9, 0.76],
  Saturn: [1.0, 0.85, 0.6],
};

const planetVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uZoom;
  varying vec3 vColor;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * pow(uZoom, 0.4);
    vColor = aColor;
  }
`;
const planetFrag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float core = exp(-r2 / 0.012);
    float halo = exp(-sqrt(r2) * 5.0) * 0.35;
    float i = core * 1.4 + halo;   // 행성은 반짝이지 않는다(원반이라서)
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.5), i);
  }
`;

const discVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const moonFrag = /* glsl */ `
  uniform vec3 uLight;   // 달 원반 좌표계(x 오른쪽, y 위, z 관측자 쪽)에서 태양 방향
  varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  void main() {
    float disc = 0.34;                       // 쿼드 대비 달 반지름
    vec2 p = vUv / disc;
    float r2 = dot(p, p);
    float glow = exp(-sqrt(r2) * 2.2) * 0.05 * max(uLight.z * 0.5 + 0.5, 0.0);
    if (r2 > 1.0) { gl_FragColor = vec4(vec3(0.75, 0.78, 0.85), glow); return; }
    vec3 n = vec3(p, sqrt(1.0 - r2));
    float lambert = max(dot(n, normalize(uLight)), 0.0);
    // 바다(어두운 평원) 무늬
    float maria = smoothstep(0.45, 0.75, vnoise(p * 2.2 + 3.0) * 0.7 + vnoise(p * 5.0) * 0.3);
    float albedo = mix(1.0, 0.62, maria) * (0.92 + 0.08 * vnoise(p * 18.0));
    float lit = pow(lambert, 0.8) * albedo * 0.85;
    float earthshine = 0.035 * albedo;
    float edge = smoothstep(1.0, 0.96, r2);
    vec3 col = vec3(1.0, 0.97, 0.9) * (lit + earthshine);
    gl_FragColor = vec4(col, edge);
  }
`;
const sunFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float disc = smoothstep(0.2, 0.18, r);
    float corona = exp(-r * 6.0) * 0.9 + exp(-r * 2.2) * 0.15;
    vec3 col = vec3(1.0, 0.86, 0.6);
    gl_FragColor = vec4(col * (disc * 1.6 + corona), clamp(disc + corona, 0.0, 1.0));
  }
`;

export function createBodies(pixelRatio) {
  const group = new THREE.Group();
  const keys = Object.keys(PLANET_COLOR);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keys.length * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(keys.length), 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(keys.flatMap((k) => PLANET_COLOR[k])), 3));
  const planetMat = new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    uniforms: { uPixelRatio: { value: pixelRatio }, uZoom: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const planets = new THREE.Points(geo, planetMat);
  planets.frustumCulled = false;
  planets.renderOrder = 3;
  group.add(planets);

  const moonMat = new THREE.ShaderMaterial({
    vertexShader: discVert, fragmentShader: moonFrag,
    uniforms: { uLight: { value: new THREE.Vector3(0, 0, 1) } },
    transparent: true, depthWrite: false, depthTest: false,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
  moon.renderOrder = 4;
  group.add(moon);

  const sunMat = new THREE.ShaderMaterial({
    vertexShader: discVert, fragmentShader: sunFrag,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMat);
  sun.renderOrder = 4;
  group.add(sun);

  const positions = {}; // key → Vector3 (라벨/호버용)
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let moonIllum = 1;

  return {
    group,
    positions,
    /** computeSky() 결과 반영 */
    setSky(sky) {
      keys.forEach((k, i) => {
        const b = sky.bodies[k];
        const p = raDecToVec3(b.ra, b.dec, R);
        p.toArray(geo.attributes.position.array, i * 3);
        // 등급 → 스프라이트 크기
        geo.attributes.aSize.array[i] = THREE.MathUtils.clamp(14 - b.mag * 3.2, 7, 26);
        positions[k] = p;
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      positions.Moon = raDecToVec3(sky.bodies.Moon.ra, sky.bodies.Moon.dec, R);
      positions.Sun = raDecToVec3(sky.bodies.Sun.ra, sky.bodies.Sun.dec, R);
      moon.position.copy(positions.Moon);
      sun.position.copy(positions.Sun);
      moonIllum = sky.moon.illum;
    },
    /** 매 프레임: 원반을 카메라 쪽으로 세우고 달의 조명 방향 갱신 */
    update(camera, zoom) {
      // 원반은 3D 공간의 물체라 화각에 따라 자연스럽게 커진다 (실제 크기의 약 3배로 과장)
      moon.scale.setScalar(40);
      sun.scale.setScalar(52);
      moon.quaternion.copy(camera.quaternion);
      sun.quaternion.copy(camera.quaternion);
      planetMat.uniforms.uZoom.value = zoom;
      // 태양 방향을 달 원반 평면에 투영 (카메라 기준 축)
      const right = tmpA.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = tmpB.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const toSun = positions.Sun.clone().sub(positions.Moon).normalize();
      const x = toSun.dot(right), y = toSun.dot(up);
      const len = Math.hypot(x, y) || 1;
      // 위상각 i: 조명 비율 k = (1 + cos i) / 2
      const i = Math.acos(THREE.MathUtils.clamp(2 * moonIllum - 1, -1, 1));
      moonMat.uniforms.uLight.value.set((x / len) * Math.sin(i), (y / len) * Math.sin(i), Math.cos(i));
    },
  };
}
