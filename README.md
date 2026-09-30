# Star Fortune

실제 밤하늘과 오늘의 행성 배치로 읽는 별자리 운세. 서버 없이 브라우저에서만 동작하는 정적 사이트다.

- 실제 별 9,096개(Yale Bright Star Catalog), 등급별 밝기와 색온도별 색
- 셰이더로 그린 은하수, 블룸·필름 그레인, 대기 반짝임, 유성
- astronomy-engine으로 오늘의 태양·달·행성 위치와 달 위상 계산 → 행성 7개와 내 별자리의 각(합·삼각·육각·사각·대립)을 영역별 점수와 해석 문장에 반영
- 운세: 종합 점수, 6개 영역(총운·애정·관계·일·금전·건강), 시간대별 흐름, 실천 목록, 오늘의 궁합, 행운 5종. 문장 약 1,000개(`src/fortune/content/`)를 날짜마다 순환해 같은 별자리에서 풀 크기만큼은 반복되지 않음
- 생일 저장(이 기기에만), `#leo` 같은 주소로 바로 열기, 운세 카드 PNG 저장·공유

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 운세 엔진·천문 계산 테스트
npm run build    # dist/ 생성
npm run data     # scripts/*.json 원본 → public/data/stars.json, src/sky/zodiac-lines.json 재생성
```

## 구조

| 경로 | 역할 |
|---|---|
| `src/sky/` | Three.js 하늘 (별, 은하수, 별자리 선, 천체, 후처리, 카메라) |
| `src/astro/` | 천체 위치 계산 |
| `src/fortune/` | 별자리 정보, 행성 각 계산(`aspects.js`), 운세 엔진 |
| `src/fortune/content/` | 문장 풀, 행성 해석, 별자리 성향, 시간대·실천·키워드 |
| `src/ui/` | 운세 패널, 생일 입력, 공유 카드, 아이콘 |
| `legacy/` | v1 단일 HTML 원본 |

## 배포

`main` 브랜치에 push 하면 `.github/workflows/pages.yml`이 테스트 → 빌드 → GitHub Pages 배포를 한다.
저장소 Settings → Pages → Source 를 "GitHub Actions"로 한 번 설정해야 한다.

## 데이터 출처 (모두 무료)

- Yale Bright Star Catalog 5th ed. — 퍼블릭 도메인
- 별자리 선: d3-celestial (BSD-3-Clause)
- astronomy-engine (MIT), three.js (MIT), Lucide (ISC)
