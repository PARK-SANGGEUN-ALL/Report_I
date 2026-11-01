// 실제 2028 전형 현황·학과별 입결(경쟁률·충원율)을 Phase5 프롬프트용 텍스트로 만든다. (분석 시점에만 lazy import)
// 출처: 전진협 2028 수시전형분석, 경북진학지원단 2028 시행계획 변경사항, 서울 고1·2 진학탐색기(2023~2026 입결)
import PLAN from "./data/plan2028.json";
import DEPT from "./data/deptAdmit.json";
import { UNIV_TIERS } from "./prediction2028.js";

const ws = s => String(s || "").replace(/\s+/g, " ").trim();
const keysOf = (map, name) => {
  const n = ws(name); if (!n) return [];
  const ks = Object.keys(map);
  let r = ks.filter(k => k === n);
  if (!r.length) r = ks.filter(k => k.startsWith(n + "("));
  if (!r.length) r = ks.filter(k => k.startsWith(n));
  return r;
};
const med = a => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const f = (x, d = 2) => x == null ? "-" : Number(x).toFixed(d);

function planDetail(name) {
  const out = [];
  keysOf(PLAN.plan, name).slice(0, 3).forEach(k => {
    const u = PLAN.plan[k];
    out.push(`[${k}] 총 ${u.cap || "?"}명`);
    u.rows.slice(0, 14).forEach(r => out.push(`  - ${r[0]}·${r[1]} ${r[2] || "?"}명 | ${r[3] || "평가방식 미확인"} | 수능최저: ${r[4] || "없음/미확인"} | ${[r[5], r[6] && "추천 " + r[6]].filter(Boolean).join(" ")}`));
  });
  return out;
}
function planBrief(name) {
  const k = keysOf(PLAN.plan, name)[0]; if (!k) return null;
  const by = {};
  PLAN.plan[k].rows.forEach(r => {
    const flag = (/면접/.test(r[3]) ? "🎤" : "") + (r[4] && !/없음|^-$/.test(r[4]) ? "최저" : "");
    (by[r[0]] = by[r[0]] || []).push(`${r[1].replace(/학생부|전형/g, "").replace(/[()]/g, " ").trim() || r[1]}${flag ? "(" + flag + ")" : ""}`);
  });
  return `${k}: ` + Object.entries(by).map(([g, v]) => `${g}[${[...new Set(v)].slice(0, 5).join("·")}]`).join(" ");
}
function deptLines(univ, dept) {
  const d = ws(dept).replace(/\s/g, ""); const ks = new Set(keysOf(Object.fromEntries(DEPT.map(r => [r[0], 1])), univ));
  const rows = DEPT.filter(r => ks.has(r[0]) && (r[3].replace(/\s/g, "").includes(d) || d.includes(r[3].replace(/\s/g, "")) || (d.length > 2 && r[3].includes(d.slice(0, 3)))));
  if (!rows.length) return [`${univ} ${dept}: 개별 학과 입결 미확인(학과명 불일치) — 계열 평균과 학과 편차 주의로 판단`];
  rows.sort((a, b) => (a[1] === b[1] ? 0 : a[1] === "종" ? -1 : 1));
  return rows.slice(0, 7).map(r => `${r[0]} ${r[3]} ${r[1] === "종" ? "종합" : r[1] === "교" ? "교과" : "논술"}·${r[2]} | ` +
    r[5].slice().reverse().map(y => `${y[0]}학년도 70%컷 ${f(y[1])}/50%컷 ${f(y[2])}/모집 ${y[3] ?? "-"}/경쟁률 ${f(y[4], 1)}/충원율 ${y[5] != null ? Math.round(y[5]) + "%" : "-"}`).join(" ; "));
}
function univStat(name) {
  const ks = new Set(keysOf(Object.fromEntries(DEPT.map(r => [r[0], 1])), name)); if (!ks.size) return null;
  const parts = [];
  [["종", "종합"], ["교", "교과"]].forEach(([t, lab]) => {
    const rs = DEPT.filter(r => ks.has(r[0]) && r[1] === t); if (rs.length < 3) return;
    const last = rs.map(r => r[5][r[5].length - 1]).filter(Boolean);
    const yr = Math.max(...last.map(y => y[0])); const cur = last.filter(y => y[0] === yr);
    parts.push(`${lab} 70%컷 중위 ${f(med(cur.map(y => y[1])))} · 경쟁률 중위 ${f(med(cur.map(y => y[4])), 1)} · 충원율 중위 ${Math.round(med(cur.map(y => y[5])) ?? 0)}%`);
  });
  return parts.length ? `${name}: ${parts.join(" / ")}` : null;
}

export function buildExtra({ targets = [], is2022 = false } = {}) {
  const tierNames = [...new Set(UNIV_TIERS.filter(t => !/교대/.test(t.tier)).flatMap(t => t.univs.map(u => u.name)))];
  const L = [];
  L.push("【🆕 실제 2028 전형 현황 · 학과별 입결 데이터 (업로드 자료 기반) — finalRecommendation·deptReports·tierAnalysis의 근거로 사용】");
  L.push("- admissionType·전형추천에는 아래 «전형 목록»에 실제 존재하는 전형명만 쓸 것. 목록에 없는 대학은 전형명을 지어내지 말고 '전형 확인 필요'라고 쓸 것.");
  L.push("- 🎤=면접 포함, 최저=수능최저 있음, 지원자격(재학만·졸업생 가능)·학교별 추천인원 제한을 반드시 반영해 지원 가능 여부부터 점검할 것.");
  L.push("- 충원율이 높은 학과는 최초 합격선보다 실질 합격선이 낮아질 수 있고, 경쟁률·충원율은 해마다 크게 변하므로 단정하지 말 것. 입결 수치에는 특목·자사고 지원자가 섞여 있음.");
  const tg = targets.filter(t => t.u);
  if (tg.length) {
    L.push("\n[희망 대학 — 전형 상세]");
    [...new Set(tg.map(t => t.u))].forEach(u => { const d = planDetail(u); L.push(...(d.length ? d : [`${u}: 전형 자료 미확인`])); });
    L.push("\n[희망 학과 — 실제 입결(최근 2개년, 대학어디가·진학탐색기)]");
    tg.forEach(t => L.push(...deptLines(t.u, t.d)));
    if (is2022) {
      L.push("\n[희망 대학 — 2028학년도 변경사항(고1·2 해당)]");
      [...new Set(tg.map(t => t.u))].forEach(u => {
        const nk = keysOf(PLAN.chg, u)[0], kk = keysOf(PLAN.key, u)[0];
        if (nk) L.push(`${u}: ${PLAN.chg[nk].slice(0, 700)}`);
        if (kk) L.push(`${u} 핵심변경: ${PLAN.key[kk].key.join(" / ")}`);
      });
    }
  }
  L.push("\n[주요 대학 전형 목록(전형명·면접·최저)]");
  tierNames.forEach(n => { const b = planBrief(n); if (b) L.push(b); });
  L.push("\n[주요 대학 최근 입결 지표(70%컷 중위·경쟁률·충원율, 학과 평균)]");
  tierNames.forEach(n => { const s = univStat(n); if (s) L.push(s); });
  return L.join("\n");
}
