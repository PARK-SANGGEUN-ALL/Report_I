// ════════════════════════════════════════════════════════
// 2022 개정 (2028학년도 대입) 예측 데이터
// 5등급제 환경에서의 합격선 추정 + 시행계획 반영
// ════════════════════════════════════════════════════════
import { getRealCut, getRealMedCut } from "./realIpgyeol.js";

// 전공명 → 인문/자연 계열 분류 (실제 입결 데이터 조회용 간이 휴리스틱)
const NATURAL_KEYWORDS = ["공학","공과","전자","전기","기계","컴퓨터","소프트웨어","AI","인공지능","물리","화학","생명","생물","수학","통계","의예","치의","한의","약학","수의","간호","보건","환경","에너지","반도체","로봇","건축","토목","산업공학","자연과학","식품","농업","해양","지구과학","천문","바이오","IT","정보통신"];
export function classifyGyeol(major) {
  if (!major) return "인문";
  const m = String(major).replace(/\s+/g, "");
  return NATURAL_KEYWORDS.some(k => m.includes(k)) ? "자연" : "인문";
}

// ════════════════════════════════════════════════════════
// 🆕 5등급제 ↔ 9등급제 환산 — 부산광역시교육청 실측 데이터 기반 (2026.08)
// 출처: "부산광역시교육청 관내 고교 5등급제 1학년 1~2학기 등급평균 분석 자료"
// (부산 88개교 14,331명, 現 고1 1~2학기 5등급제 누적 실측치를
//  同 학생 이전 기수의 9등급제 등급평균 94개교 15,670명과 누적백분위로 매칭한 실제 대응표)
// ⚠️ 기존에는 "추정" 환산표를 썼으나, 이제 실제 대규모 표본의 누적분포 매칭 데이터로 교체.
// 5등급제는 9등급제보다 상대평가 과목 수가 많고(부산 기준 7~8과목↑), 고교학점제로 과목당
// 이수인원이 줄어 상위 등급 유지가 9등급제보다 어렵다는 점이 이 데이터에 반영되어 있음.
// ════════════════════════════════════════════════════════
// [5등급제 평균, 누적비(%), 9등급제 등급평균 동등값] — 실측 앵커 포인트
export const GRADE5_TO_9_ANCHORS = [
  [1.00, 0.30, 1.15], [1.00, 0.45, 1.21], [1.00, 0.60, 1.26], [1.00, 1.30, 1.45],
  [1.08, 1.87, 1.59], [1.16, 2.76, 1.78], [1.24, 3.65, 1.98], [1.33, 4.81, 2.14],
  [1.42, 5.92, 2.32], [1.50, 7.08, 2.45], [1.66, 9.51, 2.72], [1.83, 13.03, 3.03],
  [2.00, 17.42, 3.35], [2.16, 21.04, 3.60], [2.33, 26.02, 3.91], [2.50, 31.39, 4.20],
  [2.66, 36.58, 4.46], [2.83, 42.93, 4.73], [3.00, 49.98, 5.03], [3.16, 55.84, 5.28],
  [3.33, 62.84, 5.58], [3.50, 69.09, 5.86], [3.66, 74.08, 6.08], [3.83, 79.74, 6.37],
  [4.00, 84.90, 6.67], [4.16, 88.48, 6.93], [4.33, 91.75, 7.20], [4.50, 94.07, 7.48],
  [4.66, 95.66, 7.71], [4.83, 97.03, 8.00], [5.00, 100.00, 9.00],
];
// (참고용 — 1학년 1학기만 기준일 때의 동일 표. 1~2학기 누적표보다 상위권이 살짝 후하게 나옴)
export const GRADE5_TO_9_ANCHORS_SEM1 = [
  [1.00, 0.05, 1.00], [1.00, 0.50, 1.22], [1.00, 0.75, 1.29], [1.00, 1.00, 1.38],
  [1.00, 2.07, 1.64], [1.16, 2.85, 1.81], [1.33, 5.03, 2.18], [1.50, 7.30, 2.48],
  [1.66, 9.97, 2.76], [1.83, 13.56, 3.07], [2.00, 18.59, 3.44], [2.16, 21.06, 3.61],
  [2.33, 26.45, 3.94], [2.50, 31.87, 4.22], [2.66, 36.92, 4.47], [2.83, 43.70, 4.76],
  [3.00, 51.18, 5.08], [3.16, 55.22, 5.25], [3.33, 62.16, 5.55], [3.50, 68.50, 5.83],
  [3.66, 73.48, 6.05], [3.83, 79.42, 6.35], [4.00, 85.22, 6.69], [4.16, 87.27, 6.84],
  [4.33, 91.06, 7.14], [4.50, 93.51, 7.40], [4.66, 95.14, 7.63], [4.83, 96.95, 7.97],
  [5.00, 100.00, 9.00],
];

// 선형보간 헬퍼 — points 배열에서 xi번째 값을 x축, yi번째 값을 y축으로 보간
function interp(points, x, xi = 0, yi = 1) {
  const pts = points.filter((p, i, arr) => i === 0 || p[xi] !== arr[i - 1][xi]); // 연속 중복 x 제거
  if (x <= pts[0][xi]) return pts[0][yi];
  if (x >= pts[pts.length - 1][xi]) return pts[pts.length - 1][yi];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i][xi], y0 = pts[i][yi];
    const x1 = pts[i + 1][xi], y1 = pts[i + 1][yi];
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      const ratio = (x - x0) / (x1 - x0);
      return +(y0 + (y1 - y0) * ratio).toFixed(2);
    }
  }
  return pts[pts.length - 1][yi];
}

// 5등급제 평균 → 9등급제 등급평균 동등값 (실측 앵커 선형보간)
export function convert5To9(grade5) {
  const g = parseFloat(grade5);
  if (isNaN(g)) return null;
  // 앵커는 [5등급, 누적%, 9등급] — 5등급 기준으로 보간(xi=0, yi=2)
  return interp(GRADE5_TO_9_ANCHORS, g, 0, 2);
}

// 9등급제 등급평균 → 5등급제 평균 동등값 (실측 앵커 역보간)
export function convert9To5(grade9) {
  const g = parseFloat(grade9);
  if (isNaN(g)) return null;
  if (g <= 1.0) return 1.0;
  if (g >= 9.0) return 5.0;
  // 9등급 값 기준 오름차순 정렬 후 9등급→5등급 보간(xi=2, yi=0)
  const sorted = [...GRADE5_TO_9_ANCHORS].sort((a, b) => a[2] - b[2]);
  return interp(sorted, g, 2, 0);
}

// 주요 대학·전형별 2028 합격선 예측 (5등급제 기준)
// 출처: 2024학년도 합격 데이터 기반 + 시행계획 분석 + 5등급제 환산
export const PREDICTION_2028 = {
  "서울대": {
    "지역균형": { grade: 1.5, note: "5등급제에서 약 1.3~1.7 예상 (전과목 A 비율 ↑ 필요)" },
    "일반전형": { grade: 1.3, note: "정성평가 강화, 세특·탐구 중요도 압도적" },
    "기회균형": { grade: 2.0, note: "지원자격 충족 + 균형있는 학종 기록" },
    "추세": "성취도(A) 비율 + 진로선택 이수 + 세특 깊이 = 합격 키"
  },
  "연세대": {
    "활동우수형": { grade: 1.8, note: "1.5~2.0 예상, 활동·세특·탐구 균형" },
    "추천형(지역균형)": { grade: 1.5, note: "교과 우수 + 비교과 균형" },
    "기회균형전형": { grade: 2.3, note: "사회적 배려 대상" },
    "추세": "활동의 양보다 깊이, 진로 일관성 + 학업역량 균형"
  },
  "고려대": {
    "학업우수형": { grade: 1.7, note: "1.5~2.0, 정성평가에서 세특 핵심" },
    "계열적합형": { grade: 2.0, note: "1.8~2.3, 진로 적합성·탐구 깊이 강조" },
    "고른기회전형": { grade: 2.3, note: "사회적 배려 + 학종 기본 갖춤" },
    "추세": "학과별 권장과목 이수 + 진로 일관성 매우 중요"
  },
  "성균관대": {
    "학과모집(학종)": { grade: 1.8, note: "1.5~2.2, 학업 + 활동 균형" },
    "계열모집(학종)": { grade: 2.0, note: "1.8~2.3" },
    "추세": "계열 모집 → 학과 모집 전환 트렌드, 학과 맞춤 활동 필요"
  },
  "한양대": {
    "추천형": { grade: 1.7, note: "1.5~2.0, 학교장 추천" },
    "서류형": { grade: 1.8, note: "1.5~2.1, 활동·탐구 깊이" },
    "면접형": { grade: 1.9, note: "면접 비중 ↑" },
    "추세": "학업역량 + 인성 함께 평가, 활동의 깊이 중요"
  },
  "서강대": {
    "일반전형(학종)": { grade: 1.9, note: "1.7~2.2" },
    "추세": "전공 적합성 + 학업 균형"
  },
  "중앙대": {
    "다빈치형인재": { grade: 2.0, note: "1.8~2.3, 진로 일관성" },
    "탐구형인재": { grade: 2.0, note: "1.8~2.3, 탐구 깊이" },
    "추세": "탐구 활동의 진정성 + 진로 적합성"
  },
  "경희대": {
    "네오르네상스": { grade: 2.0, note: "1.8~2.3, 다양한 변수 고려" },
    "추세": "일반고 우수자에게 유리, 모집단위·경쟁률 변동 큼"
  },
  "한국외대": {
    "학생부종합": { grade: 2.1, note: "1.8~2.4, 어학·국제 일관성" },
    "추세": "외국어·국제 진로 명확성"
  },
  "이화여대": {
    "미래인재전형": { grade: 1.9, note: "1.7~2.2" },
    "추세": "학업 + 활동 균형"
  },
};

// 학과 적합도 예측 — 5등급제 환경
export function predictAdmission(univ, dept, grade5, competencyScore) {
  const data = PREDICTION_2028[univ];
  if (!data) return null;

  const transcripts = Object.entries(data)
    .filter(([k]) => k !== "추세")
    .map(([type, info]) => {
      const diff = grade5 - info.grade;
      let verdict, color;
      if (diff <= -0.3) { verdict = "안정"; color = "#16a34a"; }
      else if (diff <= 0.2) { verdict = "적정"; color = "#0c8599"; }
      else if (diff <= 0.5) { verdict = "도전"; color = "#d97706"; }
      else { verdict = "불리"; color = "#dc2626"; }
      return { type, expectedGrade: info.grade, verdict, color, note: info.note, diff: diff.toFixed(2) };
    });

  return {
    univ, dept,
    transcripts,
    trend: data["추세"],
    bestType: transcripts.find(t => t.verdict === "안정") || transcripts.find(t => t.verdict === "적정") || transcripts[0]
  };
}

// 학종 합격을 위한 5등급제 환경 점검 항목
export const CHECKLIST_2028 = {
  학업: [
    "주요 과목(국·영·수·사·과) A 성취도 비율 60% 이상",
    "1·2학년 성적 추이가 상승 또는 유지",
    "진로 관련 과목에서 A 성취도 + 분포 우수",
    "기초 학력 (한국사·통합사회·통합과학) 안정"
  ],
  탐구: [
    "진로선택 과목 이수 의지 명확 (분포 비율 낮은 A 받기)",
    "1년 이상 연계되는 탐구 주제 진행",
    "세특에 구체적 활동 + 본인 역할 + 성장 기록",
    "탐구방법 다양 (실험·문헌·발표·토론 모두 시도)"
  ],
  진로: [
    "1학년부터 진로 키워드 일관성 (변경되어도 발전 방향)",
    "동아리·자율·진로활동이 진로와 연계",
    "진로 관련 독서 활동 5권 이상",
    "외부 활동·체험을 학교 활동으로 연결"
  ],
  공동체: [
    "학급 임원 / 동아리 부장 / 봉사 리더 경험",
    "협업 프로젝트에서 본인 역할 + 기여 명확",
    "갈등 해결·중재 경험 기록",
    "행동특성 및 종합의견에서 인성 강점 드러남"
  ]
};

// ════════════════════════════════════════════════════════
// 🆕 대학 그룹(티어)별 목록 — 유불리 종합 비교용
// 각 대학: {name, tier, region, gradeCut(2015 9등급 학종 평균 합격선 추정)}
// gradeCut은 학생부종합전형 일반학과 기준 추정치 (인문/자연 평균)
// ════════════════════════════════════════════════════════
// 🆕 2026학년도 실제 교과전형 70%컷 (내신 위주) — 참고용
// 종합전형은 이보다 낮게(후하게) 형성되나 세특·활동·면접이 결정적
export const GYOGWA_CUT_2026 = {
  "고려대": {인문:1.33, 자연:1.22, note:"정치외교 1.22, 경영 1.31"},
  "성균관대": {인문:2.07, 자연:1.69, note:"자유전공 1.51"},
  "서강대": {인문:2.12, 자연:2.61},
  "한양대": {전체:1.54, note:"반도체 1.13, 화학공학 1.56"},
};

export const UNIV_TIERS = [
  {
    tier: "최상위권", color: "#c92a2a",
    desc: "서울대·연세대·고려대 및 최상위 특수대학",
    univs: [
      {name:"서울대", region:"서울", cut:1.2},
      {name:"연세대", region:"서울", cut:1.4},
      {name:"고려대", region:"서울", cut:1.4},
      {name:"KAIST", region:"대전", cut:1.4},
      {name:"포항공대(POSTECH)", region:"경북", cut:1.4},
      {name:"의예과(전국)", region:"전국", cut:1.0},
      {name:"교대(전국)", region:"전국", cut:1.6},
      {name:"사관학교(전국)", region:"전국", cut:2.0},
    ]
  },
  {
    tier: "상위권", color: "#d97706",
    desc: "서성한·중경외시 + 이화여대",
    univs: [
      {name:"성균관대", region:"서울", cut:1.6},
      {name:"서강대", region:"서울", cut:1.6},
      {name:"한양대", region:"서울", cut:1.6},
      {name:"중앙대", region:"서울", cut:1.8},
      {name:"경희대", region:"서울", cut:1.8},
      {name:"한국외대", region:"서울", cut:1.9},
      {name:"서울시립대", region:"서울", cut:1.8},
      {name:"이화여대", region:"서울", cut:1.8},
    ]
  },
  {
    tier: "중상위권", color: "#2745a8",
    desc: "건동홍·국숭세단 + 서울 주요 대학",
    univs: [
      {name:"건국대", region:"서울", cut:2.0},
      {name:"동국대", region:"서울", cut:2.0},
      {name:"홍익대", region:"서울", cut:2.1},
      {name:"국민대", region:"서울", cut:2.3},
      {name:"숭실대", region:"서울", cut:2.3},
      {name:"세종대", region:"서울", cut:2.3},
      {name:"단국대", region:"경기", cut:2.5},
      {name:"서울과기대", region:"서울", cut:2.2},
    ]
  },
  {
    tier: "중위권", color: "#2b8a3e",
    desc: "광운·명지·상명·가천 등 서울·경기권",
    univs: [
      {name:"광운대", region:"서울", cut:2.5},
      {name:"명지대", region:"서울", cut:2.8},
      {name:"상명대", region:"서울", cut:2.9},
      {name:"가천대", region:"경기", cut:2.7},
      {name:"인하대", region:"인천", cut:2.3},
      {name:"아주대", region:"경기", cut:2.2},
      {name:"경기대", region:"경기", cut:3.0},
    ]
  },
  {
    tier: "거점국립대", color: "#0c8599",
    desc: "지역 거점 국립대학교 (지역인재 전형 유리)",
    univs: [
      {name:"부산대", region:"부산", cut:2.1},
      {name:"경북대", region:"대구", cut:2.2},
      {name:"전남대", region:"광주", cut:2.4},
      {name:"전북대", region:"전북", cut:2.5},
      {name:"충남대", region:"대전", cut:2.4},
      {name:"충북대", region:"충북", cut:2.6},
      {name:"강원대", region:"강원", cut:2.8},
      {name:"경상국립대", region:"경남", cut:2.7},
      {name:"제주대", region:"제주", cut:2.9},
    ]
  },
  {
    tier: "교대·사범대", color: "#7e22ce",
    desc: "교원양성 — 교직 인성·적성·교과 균형 중시 (면접 비중 큼)",
    univs: [
      {name:"서울교대", region:"서울", cut:2.1},
      {name:"경인교대", region:"인천/경기", cut:2.3},
      {name:"한국교원대(초등)", region:"충북", cut:2.0},
      {name:"고려대 교육학과", region:"서울", cut:1.7},
      {name:"이화여대 사범대", region:"서울", cut:2.0},
      {name:"한양대 교육공학과", region:"서울", cut:1.8},
      {name:"지역교대(전국)", region:"전국", cut:2.6},
      {name:"국립대 사범대", region:"전국", cut:2.6},
    ]
  },
];

// ════════════════════════════════════════════════════════
// 🆕 합격 가능성(%) 추정 — diff(격차) → 보수적 확률 밴드
// 근거: 경기도교육청·서울시교육청·울산진학지원단·인천교육청 자료 및
// 각 대학 학종 실제 입결(충원율·최종등록자 평균·70%컷) 분석 결과,
// 학과별 편차가 매우 크고(예: 동일대학 내 화학과 3.49 vs 정치외교 1.9대 등)
// "평균 합격선"만 보고 판단하면 실제보다 낙관적으로 보이는 경향이 확인됨.
// → 밴드를 기존보다 한 단계씩 더 보수적으로 좁히고, 확률도 상한을 낮춤.
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// 🆕 보수적 판정 v3 (2026.08) — 사용자 피드백 반영: 실제 합격 데이터의 등급컷은 특목고·
// 자사고 등 여러 고교유형이 섞인 전형 결과이며, 단순 등급 비교만으로 "소신/적정"을 후하게
// 주면 실제보다 훨씬 낙관적인 인상을 준다는 지적에 따라 밴드를 한 단계 더 좁히고 확률
// 상한을 낮췄다. "이 정도면 거의 합격"이라는 착각을 주지 않는 것을 최우선 목표로 한다.
// ════════════════════════════════════════════════════════
export function estimateProbability(diff, arts=false) {
  if (arts) return { label: "실기중심", min: null, max: null, mid: null, note: "실기·실적이 당락을 좌우하여 수치화 불가" };
  if (diff <= -1.3) return { label: "안정", min: 55, max: 70, mid: 62 };
  if (diff <= -0.8) return { label: "적정", min: 35, max: 50, mid: 42 };
  if (diff <= -0.3) return { label: "소신", min: 18, max: 32, mid: 25 };
  if (diff <= 0.3)  return { label: "도전", min: 8, max: 18, mid: 13 };
  if (diff <= 0.8)  return { label: "상향", min: 2, max: 8, mid: 5 };
  return { label: "매우 상향(희박)", min: 0, max: 3, mid: 1 };
}

// 🆕 대학별 참고컷은 "평균값"일 뿐, 실제 학과별 편차가 매우 크다는 근거 안내
// (경기·서울·인천·울산 진학지원단 자료의 학과별 최종등록자 평균 사례 기반)
export const DEPT_VARIANCE_WARNING =
  "⚠️ 위 대학별 참고컷은 학종 일반학과 «평균치»입니다. 실제로는 같은 대학 안에서도 " +
  "인기학과(경영·정치외교·컴퓨터공학 등)는 평균보다 0.3~0.8등급 빡빡하고, " +
  "상대적으로 비인기 기초학문(화학과·물리학과·생명과학과·어문계열 등)은 " +
  "평균보다 1~2등급 이상 낮은(후한) 선에서 최종등록자가 형성되는 경우도 실제 데이터로 확인됩니다. " +
  "따라서 «대학 평균컷»이 아니라 반드시 «지원하려는 학과 자체의 최근 3개년 입결»을 확인하고, " +
  "이 리포트의 판정은 어디까지나 참고용 보수적 추정치로 활용하시기 바랍니다.";

// 학생 평균등급(9등급 환산) 대비 각 대학 유불리 판정
// 예체능(체육·무도·미술·음악·디자인 등) 계열 판별
export function isArtsPhysical(major) {
  if (!major) return false;
  const m = String(major).replace(/\s+/g, "");
  const keys = ["체육","무도","태권도","유도","검도","스포츠","운동","경호","레저","무용","음악","성악","작곡","기악","미술","디자인","조형","회화","조소","연극","영화","연기","실용음악","뮤지컬","공연","예술","애니메이션","사진","공예","패션"];
  return keys.some(k => m.includes(k));
}

// factors: {coreAvg(주요교과평균), spread(등급편차), majorAvg(계열관련교과평균)} — 9등급 기준
export function compareAllUnivs(grade9, major, is5=false, factors=null) {
  const g = parseFloat(grade9);
  if (isNaN(g)) return null;
  const arts = isArtsPhysical(major);

  // 🆕 유효 등급 보정 — 관련교과 나쁘거나 편차 크면 페널티(등급 상향=불리)
  let penalty = 0;
  let penaltyNote = [];
  if (factors) {
    if (factors.coreAvg != null && factors.coreAvg > g + 0.3) {
      const p = Math.min((factors.coreAvg - g) * 0.4, 0.4);
      penalty += p; penaltyNote.push("주요교과 약세");
    }
    if (factors.majorAvg != null && factors.majorAvg > g + 0.3) {
      const p = Math.min((factors.majorAvg - g) * 0.5, 0.5);
      penalty += p; penaltyNote.push("관련교과 약세");
    }
    if (factors.spread != null && factors.spread > 1.2) {
      const p = Math.min((factors.spread - 1.2) * 0.3, 0.3);
      penalty += p; penaltyNote.push("성적 편차 큼");
    }
    penalty = Math.min(penalty, 1.0); // 총 페널티 상한
  }

  return UNIV_TIERS.map(tier => ({
    ...tier,
    arts,
    univs: tier.univs.map(u => {
      // 🆕 실제 입결 데이터(대학어디가 2023~2026) 우선 조회 — 계열(인문/자연)별 중위 컷
      const gyeol = classifyGyeol(major);
      const real = !arts ? getRealCut(u.name, gyeol) : null;
      const baseCut = real ? real.median : u.cut;
      const cutCmp = is5 ? convert9To5(baseCut) : baseCut;
      const cutShow = is5 ? convert9To5(baseCut) : baseCut;
      if (arts) {
        return { ...u, cutShow, diff: null, verdict: "실기중심", vColor: "#7e22ce", artsNote: true, prob: estimateProbability(0, true) };
      }
      // 페널티는 5등급 환산 시 비율 축소
      const effPenalty = is5 ? penalty * 0.55 : penalty;
      const diff = (g + effPenalty) - cutCmp;  // 페널티만큼 등급이 나쁜 것처럼 취급
      let verdict, vColor;
      // 🆕 보수적 판정 v3 — estimateProbability()와 동일한 임계값 사용(일관성 유지).
      if (diff <= -1.3) { verdict = "안정"; vColor = "#16a34a"; }
      else if (diff <= -0.8) { verdict = "적정"; vColor = "#0c8599"; }
      else if (diff <= -0.3) { verdict = "소신"; vColor = "#d97706"; }
      else if (diff <= 0.3) { verdict = "도전"; vColor = "#dc2626"; }
      else if (diff <= 0.8) { verdict = "상향(어려움)"; vColor = "#991b1b"; }
      else { verdict = "매우 상향(희박)"; vColor = "#7f1d1d"; }
      const prob = estimateProbability(diff, false);
      return {
        ...u, cutShow, diff: +diff.toFixed(2), verdict, vColor, prob,
        penaltyNote: penaltyNote.length?penaltyNote:null,
        dataSource: real ? "real" : "estimate",
        realRange: real ? { min: real.min, max: real.max, n: real.n, flagship: null } : null,
      };
    })
  }));
}

// ════════════════════════════════════════════════════════
// 🆕 대학 추천 순위 — compareAllUnivs() 결과를 받아
// "실제로 노려볼 만한" 대학을 합격가능성·소신/적정 우선으로 정렬.
// 근거(reason)는 diff·prob·penaltyNote를 조합해 자동 생성.
// ════════════════════════════════════════════════════════
export function rankRecommendedUnivs(cmp, topN = 8) {
  if (!cmp) return [];
  const flat = [];
  cmp.forEach(tier => {
    tier.univs.forEach(u => {
      if (u.artsNote) return; // 예체능은 별도 안내
      flat.push({ ...u, tier: tier.tier, tierColor: tier.color });
    });
  });
  // 정렬 우선순위: 적정 > 소신 > 안정 > 도전 > 상향 (안정만 잔뜩 있는 하향지원 나열 방지)
  const order = { "적정": 0, "소신": 1, "안정": 2, "도전": 3, "상향(어려움)": 4, "매우 상향(희박)": 5 };
  flat.sort((a, b) => {
    const oa = order[a.verdict] ?? 9, ob = order[b.verdict] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.diff ?? 0) - (b.diff ?? 0);
  });
  return flat.slice(0, topN).map((u, i) => {
    const reasonParts = [];
    reasonParts.push(`내신 참고컷 대비 ${u.diff > 0 ? "+" : ""}${u.diff}등급 격차(${u.verdict})`);
    if (u.prob?.mid != null) reasonParts.push(`추정 합격가능성 약 ${u.prob.min}~${u.prob.max}%`);
    if (u.dataSource === "real" && u.realRange) reasonParts.push(`실제 입결(대학어디가 2025~26, n=${u.realRange.n}) 기반, 학과별 범위 ${u.realRange.min.grade}~${u.realRange.max.grade}등급`);
    if (u.penaltyNote?.length) reasonParts.push(`⚠️ ${u.penaltyNote.join("·")} 반영해 보수적으로 산정`);
    return { rank: i + 1, ...u, reason: reasonParts.join(" · ") };
  });
}

// 예체능 전형 안내 데이터
export const ARTS_ADMISSION_INFO = {
  체육: {
    types: ["실기위주(실기고사)", "학생부종합(비실기)", "특기자(경기실적)", "학생부교과+실기"],
    note: "체육계열은 실기고사 비중이 매우 큽니다. 내신은 일부 전형(학종·교과)에서만 반영되며, 대부분 실기 능력·경기 실적이 당락을 좌우합니다.",
    keyFactors: ["실기 종목별 기록·기능", "경기 실적(특기자)", "체력장 측정", "면접(학종)"]
  },
  무도: {
    types: ["특기자(단증·입상)", "실기위주", "학생부종합"],
    note: "무도(태권도·유도·검도 등)는 단증·대회 입상 실적과 실기가 핵심입니다. 내신보다 특기 실적이 결정적입니다.",
    keyFactors: ["단증·품증", "전국/시도 대회 입상", "실기 시연", "지도자 추천"]
  },
  예술: {
    types: ["실기위주", "특기자(수상)", "학생부종합(비실기)"],
    note: "미술·음악·디자인 등은 실기고사·포트폴리오·수상실적이 핵심입니다. 내신 반영은 제한적입니다.",
    keyFactors: ["실기고사", "포트폴리오", "공모전·콩쿠르 수상", "전공 적합성"]
  }
};

export function getArtsType(major) {
  if (!major) return "체육";
  const m = String(major).replace(/\s+/g, "");
  if (["무도","태권도","유도","검도","경호"].some(k=>m.includes(k))) return "무도";
  if (["음악","성악","작곡","기악","미술","디자인","조형","회화","조소","연극","영화","연기","뮤지컬","공연","예술","애니메이션","사진","공예","패션","무용"].some(k=>m.includes(k))) return "예술";
  return "체육";
}
