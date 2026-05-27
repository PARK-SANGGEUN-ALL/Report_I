// ════════════════════════════════════════════════════════
// 2022 개정 (2028학년도 대입) 예측 데이터
// 5등급제 환경에서의 합격선 추정 + 시행계획 반영
// ════════════════════════════════════════════════════════

// 2015 → 2022 환산 추정표
// 9등급제 평균등급 → 5등급제 평균등급 (수능·내신 모두)
export const GRADE_CONVERSION = {
  // 9등급 → 5등급 추정 (정시 컷 기준)
  "1.0": 1.0, "1.5": 1.2, "2.0": 1.5, "2.5": 1.8, "3.0": 2.1,
  "3.5": 2.5, "4.0": 2.8, "4.5": 3.2, "5.0": 3.5, "5.5": 3.9,
  "6.0": 4.2, "6.5": 4.5, "7.0": 4.7, "7.5": 4.9, "8.0": 5.0,
  "8.5": 5.0, "9.0": 5.0
};

// 9등급 → 5등급 환산 함수 (선형 보간)
export function convert9To5(grade9) {
  const g = parseFloat(grade9);
  if (isNaN(g)) return null;
  if (g <= 1.0) return 1.0;
  if (g >= 9.0) return 5.0;
  const floor = Math.floor(g * 2) / 2;
  const ceil = floor + 0.5;
  const floorVal = GRADE_CONVERSION[floor.toFixed(1)] || floor * 0.5;
  const ceilVal = GRADE_CONVERSION[ceil.toFixed(1)] || ceil * 0.5;
  const ratio = (g - floor) / 0.5;
  return parseFloat((floorVal + (ceilVal - floorVal) * ratio).toFixed(2));
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
      {name:"서울교대", region:"서울", cut:1.8},
      {name:"경인교대", region:"인천/경기", cut:2.0},
      {name:"한국교원대(초등)", region:"충북", cut:1.9},
      {name:"고려대 교육학과", region:"서울", cut:1.7},
      {name:"이화여대 사범대", region:"서울", cut:2.0},
      {name:"한양대 교육공학과", region:"서울", cut:1.8},
      {name:"지역교대(전국)", region:"전국", cut:2.4},
      {name:"국립대 사범대", region:"전국", cut:2.5},
    ]
  },
];

// 학생 평균등급(9등급 환산) 대비 각 대학 유불리 판정
// 예체능(체육·무도·미술·음악·디자인 등) 계열 판별
export function isArtsPhysical(major) {
  if (!major) return false;
  const m = String(major).replace(/\s+/g, "");
  const keys = ["체육","무도","태권도","유도","검도","스포츠","운동","경호","레저","무용","음악","성악","작곡","기악","미술","디자인","조형","회화","조소","연극","영화","연기","실용음악","뮤지컬","공연","예술","애니메이션","사진","공예","패션"];
  return keys.some(k => m.includes(k));
}

export function compareAllUnivs(grade9, major, is5=false) {
  const g = parseFloat(grade9);
  if (isNaN(g)) return null;
  const arts = isArtsPhysical(major);

  return UNIV_TIERS.map(tier => ({
    ...tier,
    arts,
    univs: tier.univs.map(u => {
      // 5등급제(고1·2)면 합격선(cut)을 5등급으로 환산해서 비교
      const cutCmp = is5 ? convert9To5(u.cut) : u.cut;
      const cutShow = is5 ? convert9To5(u.cut) : u.cut;
      if (arts) {
        return { ...u, cutShow, diff: null, verdict: "실기중심", vColor: "#7e22ce", artsNote: true };
      }
      const diff = g - cutCmp;
      let verdict, vColor;
      if (diff <= -0.5) { verdict = "안정"; vColor = "#16a34a"; }
      else if (diff <= 0.0) { verdict = "적정"; vColor = "#0c8599"; }
      else if (diff <= 0.5) { verdict = "소신"; vColor = "#d97706"; }
      else if (diff <= 1.2) { verdict = "도전"; vColor = "#dc2626"; }
      else { verdict = "상향(어려움)"; vColor = "#991b1b"; }
      return { ...u, cutShow, diff: +diff.toFixed(2), verdict, vColor };
    })
  }));
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
