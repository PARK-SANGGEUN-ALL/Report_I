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
