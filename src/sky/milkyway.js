// 절차적 은하수: 은하 좌표계 기반 띠 + 중심부 팽대부 + 노이즈 먼지대 + 약한 대기광
// 외부 텍스처 없이 셰이더로만 그려 라이선스·용량 부담이 없다.
import * as THREE from 'three';
import { EQ_TO_GAL } from './coords.js';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// simplex noise 3D — Ashima Arts / Stefan Gustavson (MIT)
const noise = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}return f;}
`;

const frag = /* glsl */ `
  uniform mat3 uEqToGal;
  uniform float uStrength;
  varying vec3 vDir;
  ${noise}
  void main() {
    vec3 d = normalize(vDir);
    vec3 e = vec3(d.x, -d.z, d.y);          // three → 천문 표준 적도
    vec3 g = uEqToGal * e;
    float l = atan(g.y, g.x);               // -pi..pi, 0 = 은하 중심(궁수자리 방향)
    float b = asin(clamp(g.z, -1.0, 1.0));

    float n1 = fbm(d * 3.2);
    float n2 = fbm(d * 9.0 + 7.3);
    float n3 = fbm(d * 22.0 + 2.1);

    // 띠 폭이 경도에 따라 출렁이도록
    float width = 0.16 + 0.06 * n1;
    float band = exp(-pow(b / width, 2.0));
    float bulge = exp(-(pow(l / 0.55, 2.0) + pow(b / 0.2, 2.0)));
    float along = 0.42 + 0.58 * pow(0.5 + 0.5 * cos(l), 1.6);

    // 별구름 얼룩: 큰 덩어리 + 잔결. 대비를 크게 줘서 뭉개진 안개처럼 보이지 않게
    float clump = pow(0.5 + 0.5 * n2, 1.6) * 1.5 + 0.12;
    float grain = 0.65 + 0.7 * (0.5 + 0.5 * n3);
    float light = (band * 0.55 + bulge * 0.75) * along * clump * grain;

    // 먼지대: 은하면을 따라 구불구불한 어두운 띠 (Great Rift 느낌)
    float laneB = b - 0.035 * n1 - 0.02;
    float lane = exp(-pow(laneB / (0.03 + 0.025 * (0.5 + 0.5 * n2)), 2.0)) * smoothstep(-0.2, 0.35, n2 + 0.25);
    light *= 1.0 - 0.85 * lane * smoothstep(2.2, 0.0, abs(l));
    // 작은 암흑 성운 조각
    light *= 1.0 - 0.5 * smoothstep(0.25, 0.6, fbm(d * 14.0 + 11.0)) * band;

    vec3 cool = vec3(0.56, 0.64, 0.92);
    vec3 warm = vec3(1.0, 0.82, 0.62);
    vec3 col = mix(cool, warm, clamp(bulge * 1.3 + 0.15 * n2, 0.0, 1.0));
    // 붉은 발광 성운 흔적 (아주 약하게)
    col += vec3(0.5, 0.08, 0.12) * smoothstep(0.35, 0.8, n3) * band * 0.35;

    vec3 airglow = vec3(0.0035, 0.005, 0.012);
    gl_FragColor = vec4(airglow + col * light * uStrength, 1.0);
  }
`;

export function createMilkyWay() {
  const m = EQ_TO_GAL;
  // mat3 는 열 우선 → set() 은 행 우선으로 받아준다
  const eqToGal = new THREE.Matrix3().set(...m[0], ...m[1], ...m[2]);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uEqToGal: { value: eqToGal }, uStrength: { value: 0.1 } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 96, 64), mat);
  mesh.renderOrder = 0;
  mesh.frustumCulled = false;
  return mesh;
}
