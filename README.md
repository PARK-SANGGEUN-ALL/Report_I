# 리포트아이 (Report-I) v22

생기부(학생부) 정밀 분석 웹앱

## 주요 기능
- PDF 생기부 자동 파싱 (학년/학기/표 구조 인식)
- 학기별 성적 추이 + 교과별 탭 그래프
- 강점·보완점 (원문 근거 3~4개)
- 활동 타임라인 (동기/과정/성장)
- 키워드 분석 (TOP 5 + 종합 해석)
- 5개 역량 채점 (각 역량 근거 4~5개)
- 학과 적합도 (Top 5+, 액션 플랜)
- 탐구 주제 + 추천도서 1371권 자동 매칭
- 종합 리포트 (3500자+ 12단락)
- 지역→대학→학과 드롭다운 (41개 대학)
- 가이드북 기반 합격 사례 6개 통합 분석

## 환경변수 (Vercel)
**필수 (최소 1개)**
- `ANTHROPIC_API_KEY` — Claude API 키 (1순위로 호출됨, 권장)
- `GEMINI_API_KEY` — Google AI Studio API 키 (Claude 실패 시 폴백)

**보안 강화용 (선택, 권장)**
- `ALLOWED_ORIGIN` — 배포된 실제 도메인(예: `https://reporti.vercel.app`). 설정 시 다른 사이트에서
  이 API를 직접 호출하지 못하도록 CORS를 제한합니다. 미설정 시 모든 오리진을 허용(개발 편의용).
- `APP_SHARED_SECRET` — ⚠️ 현재 클라이언트 코드가 이 헤더를 보내지 않으므로 **설정하지 마세요**.
  설정하면 모든 분석 요청이 403으로 막힙니다.

**선택 기능 — 실제 합격/불합격 후기 웹 검색**
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` — [네이버 개발자센터](https://developers.naver.com/apps/#/register)에서
  '검색' API로 무료 발급. 두 값을 모두 설정하면 Phase 5 분석 시 네이버 블로그·카페에서 입력한
  대학·학과의 실제 합격/불합격 후기를 검색해 근거로 활용합니다. 미설정 시 이 기능만 조용히
  건너뛰고 나머지 분석은 정상 동작합니다.

## AI 호출 순서 (v51 이후)
1. Claude Sonnet (`ANTHROPIC_API_KEY` 있을 때 1순위)
2. Gemini 2.5 Flash (Claude 실패 시 1회 폴백)
3. Claude Sonnet 4.5 (있을 때만)
4. GPT-4o (최후 폴백)

## 배포
- Vercel Pro 플랜 (maxDuration 300s)
- 자동 배포 (main 브랜치 push 시)
