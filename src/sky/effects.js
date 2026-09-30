// 후처리(블룸·톤매핑·그레인·비네트)와 유성
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVignette: { value: 0.55 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float vig = 1.0 - uVignette * dot(q, q) * 1.6;
      float g = hash(vUv * 1024.0 + fract(uTime * 13.7)) - 0.5;
      c.rgb = c.rgb * vig + g * uGrain;
      gl_FragColor = vec4(max(c.rgb, 0.0), 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera, { mobile }) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloomScale = mobile ? 0.35 : 0.5;
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x * bloomScale, size.y * bloomScale), 0.7, 0.55, 0.12);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  if (mobile) finish.uniforms.uGrain.value = 0.02;
  composer.addPass(finish);
  return {
    composer,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w * bloomScale, h * bloomScale);
    },
    render(time) {
      finish.uniforms.uTime.value = time;
      composer.render();
    },
  };
}

/** 유성: 가끔 하늘을 가로지르는 선. 머리는 밝고 꼬리는 사라진다. */
export function createMeteors(scene, { reducedMotion }) {
  const R = 950;
  const pool = [];
  let next = 4 + Math.random() * 8;
  let clock = 0;

  function spawn(camera) {
    // 카메라가 보는 방향 근처에서 시작
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const start = fwd.clone()
      .addScaledVector(right, (Math.random() - 0.5) * 1.1)
      .addScaledVector(up, 0.15 + Math.random() * 0.35)
      .normalize();
    const ang = Math.random() * Math.PI * 2;
    const dir = right.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, -Math.abs(Math.sin(ang))).normalize();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1.4, 1.35, 1.25, 0, 0, 0]), 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 5;
    scene.add(line);
    pool.push({ line, start, dir, t: 0, life: 0.6 + Math.random() * 0.6, speed: 0.35 + Math.random() * 0.35, len: 0.06 + Math.random() * 0.08 });
  }

  return {
    update(dt, camera) {
      if (reducedMotion) return;
      clock += dt;
      if (clock > next) {
        spawn(camera);
        // 가끔 유성우처럼 연달아
        next = clock + (Math.random() < 0.15 ? 0.3 + Math.random() * 0.6 : 6 + Math.random() * 14);
      }
      for (let i = pool.length - 1; i >= 0; i--) {
        const m = pool[i];
        m.t += dt;
        const k = m.t / m.life;
        if (k >= 1) {
          scene.remove(m.line);
          m.line.geometry.dispose();
          m.line.material.dispose();
          pool.splice(i, 1);
          continue;
        }
        const head = m.start.clone().addScaledVector(m.dir, m.speed * m.t).normalize().multiplyScalar(R);
        const tail = m.start.clone().addScaledVector(m.dir, Math.max(0, m.speed * m.t - m.len)).normalize().multiplyScalar(R);
        const a = m.line.geometry.attributes.position.array;
        head.toArray(a, 0);
        tail.toArray(a, 3);
        m.line.geometry.attributes.position.needsUpdate = true;
        m.line.material.opacity = Math.sin(Math.PI * k);
      }
    },
  };
}
