// 정량 채점 — 학업역량(40)·탐구역량(25)의 «기본점수»를 코드가 계산한다. AI는 ±3점 범위에서만 보정한다.
// 같은 학생부는 항상 같은 기본점수가 나오며, 모든 가감 항목이 화면에 표로 공개된다.
import { convert5To9 } from "./prediction2028.js";

const lvN = n => parseInt(n) || 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CORE = ["국어", "수학", "영어", "사회", "과학"];
const wavg = list => { const f = list.filter(r => r.lv > 0); const w = f.reduce((a, r) => a + r.w, 0); return w ? f.reduce((a, r) => a + r.lv * r.w, 0) / w : null; };
const relGroups = (m) => { m = String(m || ""); if (/공학|컴퓨터|전기|전자|기계|화공|신소재|반도체|건축|토목|산업|의학|약학|간호|생명|수학|물리|화학|지구|통계/.test(m)) return ["수학", "과학"]; if (/경영|경제|회계|금융/.test(m)) return ["수학", "사회", "영어"]; if (/영어|외국어|영문/.test(m)) return ["영어", "국어"]; return ["국어", "사회", "영어"]; };

export const ACADEMIC_TABLE = [[1.2, 37, "S"], [1.5, 34, "A"], [1.8, 32, "A"], [2.2, 29, "B"], [2.6, 26, "B"], [3.0, 23, "B"], [3.5, 20, "C"], [4.0, 17, "C"], [4.5, 14, "C"], [5.5, 10, "D"], [99, 6, "D"]];
const letter = (score, max) => { const r = score / max; return r >= 0.9 ? "S" : r >= 0.75 ? "A" : r >= 0.55 ? "B" : r >= 0.35 ? "C" : "D"; };

/* 정규분포 추정 상위 % (원점수·평균·표준편차) */
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
const topPct = (raw, avg, sd) => { raw = parseFloat(raw); avg = parseFloat(avg); sd = parseFloat(sd); if (!(sd > 0) || isNaN(raw) || isNaN(avg)) return null; return clamp((1 - 0.5 * (1 + erf((raw - avg) / sd / Math.SQRT2))) * 100, 0.5, 99); };

export function quantAcademic(G, major) {
  const is2022 = (G.curriculum || "").includes("2022") || G.is2022;
  const rows = (G.grades || []).map(r => ({ ...r, lv: lvN(r.level), g: +r.gN || parseInt(r.grade) || 0, s: +r.sN || parseInt(r.semester) || 0, w: parseFloat(r.credit) || 1 })).filter(r => r.lv > 0);
  const core = rows.filter(r => CORE.includes(r.group)); if (core.length < 3) return null;
  const avgRaw = wavg(core); const avg9 = is2022 ? convert5To9(avgRaw) : avgRaw;
  const hit = ACADEMIC_TABLE.find(x => avg9 <= x[0]); const out = [{ label: `국영수사과 학점가중 평균 ${avgRaw.toFixed(2)}${is2022 ? "(5등급제) → 9등급 환산 " + avg9.toFixed(2) : "등급"}`, pts: hit[1], note: "기본점수(구간표)" }];
  let adj = 0; const add = (label, p) => { if (p) { out.push({ label, pts: p }); adj += p; } };
  const rg = relGroups(major || G.studentType); const rel = rows.filter(r => rg.includes(r.group)); const relAvg = wavg(rel);
  if (relAvg != null) { const d = avgRaw - relAvg; if (d >= 0.6) add(`전공 관련 교과(${rg.join("·")}) 평균 ${relAvg.toFixed(2)}가 전체보다 우수`, 2); else if (d >= 0.3) add(`전공 관련 교과 평균 ${relAvg.toFixed(2)}가 전체보다 우수`, 1); else if (d <= -0.6) add(`전공 관련 교과 평균 ${relAvg.toFixed(2)}가 전체보다 뚜렷이 열세`, -2); else if (d <= -0.3) add(`전공 관련 교과 평균 ${relAvg.toFixed(2)}가 전체보다 열세`, -1); }
  const keys = [...new Set(core.map(r => `${r.g}-${r.s}`))].sort(); if (keys.length >= 2) { const f = wavg(core.filter(r => `${r.g}-${r.s}` === keys[0])), l = wavg(core.filter(r => `${r.g}-${r.s}` === keys[keys.length - 1])); const d = l - f;
    if (d <= -0.3) add(`학기 추세 상승(${f.toFixed(2)}→${l.toFixed(2)})`, d <= -0.7 ? 2 : 1); else if (d >= 0.7) add(`학기 추세 하락(${f.toFixed(2)}→${l.toFixed(2)})`, -2); else if (d >= 0.3) add(`학기 추세 하락(${f.toFixed(2)}→${l.toFixed(2)})`, -1); }
  const lv = core.map(r => r.lv); const m = lv.reduce((a, b) => a + b, 0) / lv.length; const sd = Math.sqrt(lv.reduce((a, b) => a + (b - m) ** 2, 0) / lv.length);
  if (sd > 1.8) add(`과목 간 편차 큼(표준편차 ${sd.toFixed(2)})`, -2); else if (sd > 1.2) add(`과목 간 편차 있음(표준편차 ${sd.toFixed(2)})`, -1);
  const pos = !is2022 ? rows.map(r => topPct(r.rawScore, r.avg, r.sd)).filter(p => p != null) : [];
  if (pos.length >= 4) { const pa = pos.reduce((a, b) => a + b, 0) / pos.length; const gradeByPct = p => p <= 4 ? 1 : p <= 11 ? 2 : p <= 23 ? 3 : p <= 40 ? 4 : p <= 60 ? 5 : p <= 77 ? 6 : p <= 89 ? 7 : p <= 96 ? 8 : 9; if (gradeByPct(pa) < Math.round(avgRaw)) add(`원점수 기준 실제 위치가 등급보다 우수(평균 상위 ${pa.toFixed(1)}%)`, 1); }
  const base = clamp(Math.round(hit[1] + adj), 0, 40);
  return { key: "academic", max: 40, base, lo: clamp(base - 3, 0, 40), hi: clamp(base + 3, 0, 40), rows: out, caps: [] };
}

export function quantInquiry(G) {
  const acts = (G.activities || []).map(a => ({ ...a, d: clamp(parseInt(a.depth) || 1, 1, 4), g: +a.gN || parseInt(a.year) || 1, s: (+a.sN || parseInt(a.semester) || 1) === 2 ? 2 : 1 }));
  if (acts.length < 3) return null;
  const rows = [{ label: "기본점수", pts: 6, note: "기록이 있는 학생부 기준" }]; let sum = 6; const add = (label, p, note) => { rows.push({ label, pts: p, note }); sum += p; };
  const n3 = acts.filter(a => a.d >= 3).length, n4 = acts.filter(a => a.d >= 4).length;
  add(`직접 자료를 만든 탐구(3단계 이상) ${n3}건`, Math.min(6, n3), "건당 +1, 최대 +6");
  if (n4) add(`한계·개선·후속까지 간 탐구(4단계) ${n4}건`, Math.min(3, n4 * 1.5), "건당 +1.5, 최대 +3");
  const fitN = acts.filter(a => a.levelFit === "적정" && (a.level === "심화" || a.level === "전공")).length; const hasLevel = acts.some(a => a.levelFit);
  if (hasLevel) add(`학과군 적정 수준(교과 심화 이상)에 부합하는 탐구 ${fitN}건`, Math.min(4, fitN * 0.8), "건당 +0.8, 최대 +4");
  const th = (G.inquiryThreads || []).filter(t => (t.steps || []).length >= 2); const rising = th.filter(t => { const d = (t.steps || []).map(s => +s.depth || 1); return d[d.length - 1] > d[0]; }).length;
  add(`2학기 이상 이어진 탐구 줄기 ${th.length}개(깊이 상승 ${rising}개)`, Math.min(5, th.length * 2 + rising * 0.5), "줄기당 +2, 상승 +0.5, 최대 +5");
  const decl = th.filter(t => { const d = (t.steps || []).map(s => +s.depth || 1); return d.length >= 2 && d[d.length - 1] < d[d.length - 2]; }).length; if (decl) add(`줄기의 마지막 단계 깊이가 앞 단계보다 낮아짐 ${decl}개`, -Math.min(3, decl), "개당 −1, 최대 −3");
  const rep = acts.filter(a => a.linkType === "반복").length; if (rep >= 2) add(`새 방법 없이 되풀이된 기록 ${rep}건`, -1, "−1");
  const over = acts.filter(a => a.levelFit === "과잉").length; if (over >= 2) add(`전공 용어 나열·직접 설명 근거 부족(수준 과잉) ${over}건`, -2, "−2");
  const under = acts.filter(a => a.levelFit === "과소").length; if (hasLevel && under >= Math.ceil(acts.length * 0.6)) add(`교과 기본·기사 수준(과소) 기록이 60% 이상(${under}건)`, -2, "−2");
  const gKeys = [...new Set((G.grades || []).map(r => `${+r.gN || parseInt(r.grade)}-${+r.sN || parseInt(r.semester)}`))]; const have = new Set(acts.map(a => `${a.g}-${a.s}`)); const empty = gKeys.filter(k => !have.has(k)).length;
  if (empty) add(`성적은 있는데 탐구 기록이 없는 학기 ${empty}개`, -Math.min(3, empty), "학기당 −1, 최대 −3");
  let score = clamp(Math.round(sum), 0, 25); const caps = [];
  const deep = acts.filter(a => a.d >= 3); const subjN = new Set(deep.map(a => a.subjectName || a.subject)).size, semN = new Set(deep.map(a => `${a.g}-${a.s}`)).size;
  if (!(subjN >= 2 && semN >= 2) && score > 17) { score = 17; caps.push(`3단계 이상 탐구가 서로 다른 교과 2개·학기 2개에 걸쳐 확인되지 않아 17점 상한(현재 교과 ${subjN}개·학기 ${semN}개)`); }
  return { key: "inquiry", max: 25, base: score, lo: clamp(score - 3, 0, 25), hi: clamp(score + 3, 0, 25), rows, caps };
}

/** AI가 매긴 학업·탐구 점수를 정량 기본점수 ±3 범위로 보정하고 근거표를 붙인다. 총점도 다시 합산한다. */
export function applyQuant(G, major) {
  const C = G.competencies; if (!C) return G;
  [quantAcademic(G, major), quantInquiry(G)].forEach(q => {
    if (!q || !C[q.key]) return; const c = C[q.key]; const ai = Number(c.score) || q.base; const fin = clamp(Math.round(ai), q.lo, q.hi);
    c.quant = { ...q, ai, final: fin }; c.score = fin; c.max = q.max; c.grade = letter(fin, q.max);
  });
  const sum = Object.values(C).reduce((s, c) => s + (Number(c?.score) || 0), 0); if (sum > 0) G.totalScore = Math.round(sum);
  return G;
}

/** 화면용 수준 판정 기준표 (점수가 아니라 대학 그룹 수준 기준) */
export const RUBRIC_TABLE = [
  { name: "학업역량", key: "academic", how: "국영수사과 학점가중 평균등급을 기준으로 전공 관련 교과·학기 추세·과목 편차·원점수 위치를 가감해 코드가 기본 수준을 정하고, AI는 한 단계 안에서만 보정", bands: [["최상위권", "평균 약 1.3등급 이내, 편차·하락 없음"], ["상위권", "약 1.3~1.9등급, 전공 관련 교과 우수"], ["중상위권", "약 1.9~2.7등급"], ["중위권", "약 2.7~3.6등급"], ["거점국립대·중하위권", "약 3.6~4.6등급"], ["기초 보완 단계", "약 4.6등급 초과"]] },
  { name: "탐구역량", key: "inquiry", how: "탐구 깊이(3·4단계) 기록 수, 학과군 적정 수준 부합, 2학기 이상 이어진 줄기, 마지막 단계 하락·반복·수준 과잉·빈 학기를 코드가 세어 기본 수준을 정하고 AI는 한 단계 안에서만 보정", bands: [["최상위·상위권", "서로 다른 교과 2개·학기 2개 이상에서 깊이 3단계+가 반복되고 수준이 적정"], ["중상위권", "2개 교과·2개 학기의 일관된 탐구"], ["중위권", "단발 사례, 발표·독서 나열, 교과 기본 수준 위주"], ["그 이하", "탐구 기록 부족"]] },
  { name: "진로역량", key: "career", how: "AI 판단(원문 근거) — 상한 규칙 적용", bands: [["상위권 이상", "이수과목 적합성+세특 깊이+3개 학년 일관성이 자율·동아리·진로 중 2개 영역 이상에서 확인"], ["중상위~중위권", "한 영역에서만 일관"], ["중위권 이하", "3학년에만 갑자기 진로 연관(뒤늦은 끼워맞추기)"]] },
  { name: "공동체역량", key: "community", how: "AI 판단 — 상한 규칙 적용", bands: [["상위권 이상", "선출직 리더십 또는 지속 협업·봉사가 2개 학기 이상 구체 근거로 확인"], ["중위권", "학급 구성원 수준·일회성 활동만"]] },
  { name: "성장역량", key: "growth", how: "AI 판단 — 상한 규칙 적용", bands: [["상위권 이상", "성적·활동 모두 2개 학기 이상 비교해 상승"], ["중위권", "둘 중 하나만 개선·나머지 정체/하락"]] },
];

/* ── 점수 대신 «어느 대학 그룹 수준인지»로 표현 ── */
export const TIER_STEPS = [
  { k: "최상위권", short: "최상위", ex: "서울대·연세대·고려대·KAIST 등", min: 0.90 },
  { k: "상위권", short: "상위", ex: "성균관·서강·한양·중앙·경희·한국외·서울시립·이화", min: 0.78 },
  { k: "중상위권", short: "중상위", ex: "건국·동국·홍익·국민·숭실·세종·단국·서울과기", min: 0.64 },
  { k: "중위권", short: "중위", ex: "광운·명지·상명·가천·인하·아주·경기", min: 0.50 },
  { k: "거점국립대·중하위권", short: "거점·중하위", ex: "부산·경북·전남·충남 등 지역 거점국립대", min: 0.36 },
  { k: "기초 보완 단계", short: "기초 보완", ex: "기초 학업·탐구 보완이 우선", min: 0 },
];
export function tierOf(score, max) {
  const r = Math.max(0, (Number(score) || 0) / max); let idx = TIER_STEPS.findIndex(t => r >= t.min); if (idx < 0) idx = TIER_STEPS.length - 1;
  const band = TIER_STEPS[idx]; const upper = idx === 0 ? 1 : TIER_STEPS[idx - 1].min; const pos = (r - band.min) / (upper - band.min);
  const sub = idx === TIER_STEPS.length - 1 ? "" : pos >= 0.67 ? "상단" : pos >= 0.34 ? "중단" : "하단";
  return { idx, tier: band.k, short: band.short, ex: band.ex, sub, label: `${band.k}${sub ? " " + sub : ""}`, shortLabel: `${band.short}${sub ? " " + sub : ""}` };
}
export const fitWord = s => (s >= 85 ? "매우 높음" : s >= 72 ? "높음" : s >= 60 ? "보통" : "낮음");
