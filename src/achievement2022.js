// 2022 개정 학생부의 «석차등급(1~5) · 성취도(A~E) · 성취도별 분포비율 · 원점수/과목평균»을 함께 읽는 해석 모듈.
// 원칙: 등급·성취도는 «출발점 정보»이며, 기본교과(국수영사과) 성취를 우선 보고, 분포비율로 A의 희소성을 가늠하되, 최종 판단은 여러 교과의 누적 맥락(세특)으로 한다.
const CORE = ["국어", "수학", "영어", "사회", "과학"]; const lvN = n => parseInt(n) || 0; const AR = { A: 1, B: 2, C: 3, D: 4, E: 5 };
function parseDist(s) { const d = {}; String(s || "").replace(/([A-E])\s*[:\(]\s*([\d.]+)/g, (_, k, v) => { d[k] = parseFloat(v); return ""; }); return d; }
export function achievement2022(G) {
  const is2022 = (G.curriculum || "").includes("2022") || G.is2022; if (!is2022) return null;
  const mk = (r, only) => { const dist = parseDist(r.distribution); const raw = parseFloat(r.rawScore), avg = parseFloat(r.avg);
    return { subject: r.subject, g: +r.gN || parseInt(r.grade) || 0, s: +r.sN || parseInt(r.semester) || 0, group: r.group || "", lv: lvN(r.level), ach: String(r.achievement || "").trim().toUpperCase().slice(0, 1), dist, aRate: dist.A ?? null, students: r.students || "", raw: isNaN(raw) ? null : raw, avg: isNaN(avg) ? null : avg, diff: (isNaN(raw) || isNaN(avg)) ? null : +(raw - avg).toFixed(1), only }; };
  const rows = [...(G.grades || []).map(r => mk(r, false)), ...(G.achievementSubjects || []).map(r => mk(r, true))].filter(r => AR[r.ach]);
  if (!rows.length) return { available: false, rows: [], summary: { nA: 0 }, matrix: {}, sentences: [] };
  const core = rows.filter(r => CORE.includes(r.group)); const A = rows.filter(r => r.ach === "A"); const Ar = A.filter(r => r.aRate != null);
  const coreARate = core.length ? Math.round(core.filter(r => r.ach === "A").length / core.length * 100) : 0;
  const avgARate = Ar.length ? +(Ar.reduce((a, r) => a + r.aRate, 0) / Ar.length).toFixed(1) : null;
  const scarce = Ar.filter(r => r.aRate <= 20), common = Ar.filter(r => r.aRate > 40);
  const easyA = rows.filter(r => r.lv >= 3 && (r.ach === "A" || r.ach === "B")), hardRank = rows.filter(r => r.lv > 0 && r.lv <= 2 && AR[r.ach] >= 3);
  const matrix = {}; rows.filter(r => r.lv > 0).forEach(r => { const k = r.lv + "|" + r.ach; (matrix[k] = matrix[k] || []).push(r); });
  // 2차원 영역(등급×성취도): 두 축이 모두 높을수록 상위
  const area = r => { if (!r.lv) return "성취도 전용"; const sc = (6 - r.lv) + (6 - AR[r.ach]); return sc >= 9 ? "상위" : sc >= 7 ? "중상" : sc >= 5 ? "중" : "하"; };
  rows.forEach(r => { r.area = area(r); r.scarcity = r.ach !== "A" || r.aRate == null ? "" : r.aRate <= 20 ? "희소" : r.aRate <= 40 ? "보통" : "흔함"; });
  const names = l => l.slice(0, 4).map(r => `${r.subject}(${r.g}-${r.s})`).join(", ") + (l.length > 4 ? " 외" : "");
  const sentences = [];
  sentences.push(`성취도가 확인된 ${rows.length}개 과목 중 A는 ${A.length}개이며 기본교과(국수영사과)의 A 비율은 ${coreARate}%임.`);
  if (avgARate != null) sentences.push(`받은 A의 평균 분포비율은 ${avgARate}%로 ${avgARate <= 25 ? "A가 희소한 과목 중심이라 성취도의 가치가 높음" : avgARate <= 40 ? "보통 수준의 변별력을 가짐" : "A가 흔한 과목 위주라 성취도의 변별력이 낮음"}.${scarce.length ? ` 분포비율 20% 이하의 희소한 A는 ${names(scarce)}임.` : ""}${common.length ? ` 분포비율 40% 초과의 흔한 A는 ${names(common)}임.` : ""}`);
  if (easyA.length) sentences.push(`석차등급은 3등급 이하이나 성취도 A·B인 과목이 ${easyA.length}개(${names(easyA)})로, 성취도가 석차등급보다 후하게 산출됨. 석차등급과 성취도 중 유리한 쪽을 반영하는 전형에서만 이점이 있고, 등급 중심 전형에서는 이 과목들이 약점으로 읽힘.`);
  if (hardRank.length) sentences.push(`석차등급은 1~2등급이나 성취도 C 이하인 과목이 ${hardRank.length}개(${names(hardRank)})로, 등급만 보면 우수하나 성취 수준은 낮게 평가될 수 있어 세특의 근거로 보완이 필요함.`);
  const diffs = rows.filter(r => r.diff != null); if (diffs.length) { const lo = diffs.filter(r => r.diff <= 5 && r.lv <= 2); if (lo.length) sentences.push(`1~2등급이지만 원점수가 과목평균과 5점 이내인 과목(${names(lo)})은 평균 자체가 높거나 시험이 쉬웠을 가능성이 있어 등급의 가치를 낮춰 해석함.`); }
  return { available: true, rows, summary: { n: rows.length, nA: A.length, coreARate, avgARate, scarce: scarce.length, common: common.length, easyA: easyA.length, hardRank: hardRank.length }, matrix, sentences };
}
