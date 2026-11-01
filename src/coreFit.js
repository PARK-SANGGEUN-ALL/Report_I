// 지원 학과의 «핵심과목·권장과목» 이수 충족률 — 2028학년도 권역별 대학별 권장과목(반영과목) 자료 기반.
// 2022 개정(고1·2)은 공식 제도이므로 충족률을 그대로 평가하고, 2015 개정(고3)은 제도가 없으므로 «관련 교과 이수 현황(참고)»으로만 쓴다.
import { UNIV_RECOMMENDED_2028 } from "./univRecommended.js";

const sp = s => String(s || "").replace(/\s+/g, "");
const nm = s => sp(s).replace(/Ⅱ/g, "2").replace(/Ⅰ/g, "1").replace(/Ⅲ/g, "3");
const GROUPS = ["국어", "수학", "영어", "사회", "과학", "정보", "제2외국어", "한문", "체육", "예술", "기술·가정", "교양"];
const FOREIGN = /일본어|중국어|독일어|프랑스어|스페인어|러시아어|아랍어|베트남어|한문|심화/;
// 2015 개정 과목 → 2022 개정 대응 과목(참고)
const MAP2015 = { "수학1": ["대수"], "수학2": ["미적분1"], "미적분": ["미적분2"], "확률과통계": ["확률과통계"], "기하": ["기하"], "물리학1": ["물리학"], "물리학2": ["역학과에너지", "전자기와양자"], "화학1": ["화학"], "화학2": ["물질과에너지", "화학반응의세계"], "생명과학1": ["생명과학"], "생명과학2": ["세포와물질대사", "생물의유전"], "지구과학1": ["지구과학"], "지구과학2": ["지구시스템과학", "행성우주과학"] };

function splitTop(s) { const out = []; let d = 0, cur = ""; for (const ch of String(s || "")) { if ("([（".includes(ch)) d++; if (")]）".includes(ch)) d = Math.max(0, d - 1); if ((ch === "," || ch === "\n" || ch === "，") && d === 0) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); }
/** 핵심/권장 문자열 → [{name,group,alts?}] ; 자유선택 안내문이면 free=true */
export function parseReq(str) {
  const items = []; let free = false; const s = String(str || "").trim();
  if (!s || s === "-") return { items, free: false, empty: true };
  splitTop(s).forEach(p => {
    p = p.replace(/^[-·•]\s*/, "").trim(); if (!p || p === "-") return;
    if (p.length > 22 && /선택|이수|자신|계열|상관|고려|관련/.test(p)) { free = true; return; }
    const m = p.match(/^([가-힣0-9·\s]+?)\s*[\(（](.+)[\)）]$/);
    if (m && GROUPS.includes(m[1].trim())) { const g = m[1].trim(); m[2].split(/[,，·]/).map(x => x.trim()).filter(Boolean).forEach(x => items.push({ name: x, group: g })); return; }
    if (p.includes("/")) { const alts = p.split("/").map(x => x.trim()).filter(Boolean); items.push({ name: alts.join(" / "), group: GROUPS.includes(alts[0]) ? alts[0] : "", alts }); return; }
    items.push({ name: p, group: GROUPS.includes(p) ? p : "", isGroup: GROUPS.includes(p) });
  });
  return { items, free: free && !items.length, empty: !items.length && !free };
}

const FAM = [["의약", /의예|의학|치의|한의|수의|약학|간호|보건|재활|영양|제약|의과/], ["교육", /교육|사범|교대/], ["경상", /경영|경제|회계|금융|무역|통상|상경|부동산/], ["공학", /공학|공과|컴퓨터|소프트웨어|인공지능|AI|반도체|건축|토목|기계|전기|전자|화공|신소재|IT|정보통신|데이터|정보대/i], ["사회", /정치|외교|행정|법학|법과|사회|심리|복지|미디어|언론|광고|커뮤니케이션|지리|정경/], ["자연", /수학|통계|물리|화학|지구|천문|생명|생물|자연|이과|이학|(?<!사회)과학|농|해양|환경/], ["인문", /국어|국문|영어|영문|중어|중국|일어|일본|독어|불어|사학|역사|철학|문화|문학|어문|인문|언어|사료|고고|한국학|문과/], ["예체능", /체육|스포츠|음악|미술|디자인|무용|연극|영화|예술/]];
const famOf = t => { const s = sp(t); for (const [f, re] of FAM) if (re.test(s)) return f; return ""; };
const mode = arr => { const c = {}; arr.forEach(x => c[x] = (c[x] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };

const stem = s => { let x = sp(s); for (let i = 0; i < 3; i++) x = x.replace(/(학과|학부|전공|단과대학|대학|계열|과)$/, ""); return x; };
const sameDept = (a, b) => { const x = stem(a), y = stem(b); if (!x || !y) return false; if (x === y) return true; const [s, l] = x.length <= y.length ? [x, y] : [y, x]; return s.length >= 2 && l.startsWith(s); };
export function pickRows(univ, dept) {
  let key = sp(univ); const base = key.replace(/[\(（].*?[\)）]/g, ""); const hasKey = k => Object.keys(UNIV_RECOMMENDED_2028).some(x => sp(x) === k || sp(x).startsWith(k)); if (!hasKey(key) && base && hasKey(base)) key = base;
  const keys = Object.keys(UNIV_RECOMMENDED_2028).filter(k => sp(k) === key).concat(Object.keys(UNIV_RECOMMENDED_2028).filter(k => sp(k) !== key && sp(k).startsWith(key)));
  const all = keys.flatMap(k => (UNIV_RECOMMENDED_2028[k] || []).map(r => ({ ...r, univ: k })));
  if (!all.length) return null; const d = sp(dept);
  let hit = all.filter(r => sp(r.dept) === d); let level = "학과 일치"; let famLabel = "";
  if (!hit.length) { hit = all.filter(r => sameDept(r.dept, dept)); if (hit.length) level = "유사 학과"; }
  if (!hit.length) { const fam = famOf(dept); if (fam) { hit = all.filter(r => famOf(r.dept + " " + (r.college || "")) === fam); level = "계열·단과대 기준"; famLabel = fam + "계열"; } }
  if (!hit.length) { if (famOf(dept)) return null; hit = all; level = "대학 공통"; }
  const m = mode(hit.map(r => (r.core || "") + "||" + (r.rec || ""))); const row = hit.find(r => ((r.core || "") + "||" + (r.rec || "")) === m) || hit[0];
  return { row, level, famLabel };
}

function studentSet(G, curr) {
  const is2022 = String(curr || G.curriculum || "").includes("2022") || G.is2022;
  const subs = [...(G.grades || []), ...(G.achievementSubjects || [])].filter(r => r && r.subject);
  const names = new Set(), byGroup = {}, label = {};
  subs.forEach(r => { const n = nm(r.subject); names.add(n); label[n] = r.subject; const g = r.group || ""; (byGroup[g] = byGroup[g] || new Set()).add(n);
    if (FOREIGN.test(r.subject)) (byGroup["제2외국어"] = byGroup["제2외국어"] || new Set()).add(n); if (/^정보|인공지능기초|데이터과학|소프트웨어/.test(nm(r.subject))) (byGroup["정보"] = byGroup["정보"] || new Set()).add(n);
    if (!is2022 && MAP2015[n]) MAP2015[n].forEach(t => { names.add("§" + t); label["§" + t] = r.subject; }); });
  return { names, byGroup, label, is2022 };
}
function evalItems(items, S) {
  return items.map(it => {
    if (it.alts) { const hit = it.alts.find(a => S.names.has(nm(a)) || (S.byGroup[a] && S.byGroup[a].size) || (nm(a) === "한문" && S.byGroup["한문"])); return { ...it, status: hit ? "ok" : "no", via: hit || "" }; }
    if (it.isGroup) { const n = (S.byGroup[it.name] || new Set()).size; return { ...it, status: n ? "ok" : "no", via: n ? `${n}과목 이수` : "" }; }
    const t = nm(it.name);
    if (S.names.has(t)) return { ...it, status: "ok", via: S.label[t] };
    if (!S.is2022 && S.names.has("§" + t)) return { ...it, status: "alt", via: `${S.label["§" + t]}(2015) 대응` };
    return { ...it, status: "no", via: "" };
  });
}
const rateOf = list => list.length ? Math.round(list.filter(x => x.status !== "no").length / list.length * 100) : null;

/** G: {grades, achievementSubjects, curriculum} / targets: [{u,d}] */
export function computeCoreFit(G, targets, curr) {
  const S = studentSet(G, curr);
  return (targets || []).filter(t => t.u && t.d).map(t => {
    const pr = pickRows(t.u, t.d); if (!pr) return { univ: t.u, dept: t.d, found: false, is2022: S.is2022, why: "해당 대학이 이 학과(계열)의 권장과목을 제시하지 않았거나 자료에 없음" };
    const core = parseReq(pr.row.core), rec = parseReq(pr.row.rec);
    const cI = evalItems(core.items, S), rI = evalItems(rec.items, S);
    const by = {}; [...cI.map(x => ({ ...x, kind: "핵심" })), ...rI.map(x => ({ ...x, kind: "권장" }))].forEach(x => { const g = x.group || "기타"; (by[g] = by[g] || []).push(x); });
    return { univ: t.u, dept: t.d, found: true, is2022: S.is2022, level: pr.level, basis: pr.level === "대학 공통" ? `${pr.row.univ} 전체 공통 기준` : pr.level === "계열·단과대 기준" ? `${pr.famLabel} 공통(${pr.row.univ} 모집단위 기준)` : [pr.row.college, pr.row.dept].filter(Boolean).join(" · "), univKey: pr.row.univ,
      core: { items: cI, rate: rateOf(cI), free: core.free, empty: core.empty }, rec: { items: rI, rate: rateOf(rI), free: rec.free, empty: rec.empty }, byGroup: by, note: pr.row.note || "" };
  });
}
/** 프롬프트용 요약 */
export function coreFitText(list, curr) {
  const is2022 = String(curr || "").includes("2022"); if (!list?.length) return "";
  const L = ["【📚 핵심·권장과목 이수 충족 현황 (코드 산정, 2028 권역별 대학별 권장과목 자료 기준) — 진로역량·희망학과 분석의 근거로 사용】"];
  L.push(is2022 ? "- 이 학생은 2022 개정(공식 권장과목 제도 적용). 핵심과목 충족률이 낮으면 진로역량과 전공 적합성 평가에서 감점 근거로 삼을 것." : "- 이 학생은 2015 개정(공식 권장과목 제도 없음). 아래는 «관련 교과 이수 현황» 참고용이며 미이수를 감점 근거로 쓰지 말고, 이수했다면 '관련 교과를 충실히 이수'로 긍정 평가할 것.");
  list.forEach(f => { if (!f.found) { L.push(`- ${f.univ} ${f.dept}: 권장과목 자료 없음`); return; }
    const fmt = x => `${x.name}${x.status === "ok" ? "✓" : x.status === "alt" ? "△" : "✗"}`;
    L.push(`- ${f.univ} ${f.dept} (기준: ${f.basis}, ${f.level}) / 핵심 ${f.core.rate == null ? (f.core.free ? "지정 없음(자유 선택)" : "-") : f.core.rate + "%"}: ${f.core.items.map(fmt).join(", ") || "-"} / 권장 ${f.rec.rate == null ? "-" : f.rec.rate + "%"}: ${f.rec.items.map(fmt).join(", ") || "-"}`); });
  return L.join("\n");
}
export function coreFitSentences(f, ongoing = true) {
  if (!f?.found) return ["해당 대학의 권장과목 자료를 찾지 못함."]; const out = [];
  const c = f.core, r = f.rec; const ok = x => x.filter(i => i.status !== "no").map(i => i.name), no = x => x.filter(i => i.status === "no").map(i => i.name);
  if (c.items.length) { out.push(`핵심과목 ${c.items.length}개 중 ${ok(c.items).length}개를 이수함(충족률 ${c.rate}%).`); if (no(c.items).length) out.push(`미이수 핵심과목은 ${no(c.items).join(", ")}임.`); else out.push("핵심과목을 모두 이수함."); }
  else out.push(c.free ? "핵심과목을 따로 지정하지 않고 진로·적성에 맞게 선택하도록 안내함." : "핵심과목이 지정되어 있지 않음.");
  if (r.items.length) { out.push(`권장과목은 ${r.items.length}개 중 ${ok(r.items).length}개를 이수함(${r.rate}%).`); if (no(r.items).length) out.push(`미이수 권장과목은 ${no(r.items).join(", ")}임.`); }
  if (f.is2022) { if (c.rate != null) out.push(c.rate >= 90 ? "핵심과목 이수가 진로역량의 근거로 안정적으로 작용함." : c.rate >= 70 ? "핵심과목 이수는 대체로 충족하나 미이수 과목의 보완이 필요함." : "핵심과목 충족률이 낮아 진로역량·전공 적합성 평가에서 불리하게 작용함."); if (ongoing && c.rate != null && c.rate < 100) out.push("미이수 과목 중 남은 학기에 개설·이수 가능한 과목은 학교 교육과정에서 확인이 필요함."); }
  else out.push("2015 개정은 대학 공식 권장과목 제도가 없으므로 관련 교과의 폭넓은 이수 여부를 참고 지표로만 활용함.");
  return out;
}
