import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { rich, firstSentence, getMajorRelatedGroups, lvN, verdictTone, Depth } from "./util.jsx";
import { compareAllUnivs, convert5To9 } from "../prediction2028.js";
import { PositionMap, TierLadder, Ring, GradeBand, DepthMatrix, LevelBars, GroupBars } from "./charts.jsx";
import { COMP_RUBRIC, OVERALL_TABLE, TIER_STEPS, tierOf, fitWord } from "../scoring.js";
import { connectionMetrics, buildLinks } from "../connections.js";
import { coreFitSentences } from "../coreFit.js";

const TABS = ["성적·이수 분석", "탐구 계보를 통한 추천학과", "역량 분석", "희망학과·대학 유불리", "종합 리포트"];
const COMP = [["academic", "학업역량"], ["inquiry", "탐구역량"], ["career", "진로역량"], ["community", "공동체역량"], ["growth", "성장역량"]];
const MAXES = { academic: 40, inquiry: 25, career: 15, community: 10, growth: 10 };
const GROUPS = ["국어", "수학", "영어", "사회", "과학"];
const LVL = { 기본: "교과 기본", 심화: "교과 심화", 전공: "대학 전공" };
const LCOL = { 심화: "#2e4fb8", 확장: "#c98600", 전환: "#0b7a6a", 반복: "#b92f43" };

const Sec = ({ n, title, children }) => (<section className="rp-sec"><h3><span>{n}</span>{title}</h3>{children}</section>);
const P = ({ t }) => !t ? null : <>{String(t).split(/\n{2,}/).map((x, i) => <p className="rp-p" key={i}>{rich(x.replace(/\n/g, " "))}</p>)}</>;
const Sum = ({ items }) => (<div className="rp-sum"><h4>핵심 요약</h4><ul>{items.filter(Boolean).slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</ul></div>);
const Fig = ({ no, cap, children }) => (<figure className="fig">{children}<figcaption>그림 {no}. {cap}</figcaption></figure>);
const Lv = ({ v }) => { const n = Math.round(v || 0); return <span className={`lv lv${Math.min(Math.max(n, 0), 9)}`}>{v ? (Number.isInteger(v) ? v : v.toFixed(1)) : "·"}</span>; };
const LvlTag = ({ a }) => a.level ? <span className="tag">{LVL[a.level] || a.level}{a.levelFit && a.levelFit !== "판단불가" ? ` · ${a.levelFit}` : ""}</span> : null;
const Doc = ({ no, title, lead, name, G, children }) => (<article className="sheet">
  <div className="rp-meta"><span>REPORT·I · 학생부 정밀 진단 보고서</span><span>{name}{G.schoolName ? ` · ${G.schoolName}` : ""} · {new Date().toLocaleDateString("ko-KR")}</span></div>
  <div className="rp-chap">제 {no} 장</div><h1 className="rp-title">{title}</h1>{lead && <div className="rp-lead">{lead}</div>}{children}
  <div className="rp-foot">본 보고서는 학생부 기록과 공개 입시 자료를 바탕으로 한 참고용 진단이며, 실제 합격 여부는 대학별 평가와 면접 등에 따라 달라질 수 있습니다.</div></article>);
const tierOfG = (G, k) => (G._tiers && G._tiers[k]) || tierOf(G.competencies?.[k]?.score, MAXES[k] || 100);
const ns = s => String(s || "").replace(/\(?\s*\d+(?:\.\d+)?\s*\/\s*\d+\s*\)?/g, "").replace(/\d+(?:\.\d+)?\s*점(?![수])/g, "").replace(/\s{2,}/g, " ").trim();
const probTxt = p => p && p.min != null ? `${p.min}~${p.max}%` : "-";
const s9Of = (G, is2022) => { const g = parseFloat(G.gradeAvg); return isNaN(g) ? null : (is2022 ? convert5To9(g) : g); };

/* ───────── 1. 성적·이수 분석 ───────── */
function GradesTab({ G, name, major }) {
  const is2022 = (G.curriculum || "").includes("2022") || G.is2022; const maxLv = is2022 ? 5 : 9; let sn = 0; const nx = () => `1.${++sn}`;
  const grades = useMemo(() => (G.grades || []).map(r => ({ ...r, lv: lvN(r.level), g: +r.gN || parseInt(r.grade) || 0, s: +r.sN || parseInt(r.semester) || 0, w: parseFloat(r.credit) || 1 })), [G]);
  const keys = [...new Set(grades.filter(r => r.g && r.s).map(r => `${r.g}-${r.s}`))].sort();
  const avg = list => { const f = list.filter(r => r.lv > 0); const w = f.reduce((a, r) => a + r.w, 0); return w ? f.reduce((a, r) => a + r.lv * r.w, 0) / w : null; };
  const cell = (grp, k) => avg(grades.filter(r => r.group === grp && `${r.g}-${r.s}` === k));
  const core = k => avg(grades.filter(r => GROUPS.includes(r.group) && `${r.g}-${r.s}` === k)); const all = k => avg(grades.filter(r => `${r.g}-${r.s}` === k));
  const coreAll = avg(grades.filter(r => GROUPS.includes(r.group))); const rg = getMajorRelatedGroups(major || G.studentType); const relAll = avg(grades.filter(r => rg.includes(r.group)));
  const top = grades.filter(r => r.lv > 0 && r.lv <= (is2022 ? 1 : 2)).length;
  const series = keys.map(k => core(k)); const first = series.find(v => v != null), last = [...series].reverse().find(v => v != null); const diff = (first != null && last != null) ? last - first : 0;
  const trend = first == null ? "-" : Math.abs(diff) < 0.25 ? "안정 유지형" : diff < 0 ? "상승형" : "하락형";
  const W = 640, H = 220, px = 40, py = 34; const X = i => keys.length < 2 ? W / 2 : px + 24 + i * ((W - px - 76) / (keys.length - 1)); const Y = v => py + ((v - 1) / (maxLv - 1)) * (H - py * 2);
  const pts = series.map((v, i) => v != null ? [X(i), Y(v), v] : null).filter(Boolean);
  const ach = G.achievementSubjects || []; const gOf = r => GROUPS.includes(r.group) ? r.group : "기타"; const cr = G.creditStatus; const CF = G._coreFit || []; const A2 = G._ach2022;
  const s9 = s9Of(G, is2022);
  return (<Doc no="1" title="성적·이수 분석" lead={`${G.stageLabel || ""} · ${is2022 ? "2022 개정(5등급제)" : "2015 개정(9등급제)"}`} name={name} G={G}>
    <Sum items={[<>전체 평균등급은 <b>{G.gradeAvg || "-"}</b>{is2022 && s9 ? <>(9등급제 환산 약 <b>{s9.toFixed(2)}</b>)</> : null}, 국영수사과 학점가중 평균은 <b>{coreAll ? coreAll.toFixed(2) : "-"}</b>, 성적 추이는 <b>{trend}</b>{first != null && last != null ? `(${first.toFixed(2)} → ${last.toFixed(2)})` : ""}임.</>,
      relAll != null && coreAll != null ? <>전공 관련 교과({rg.join("·")}) 평균은 <b>{relAll.toFixed(2)}</b>로 전체 대비 {relAll < coreAll - 0.2 ? "우수" : relAll > coreAll + 0.2 ? "열세" : "비슷"}한 수준임.</> : null,
      A2?.available ? <>성취도 A는 {A2.summary.nA}개이며 받은 A의 평균 분포비율은 {A2.summary.avgARate != null ? A2.summary.avgARate + "%" : "-"}로, 성취도의 변별력은 {A2.summary.avgARate == null ? "확인 불가" : A2.summary.avgARate <= 25 ? "높음" : A2.summary.avgARate <= 40 ? "보통" : "낮음"}임.</> : null,
      CF[0]?.found && CF[0].core.rate != null ? <>1순위 희망 <b>{CF[0].univ} {CF[0].dept}</b>의 핵심과목 이수 충족률은 <b>{CF[0].core.rate}%</b>{CF[0].is2022 ? "임." : "임(2015 개정 참고 지표)."}</> : null,
      G.gradeAnalysis?.overall ? rich(firstSentence(G.gradeAnalysis.overall, 110)) : null]} />
    <Sec n={nx()} title="학기별 성적 추이와 교과군 균형">
      {keys.length ? <div className="grid split"><Fig no="1" cap="국영수사과 학기별 평균등급(위로 갈수록 우수)"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {Array.from({ length: maxLv }, (_, i) => i + 1).map(v => <g key={v}><line x1={px} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="#d5dae6" /><text x={px - 8} y={Y(v) + 5} fontSize="14" fill="#51607e" textAnchor="end">{v}</text></g>)}
        {keys.map((k, i) => <text key={k} x={X(i)} y={H - 6} fontSize="14" fill="#16203a" textAnchor="middle" fontWeight="800">{k.replace("-", "·") + "학기"}</text>)}
        <polyline fill="none" stroke="#2b3550" strokeWidth="3" strokeLinejoin="round" points={pts.map(p => p[0] + "," + p[1]).join(" ")} />
        {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="6.5" fill="#fff" stroke="#2b3550" strokeWidth="3" /><text x={p[0]} y={p[1] - 13} fontSize="15" fontWeight="900" fill="#16203a" textAnchor="middle">{p[2].toFixed(2)}</text></g>)}</svg></Fig>
        <Fig no="2" cap="교과군별 평균등급(막대가 짧을수록 우수, 점선은 국영수사과 평균)"><GroupBars rows={GROUPS.map(g => ({ label: g, v: avg(grades.filter(r => r.group === g)) }))} max={maxLv} overall={coreAll} /></Fig></div> : <div className="rp-empty">학기별 성적 데이터를 찾지 못했습니다. 파일 형식을 확인해 주세요.</div>}
    </Sec>
    <Sec n={nx()} title="교과군 × 학기 성적표">
      {keys.length > 0 && <div className="tbl-wrap"><table className="rp"><thead><tr><th>교과군</th>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead><tbody>
        {GROUPS.map(gp => <tr key={gp}><td>{gp}</td>{keys.map(k => <td key={k} className="c"><Lv v={cell(gp, k)} /></td>)}</tr>)}
        <tr className="tot"><td>국영수사과</td>{keys.map(k => <td key={k} className="c"><Lv v={core(k)} /></td>)}</tr>
        <tr className="tot"><td>전과목</td>{keys.map(k => <td key={k} className="c"><Lv v={all(k)} /></td>)}</tr></tbody></table></div>}
      <div className="note">※ {is2022 ? "5등급제" : "9등급제"} 학점 가중 평균. 1·2등급(5등급제는 1등급) 과목 {top}개 / 석차등급 과목 {grades.filter(r => r.lv > 0).length}개.{is2022 && s9 ? ` 입결 비교를 위해 평균 ${G.gradeAvg}등급을 9등급제로 환산하면 약 ${s9.toFixed(2)}등급임.` : ""}</div>
    </Sec>
    <Sec n={nx()} title="이수과목 현황">
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 110 }}>교과군</th><th>1학년</th><th>2학년</th><th>3학년</th></tr></thead><tbody>
        {[...GROUPS, "기타"].map(gp => { const rows = [1, 2, 3].map(n => ({ list: grades.filter(r => gOf(r) === gp && r.g === n), ach: ach.filter(a => (+a.gN || parseInt(a.grade)) === n && (GROUPS.includes(a.group) ? a.group : "기타") === gp) }));
          if (rows.every(r => !r.list.length && !r.ach.length)) return null;
          return <tr key={gp}><td>{gp}</td>{rows.map((r, i) => <td key={i}>{r.list.map((x, j) => <span key={j} className="sub-chip">{x.subject}<em>{x.lv || "-"}{x.achievement ? "/" + x.achievement : ""}</em></span>)}{r.ach.map((x, j) => <span key={"a" + j} className="sub-chip opt">{x.subject}<em>{x.achievement}</em></span>)}</td>)}</tr>; })}</tbody></table></div>
      <div className="note">※ 숫자는 석차등급(2022 개정은 등급/성취도), 점선 칸은 진로선택·성취도 전용 과목.</div>
      {cr?.summary && <p className="rp-p" style={{ marginTop: 12 }}>{rich(cr.summary)}</p>}
    </Sec>
    {A2?.available && <Sec n={nx()} title="2022 개정 성취도·분포비율·등급 종합 해석">
      <p className="rp-p">2022 개정 학생부는 석차등급(1~5등급, 비율 10·24·32·24·10%)과 성취도(A~E), 성취도별 분포비율, 원점수와 과목평균, 수강자 수가 함께 제공됨(표준편차는 제공되지 않음). 등급과 성취도는 출발점 정보이며, 기본교과(국·수·영·사·과)의 성취를 먼저 보고 여러 교과·학기에 걸친 누적 맥락을 세특으로 확인해 최종 판단함. 대학에 따라 석차등급과 성취도를 결합하거나 유리한 쪽을 반영하므로, 두 축이 어긋나는 과목은 따로 확인함.</p>
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 120 }}>석차등급 ＼ 성취도</th>{["A", "B", "C", "D", "E"].map(a => <th key={a}>{a}</th>)}</tr></thead><tbody>
        {[1, 2, 3, 4, 5].map(l => <tr key={l}><td className="c">{l}등급</td>{["A", "B", "C", "D", "E"].map(a => { const L = A2.matrix[l + "|" + a] || []; return <td key={a} className="c" style={{ background: L.length ? "#eef2f9" : "#fff" }}>{L.length ? <><b>{L.length}</b><div className="note">{L.slice(0, 3).map(r => r.subject).join(", ")}{L.length > 3 ? " 외" : ""}</div></> : <span className="note">-</span>}</td>; })}</tr>)}</tbody></table></div>
      <div className="tbl-wrap"><table className="rp"><thead><tr><th>과목</th><th>학기</th><th>등급</th><th>성취도</th><th>A 분포비율</th><th>원점수-평균</th><th>수강자</th><th>해석</th></tr></thead><tbody>
        {A2.rows.filter(r => r.ach).slice(0, 40).map((r, i) => <tr key={i}><td>{r.subject}</td><td className="c">{r.g}-{r.s}</td><td className="c">{r.lv || "-"}</td><td className="c">{r.ach}</td><td className="c">{r.aRate != null ? r.aRate + "%" : "-"}</td><td className="c">{r.diff != null ? (r.diff > 0 ? "+" : "") + r.diff : "-"}</td><td className="c">{r.students || "-"}</td>
          <td>{r.only ? "성취도 전용 과목" : r.scarcity ? `A ${r.scarcity}(영역 ${r.area})` : `영역 ${r.area}`}{r.lv >= 3 && (r.ach === "A" || r.ach === "B") ? " · 등급보다 성취도가 후함" : ""}</td></tr>)}</tbody></table></div>
      <p className="rp-p" style={{ marginTop: 12 }}>{A2.sentences.join(" ")}</p>
    </Sec>}
    <Sec n={nx()} title="핵심과목·권장과목 이수 충족률 (지원 학과 기준)">
      <p className="rp-p">지원 학과가 제시한 핵심과목(필수적 이수 권장)과 권장과목(가급적 이수)을 학생이 얼마나 이수했는지는 전공 적합성과 진로역량을 뒷받침하는 객관적 근거로 평가됨. {is2022 ? "2022 개정 학생에게는 대학이 공식 제시한 2028학년도 권장과목이 그대로 적용됨." : "2015 개정(고3)에는 공식 권장과목 제도가 없으므로, 아래 충족 현황은 관련 교과의 폭넓은 이수 여부를 확인하는 참고 지표로만 사용함(미이수를 감점하지 않음)."}</p>
      {CF.length ? CF.map((f, i) => { const ok = a => a.filter(x => x.status !== "no").length; const gs = Object.entries(f.byGroup || {});
        return (<div className="rp-box" key={i}><h5 className="rp-h5">{f.univ} {f.dept}{f.found && <small> · 기준: {f.basis} ({f.level})</small>}</h5>
          {f.found ? <>
            <div className="cf-rings"><Ring pct={f.core.rate} label="핵심과목" sub={f.core.items.length ? `${ok(f.core.items)}/${f.core.items.length}개 이수` : (f.core.free ? "자유 선택" : "지정 없음")} /><Ring pct={f.rec.rate} label="권장과목" sub={f.rec.items.length ? `${ok(f.rec.items)}/${f.rec.items.length}개 이수` : "지정 없음"} />
              <div className="cf-bars"><div className="note" style={{ fontWeight: 800 }}>교과군별 이수</div>{gs.map(([g, its]) => <div className="cf-bar" key={g}><div><span>{g}</span><span className="mono">{ok(its)}/{its.length}</span></div><div className="cf-track"><i style={{ width: (ok(its) / its.length * 100) + "%", background: ok(its) === its.length ? "#2f7d5b" : ok(its) / its.length >= 0.5 ? "#33507a" : "#a8323f" }} /></div></div>)}</div></div>
            <div className="cf-list">{gs.map(([g, its]) => <div className="cf-row" key={g}><b>{g}</b><div>{its.map((x, j) => <span key={j} className={`chk ${x.status}${x.kind === "권장" ? " rec" : ""}`}>{x.status === "ok" ? "이수" : x.status === "alt" ? "대응" : "미이수"} {x.name}{x.kind === "권장" && <i>권장</i>}</span>)}</div></div>)}</div>
            <p className="rp-p">{coreFitSentences(f).join(" ")}</p>{f.note && f.note !== "-" && <div className="note">대학 안내(비고): {f.note}</div>}
          </> : <div className="rp-empty">{f.why || "해당 대학의 권장과목 자료를 찾지 못함."}</div>}</div>); })
        : <div className="rp-empty">희망 대학·학과를 입력하면 해당 학과의 핵심·권장과목 이수 충족률이 이곳에 표시됨.</div>}
      <div className="cf-legend">이수 = 해당 과목 이수 · 대응 = 2015 개정 과목의 2022 개정 대응 과목으로 이수(참고) · 미이수 · 점선 = 권장과목 · 3학년 2학기 이수 예정 과목은 반영되지 않음</div>
    </Sec>
    <Sec n={nx()} title="종합 해설">
      <P t={G.gradeAnalysis?.overall} />{G.gradeAnalysis?.majorLink && <><h5 className="rp-h5">전공 연계 교과</h5><P t={G.gradeAnalysis.majorLink} /></>}
    </Sec>
  </Doc>);
}

/* ───────── 탐구 계보도 (연결선) ───────── */
function LineageDiagram({ acts, links, cols, sel, setSel }) {
  const wrap = useRef(), refs = useRef({}); const [paths, setPaths] = useState([]); const [dim, setDim] = useState({ w: 0, h: 0 });
  const byCol = cols.map(c => acts.filter(a => a.key === c).sort((x, y) => String(x.topic || "~").localeCompare(String(y.topic || "~"), "ko") || x.i - y.i));
  const inLink = {}; links.forEach(l => { inLink[l.to] = l; });
  const hot = useMemo(() => { if (sel == null) return null; const s = new Set([sel]); links.forEach(l => { if (l.from === sel || l.to === sel) { s.add(l.from); s.add(l.to); } }); const t = acts.find(a => a.i === sel)?.topic; if (t) acts.filter(a => a.topic === t).forEach(a => s.add(a.i)); return s; }, [sel, links, acts]);
  useLayoutEffect(() => {
    const calc = () => { const el = wrap.current; if (!el) return; const wr = el.getBoundingClientRect(); setDim({ w: wr.width, h: el.scrollHeight });
      setPaths(links.map(l => { const a = refs.current[l.from], b = refs.current[l.to]; if (!a || !b) return null; const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x1 = ra.right - wr.left, y1 = ra.top + ra.height / 2 - wr.top, x2 = rb.left - wr.left, y2 = rb.top + rb.height / 2 - wr.top; const dx = Math.max(24, (x2 - x1) * 0.5);
        return { ...l, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 }; }).filter(Boolean)); };
    calc(); const ro = new ResizeObserver(calc); wrap.current && ro.observe(wrap.current); window.addEventListener("resize", calc); return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [acts, links, cols.length, sel]);
  return (<div className="dg-wrap"><div className="dg" ref={wrap} style={{ gridTemplateColumns: `repeat(${cols.length},minmax(0,1fr))` }}>
    <svg className="dg-svg" viewBox={`0 0 ${dim.w || 10} ${dim.h || 10}`} preserveAspectRatio="none"><defs>{Object.entries(LCOL).map(([k, c]) => <marker key={k} id={"ar" + k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>)}</defs>
      {paths.map((p, i) => { const on = hot ? (hot.has(p.from) && hot.has(p.to)) : true; return <g key={i} opacity={on ? 1 : 0.12}><path d={p.d} fill="none" stroke={LCOL[p.type]} strokeWidth={on && hot ? 3.6 : 2.6} markerEnd={`url(#ar${p.type})`} />
        <rect x={p.mx - 17} y={p.my - 10} width="34" height="19" fill="#fff" stroke={LCOL[p.type]} /><text x={p.mx} y={p.my + 4} fontSize="12" fontWeight="900" fill={LCOL[p.type]} textAnchor="middle">{p.type}</text></g>; })}</svg>
    {cols.map((c, ci) => <div key={c}><div className="dg-h">{c.replace("-", "학년 ")}학기 · {byCol[ci].length}건</div>
      {byCol[ci].map(a => (<button key={a.i} ref={el => { refs.current[a.i] = el; }} className={`dg-card d${a.depthN}${sel === a.i ? " sel" : ""}${hot && !hot.has(a.i) ? " dim" : ""}`} onClick={() => setSel(sel === a.i ? null : a.i)}>
        <small>{a.subjectName || a.type || a.row} · 깊이 {a.depthN}단계 <Depth n={a.depthN} /></small><b>{a.title}</b><LvlTag a={a} />
        {inLink[a.i] && <span className="dg-in" style={{ color: LCOL[inLink[a.i].type] }}>← {String(acts.find(x => x.i === inLink[a.i].from)?.key || "").replace("-", "학년 ")}학기 {acts.find(x => x.i === inLink[a.i].from)?.subj} · {inLink[a.i].type}</span>}</button>))}</div>)}
  </div>
    <div className="lgd">{Object.entries(LCOL).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}{({ 심화: "(깊이 상승)", 확장: "(교과 이동·깊이 유지/하락)", 전환: "(같은 교과·새 방법)", 반복: "(새 방법 없음)" })[k]}</span>)}</div></div>);
}

/* ───────── 2. 탐구 계보를 통한 추천학과 ───────── */
const ROW_ORDER = ["진로", "동아리", "자율", "봉사", "국어", "수학", "영어", "사회", "과학", "정보·기술", "예체능", "기타"];
function LineageTab({ G, name }) {
  const [sel, setSel] = useState(null);
  const acts = useMemo(() => (G.activities || []).map((a, i) => {
    const g = +a.gN || parseInt(a.year) || 1; let s = +a.sN || parseInt(a.semester) || 1; if (s !== 1 && s !== 2) s = 1;
    let row = a.subject || ""; if (/자율|동아리|진로|봉사/.test(a.type || "") && !/세특/.test(a.type)) row = (a.type.match(/자율|동아리|진로|봉사/) || [""])[0];
    if (!ROW_ORDER.includes(row)) row = /정보|기술|가정/.test(row) ? "정보·기술" : /예|체|음악|미술/.test(row) ? "예체능" : (ROW_ORDER.includes((a.type || "").slice(0, 2)) ? (a.type || "").slice(0, 2) : "기타");
    return { ...a, i, key: `${g}-${s}`, row, g, s, topic: (a.topicKey || "").trim(), subj: a.subjectName || a.subject || a.type || row, depthN: Math.min(4, Math.max(1, parseInt(a.depth) || 1)) };
  }), [G]);
  const { links } = useMemo(() => buildLinks({ ...G, activities: G.activities }), [G]);
  const cols = ["1-1", "1-2", "2-1", "2-2", "3-1"].concat(acts.some(a => a.key === "3-2") ? ["3-2"] : []);
  const counts = cols.map(c => acts.filter(a => a.key === c).length);
  const gradeKeys = [...new Set((G.grades || []).map(r => `${+r.gN || parseInt(r.grade)}-${+r.sN || parseInt(r.semester)}`))]; const missing = cols.filter((c, i) => counts[i] === 0 && gradeKeys.includes(c));
  const selA = sel != null ? acts.find(a => a.i === sel) : null; const threads = G.inquiryThreads || []; const majors = G.recommendedMajors || []; const cnt = (k, v) => acts.filter(a => a[k] === v).length; const hasLevel = acts.some(a => a.level);
  const avgDepth = acts.length ? acts.reduce((a, x) => a + x.depthN, 0) / acts.length : 0; const CM = useMemo(() => connectionMetrics(G), [G]); const CA = G.connectionAnalysis || {};
  const ORD = ["미흡", "보통", "양호", "우수"]; const cons = (a, b) => { const x = ORD.indexOf(a), y = ORD.indexOf(b); return x < 0 ? b || a : y < 0 ? a : ORD[Math.min(x, y)]; }; const vV = cons(CM.verdict.vertical, CA.vertical?.verdict), vH = cons(CM.verdict.horizontal, CA.horizontal?.verdict);
  return (<Doc no="2" title="탐구 계보를 통한 추천학과" lead="학기를 건너 이어진 관심의 줄기와 깊이·수준을 읽고, 그 줄기가 가리키는 학과를 제시함." name={name} G={G}>
    <Sum items={[<>추출된 탐구 기록 <b>{acts.length}건</b>, 평균 탐구 깊이 <b>{avgDepth ? avgDepth.toFixed(1) : "-"}단계</b>(4단계 만점), 학기를 건너 이어진 연결 <b>{links.length}건</b>임.</>,
      hasLevel ? <>내용 수준은 교과 기본 {cnt("level", "기본")}건 · 교과 심화 {cnt("level", "심화")}건 · 대학 전공 {cnt("level", "전공")}건이며, 희망 학과군 적정 수준에 부합하는 기록은 {cnt("levelFit", "적정")}건임.</> : null,
      <>종적 연결 <b>{vV}</b>, 횡적 연결 <b>{vH}</b>로 판정됨.</>, majors[0] ? <>탐구가 가장 뚜렷하게 가리키는 학과는 <b>{majors[0].major}</b>{majors[1] ? `, 다음으로 ${majors[1].major}` : ""}임.</> : null]} />
    {missing.length > 0 && <div className="callout bad"><b>기록 누락 의심 · </b>{missing.join(", ")}에 성적은 있으나 탐구 기록이 추출되지 않음. 원문에 세특이 있다면 HTML(.htm)로 다시 올리거나 파일을 확인할 필요가 있음.</div>}
    <Sec n="2.1" title="학기별 탐구 깊이 분포와 단계 정의">
      <p className="rp-p">탐구 기록 한 건마다 «학생이 무엇을 직접 해냈는가»를 기준으로 1~4단계로 구분함. 아래 그림은 학기별로 기록이 몇 건이고 어느 단계에 있는지를 보여주며, 위쪽 단계에 점이 많을수록 탐구가 깊다는 뜻임. 이 단계는 수행 방법의 깊이이고, 2.3의 수준(교과 기본·심화·전공)은 내용의 난도로 서로 다른 기준임.</p>
      {acts.length > 0 ? <Fig no="3" cap="학기별 탐구 깊이 분포 — 점의 크기와 숫자는 해당 단계의 기록 수"><DepthMatrix cols={cols} acts={acts} /></Fig> : <div className="rp-empty">탐구 기록을 추출하지 못했습니다.</div>}
      <div className="tbl-wrap"><table className="rp keep"><thead><tr><th style={{ width: 130 }}>단계</th><th style={{ width: "26%" }}>정의</th><th style={{ width: "28%" }}>원문에서 확인되는 서술</th><th>입시에서의 의미</th></tr></thead><tbody>
        <tr><td className="c"><b>1단계</b><br />정리·참여</td><td>수업 내용을 정리하거나 발표하고 활동에 참여한 수준</td><td>“발표함”, “참여함”, “정리함”, 소감문·감상 작성</td><td>성실성과 참여도의 근거일 뿐 탐구역량의 근거로는 약함</td></tr>
        <tr><td className="c"><b>2단계</b><br />조사·분석</td><td>이미 있는 자료(문헌·기사·논문·도서)를 찾아 읽고 개념을 비교·분석·적용한 수준</td><td>“자료를 조사하여 비교함”, “논문을 참고해 원리를 정리함”, 독서 후 칼럼</td><td>지적 호기심과 자료 활용 능력을 보여 주는 고교 탐구의 기본선</td></tr>
        <tr><td className="c"><b>3단계</b><br />분석·실험</td><td>학생이 직접 자료를 만들거나 분석한 수준(실험·측정·설문·면담·데이터 분석·모델링·코딩·설계 제작)</td><td>변인·측정값·표본·결과가 기록에 남아 있음</td><td>탐구역량을 인정받는 출발점이며 면접에서 과정을 직접 설명할 수 있음</td></tr>
        <tr><td className="c"><b>4단계</b><br />성찰·확장</td><td>3단계 활동에서 한계·오차·예상과 다른 결과를 짚고 개선·재검증·후속 탐구까지 이어간 수준</td><td>“한계를 분석함”, “가설을 수정함”, “후속 탐구를 설계함”</td><td>최상위권 지원자를 가르는 변별 요소이며 서류와 면접 모두에서 강점이 됨</td></tr></tbody></table></div>
      <div className="note">※ 깊이는 원문에 남은 근거(실험·측정·설문·모델링·한계 서술 등)가 없으면 보고된 단계보다 낮게 조정함. 한 학기에 4단계가 여러 건 나오는 경우는 과대 판정으로 보고 재점검함.</div>
    </Sec>
    <Sec n="2.2" title="탐구 계보도 — 연결선과 연결 이유">
      {acts.length ? <><p className="rp-p">같은 주제어를 공유하는 기록을 학기 순으로 선으로 이었음. 선의 색은 연결 종류(심화·확장·전환·반복)이며, 카드를 누르면 그 주제로 이어진 기록만 강조됨.</p>
        <LineageDiagram acts={acts} links={links} cols={cols} sel={sel} setSel={setSel} />
        <h5 className="rp-h5">연결 이유 표</h5>
        {links.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 44 }}>번호</th><th style={{ width: "10%" }}>주제</th><th style={{ width: "30%" }}>연결 경로</th><th style={{ width: 66 }}>종류</th><th style={{ width: 90 }}>깊이</th><th>연결 이유</th></tr></thead><tbody>
          {links.map((l, i) => { const f = acts.find(a => a.i === l.from), t = acts.find(a => a.i === l.to); return <tr key={i}><td className="c">{i + 1}</td><td><b>{l.topic}</b></td>
            <td>{f.key.replace("-", "학년 ")}학기 {f.subj} 「{f.title}」<br />→ {t.key.replace("-", "학년 ")}학기 {t.subj} 「{t.title}」</td><td className="c"><b style={{ color: LCOL[l.type] }}>{l.type}</b></td><td className="c">{f.depthN} → {t.depthN}</td>
            <td>{l.reason}{l.ai && <div className="note">기록상 연결 근거: {l.ai}</div>}</td></tr>; })}</tbody></table></div> : <div className="rp-empty">같은 주제어로 이어진 기록이 확인되지 않아 연결선을 그리지 못함. 활동이 학기마다 흩어져 있다는 신호임.</div>}</>
        : <div className="rp-empty">탐구 기록을 추출하지 못했습니다.</div>}
    </Sec>
    <Sec n="2.3" title="탐구 수준 진단">
      <p className="rp-p">탐구 수준은 교과 기본 → 교과 심화 → 대학 전공 수준으로 나뉘며, 대부분의 학과군에서 면접의 깊이 있는 질문이 집중되는 적정 구간은 «교과 심화 수준 + 직접 설명 가능»임.</p>
      {hasLevel ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 170 }}>구분</th><th style={{ width: 80 }}>건수</th><th>의미</th></tr></thead><tbody>
        {[["내용 수준 · 교과 기본", cnt("level", "기본"), "교과서 개념 정리·소개 — 개념 정의를 정확히 말하면 충분"], ["내용 수준 · 교과 심화", cnt("level", "심화"), "Ⅱ·진로선택 개념을 실험·계산·모델링에 적용"], ["내용 수준 · 대학 전공", cnt("level", "전공"), "직접 유도·설명할 수 있을 때만 강점"],
          ["적합도 · 적정", cnt("levelFit", "적정"), "희망 학과군 적정 수준에 부합"], ["적합도 · 과소", cnt("levelFit", "과소"), "교과 기본 반복·기사 수준 인용"], ["적합도 · 과잉", cnt("levelFit", "과잉"), "전공 용어 나열, 직접 설명 근거 부족"]].map((r, i) => <tr key={i}><td>{r[0]}</td><td className="c">{r[1]}건</td><td>{r[2]}</td></tr>)}</tbody></table></div> : <div className="rp-empty">활동별 탐구 수준 판정 데이터가 없습니다.</div>}
      {(G._levelInfo || []).map((g, i) => (<div className="rp-box" key={i}><h5 className="rp-h5">{g.name} <small>({g.fam}) — 이 학과군 지원자가 면접에서 질문받는 탐구의 기준</small></h5>
        <p className="rp-p"><b>적정 수준 · </b>{rich(g.proper)}</p>{g.adjust && <p className="rp-p"><b>수준 조절 · </b>{rich(g.adjust)}</p>}{g.caution && <p className="rp-p"><b>주의 · </b>{rich(g.caution)}</p>}
        {g.examples && <details><summary>좋은 평가를 받는 탐구 예시</summary><p className="rp-p">{rich(g.examples)}</p></details>}</div>))}
      {!(G._levelInfo || []).length && <div className="note">희망 대학·학과를 입력하면 해당 학과군의 적정 탐구 수준 기준이 함께 표시됨.</div>}
    </Sec>
    <Sec n="2.4" title="종적·횡적 연결 분석">
      <p className="rp-p">종적 연결은 같은 주제가 학기·학년을 건너 어떻게 깊어졌는지, 횡적 연결은 같은 시기에 서로 다른 교과·창체가 같은 주제를 어떻게 함께 다뤘는지를 뜻함. 두 연결이 모두 확인되고 수준이 적정할 때 전공 적합성과 탐구 신뢰도가 함께 높게 평가됨.</p>
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 100 }}>구분</th><th style={{ width: 80 }}>판정</th><th style={{ width: "28%" }}>판정 근거(코드 산정)</th><th>해설</th></tr></thead><tbody>
        <tr><td>종적 연결</td><td className="c"><b>{vV}</b></td><td>줄기 {CM.vertical.length}개 · 깊이 상승 {CM.vertical.filter(v => v.trend === "상승").length}개 · 줄기에 속한 기록 {Math.round(CM.coverage * 100)}%</td><td>{CA.vertical?.comment ? rich(CA.vertical.comment) : "-"}</td></tr>
        <tr><td>횡적 연결</td><td className="c"><b>{vH}</b></td><td>같은 학기 2개 이상 교과가 한 주제를 다룬 사례 {CM.horizontal.length}건</td><td>{CA.horizontal?.comment ? rich(CA.horizontal.comment) : "-"}</td></tr>
        <tr><td>탐구 수준</td><td className="c"><b>{CA.level?.verdict || (hasLevel ? (cnt("levelFit", "과잉") >= 2 ? "과잉" : cnt("levelFit", "적정") >= Math.ceil(acts.length / 2) ? "적정" : "과소") : "-")}</b></td><td>심화 이상 {cnt("level", "심화") + cnt("level", "전공")}건 · 적정 {cnt("levelFit", "적정")}건 · 과소 {cnt("levelFit", "과소")}건 · 과잉 {cnt("levelFit", "과잉")}건</td><td>{CA.level?.comment ? rich(CA.level.comment) : "-"}</td></tr></tbody></table></div>
      {CM.horizontal.length > 0 && <><h5 className="rp-h5">횡적 연결 — 같은 시기 다른 교과의 주제 공유</h5><div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 120 }}>학기</th><th style={{ width: "18%" }}>주제</th><th>함께 다룬 교과</th></tr></thead><tbody>
        {[...CM.horizontal].sort((a, b) => a.key.localeCompare(b.key)).map((h, i) => <tr key={i}><td>{h.key.replace("-", "학년 ")}학기</td><td><b>{h.topic}</b></td><td>{h.subjects.join(" · ")}</td></tr>)}</tbody></table></div></>}
      {CM.isolated.length > 0 && <p className="rp-p" style={{ marginTop: 12 }}><b>줄기 밖 고립 기록 {CM.isolated.length}건 · </b>{CM.isolated.slice(0, 8).map(a => `${a.key.replace("-", "·")} ${a.subj}「${a.title}」`).join(", ")}{CM.isolated.length > 8 ? " 외" : ""}. 앞뒤 기록과 이어지지 않은 단발 활동은 전공 적합성 근거로 약하게 작용함.</p>}
      {CA.overall && <div className="rp-opinion"><h5 className="rp-h5">탐구 종합 의견</h5><p className="rp-p">{rich(CA.overall)}</p></div>}
    </Sec>
    <Sec n="2.5" title="추천학과와 근거">
      {majors.length ? majors.slice(0, 5).map((m, i) => (<div className="rp-box" key={i}><h5 className="rp-h5">{i + 1}순위 · {m.major} <small>적합도 {fitWord(m.score)}</small></h5>
        <div className="tbl-wrap"><table className="rp kv keep"><tbody>
          <tr><td>추천 이유</td><td>{rich(String(m.reason || "").replace(/\n+/g, " "))}</td></tr>
          {m.courseEvidence && <tr><td>이수 교과 근거</td><td>{rich(m.courseEvidence)}</td></tr>}
          {m.inquiryEvidence && <tr><td>탐구 근거</td><td>{rich(m.inquiryEvidence)}</td></tr>}
          {m.gradeEvidence && <tr><td>성적 근거</td><td>{rich(m.gradeEvidence)}</td></tr>}
          {m.limits && <tr><td>한계</td><td>{rich(m.limits)}</td></tr>}
          {m.nextStep && <tr><td>보완 행동</td><td>{rich(m.nextStep)}</td></tr>}
          <tr><td>관련 이수 교과</td><td>{(m.matchedSubjects || []).slice(0, 6).join(", ") || "-"}</td></tr></tbody></table></div></div>))
        : <div className="rp-empty">추천학과 데이터가 없습니다.</div>}
      <div className="note">※ 추천학과는 이수과목·세특·탐구 줄기를 종합한 «적합도»이며 합격 가능성이 아님. 합격 가능성은 4장에서 다룸.</div>
    </Sec>
    {selA && <aside className="drawer"><button className="mini-btn" style={{ float: "right" }} onClick={() => setSel(null)}>닫기</button>
      <div className="pg-eye">{selA.key.replace("-", "학년 ")}학기 · {selA.subj}</div><h3 style={{ fontSize: 20, margin: "4px 0 8px" }}>{selA.title}</h3>
      <p className="rp-p"><Depth n={selA.depthN} /> 깊이 {selA.depthN}단계{selA.depthRaw && selA.depthRaw !== selA.depthN ? ` (기재상 ${selA.depthRaw}단계 → 원문 근거 점검 후 조정)` : ""}</p>
      {selA.level && <p className="rp-p"><b>탐구 수준 · </b><LvlTag a={selA} /> {selA.levelNote}</p>}
      {(selA.methods || []).length > 0 && <p className="rp-p"><b>방법 · </b>{selA.methods.join(", ")}</p>}
      <P t={selA.content} />{selA.motivation && <p className="rp-p"><b>동기 · </b>{rich(selA.motivation)}</p>}{selA.process && <p className="rp-p"><b>과정 · </b>{rich(selA.process)}</p>}{selA.growth && <p className="rp-p"><b>성장 · </b>{rich(selA.growth)}</p>}</aside>}
  </Doc>);
}

/* ───────── 3. 역량 분석 ───────── */
function CompTab({ G, name }) {
  const comps = G.competencies || {}; const S = G.strengths || [], W = G.weaknesses || []; const overall = tierOfG(G, "overall");
  const lv = COMP.map(([k, n]) => ({ k, n, d: comps[k] || {}, t: tierOfG(G, k) }));
  return (<Doc no="3" title="역량 분석" lead="점수 대신, 각 역량이 «어느 대학 그룹 수준»에 해당하는지와 그 근거(＋/－)를 제시함." name={name} G={G}>
    <Sum items={[<>5대 역량을 종합한 수준은 <b>{overall.label}</b>({overall.ex})임.{overall.lifted ? " 탐구가 우수해 교과성적 수준보다 한 단계 높게 봄." : overall.lowered ? " 탐구·진로가 약해 교과성적 수준보다 한 단계 낮게 봄." : " 교과성적(학업) 수준이 종합 수준의 기준이 됨."}</>, G.scoreSummary ? rich(G.scoreSummary) : null,
      <>가장 강한 역량은 <b>{[...lv].sort((a, b) => a.t.idx - b.t.idx)[0]?.n}</b>, 가장 보완이 필요한 역량은 <b>{[...lv].sort((a, b) => b.t.idx - a.t.idx)[0]?.n}</b>임.</>]} />
    <Sec n="3.1" title="종합 수준 판정">
      <div><Fig no="4" cap="대학 그룹 수준 사다리 — 현재 위치"><TierLadder idx={overall.idx} sub={overall.sub} steps={TIER_STEPS} /></Fig>
        <Fig no="5" cap="5대 역량별 수준 — 눈금은 왼쪽(최상위)에서 오른쪽(기초 보완), 점이 현재 위치"><LevelBars steps={TIER_STEPS} items={lv.map(x => ({ label: x.n, idx: x.t.idx, sub: x.t.sub }))} /></Fig></div>
      <h5 className="rp-h5">수준 구분 기준 — 최상위권부터 기초 보완 단계까지</h5>
      <div className="tbl-wrap"><table className="rp keep"><thead><tr><th style={{ width: "13%" }}>수준</th><th style={{ width: "20%" }}>해당 대학군</th><th style={{ width: "22%" }}>교과성적·탐구 조건</th><th>판정 원칙과 현실</th></tr></thead><tbody>
        {OVERALL_TABLE.map((r, i) => <tr key={i} style={i === overall.idx ? { background: "#e6eaf2" } : {}}><td className="c"><b>{r[0]}</b>{i === overall.idx && <div className="note">현재 위치</div>}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody></table></div>
      <div className="note">※ 종합 수준은 교과성적(학업)이 천장이며, 탐구·진로가 매우 우수할 때만 한 단계 상향하고 약하면 한 단계 하향함. 사례가 있다는 사실만으로 합격이 보장되지 않으므로 기준은 보수적으로 적용함.</div>
    </Sec>
    <Sec n="3.2" title="역량별 수준과 근거">
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: "13%" }}>역량</th><th style={{ width: "14%" }}>수준</th><th>플러스(＋) 근거</th><th>마이너스(－) 근거</th></tr></thead><tbody>
        {lv.map(x => { const b = x.d.scoreBreakdown || {}; return <tr key={x.k}><td><b>{x.n}</b></td><td className="c"><b>{x.t.shortLabel}</b>{x.k === "career" && (G._coreFit || [])[0]?.found && (G._coreFit || [])[0].core.rate != null && <div className="note">핵심과목 충족 {(G._coreFit || [])[0].core.rate}%</div>}</td>
          <td><ul className="rp-ul g">{(b.plusFactors || []).map((p, i) => <li key={i}>{rich(ns(p.reason))}</li>)}</ul></td>
          <td><ul className="rp-ul r">{(b.minusFactors || []).map((p, i) => <li key={i}>{rich(ns(p.reason))}</li>)}{!(b.minusFactors || []).length && <li className="none">확인된 감점 요인 없음</li>}</ul></td></tr>; })}</tbody></table></div>
    </Sec>
    <Sec n="3.3" title="역량별 해설">
      {lv.map(x => { const b = x.d.scoreBreakdown || {}; return (<div key={x.k} className="rp-item"><h5 className="rp-h5">{x.n} — {x.t.label}</h5>
        <P t={ns(x.d.detail)} />{(x.d.evidenceList || []).length > 0 && <ul className="rp-quote">{x.d.evidenceList.slice(0, 3).map((e, i) => <li key={i}>{rich(ns(e))}</li>)}</ul>}</div>); })}
    </Sec>
    <Sec n="3.4" title="역량별 수준 판정 기준표">
      <p className="rp-p">각 역량을 아래 기준으로 6단계로 판정함. 정량 조건과 정성 조건을 모두 충족해야 해당 수준으로 인정하며, 한쪽만 충족하면 한 단계 낮은 수준으로 봄. 현재 위치는 음영으로 표시함.</p>
      {COMP_RUBRIC.map(r => { const cur = tierOfG(G, r.key).idx; return (<div key={r.key} style={{ marginBottom: 18 }}><h5 className="rp-h5">{r.name} <small>— {r.basis}</small></h5>
        <div className="tbl-wrap"><table className="rp keep"><thead><tr><th style={{ width: "16%" }}>수준</th><th style={{ width: "36%" }}>정량 조건</th><th>정성 조건</th></tr></thead><tbody>
          {r.rows.map((x, i) => <tr key={i} style={i === cur ? { background: "#e6eaf2" } : {}}><td className="c"><b>{x[0]}</b>{i === cur && <div className="note">현재</div>}</td><td>{x[1]}</td><td>{x[2]}</td></tr>)}</tbody></table></div></div>); })}
      <div className="note">※ 대학 그룹은 합격선 지도와 같은 구분(최상위권·상위권·중상위권·중위권·거점국립대)을 따름. 학종 평가는 대학·전형·학과마다 다르므로 «참고 수준»임.</div>
    </Sec>
    <Sec n="3.5" title="강점과 보완점">
      <div className="grid g2"><div className="rp-box g"><h5 className="rp-h5">강점</h5>{S.length ? <ul className="rp-ul">{S.map((s, i) => <li key={i}><b>{s.title}</b> — {rich(String(s.content || "").replace(/\n+/g, " "))}{s.highlight && <div className="note">입시에서의 의미: {rich(s.highlight)}</div>}</li>)}</ul> : <div className="note">없음</div>}</div>
        <div className="rp-box r"><h5 className="rp-h5">보완점</h5>{W.length ? <ul className="rp-ul">{W.map((s, i) => <li key={i}><b>{s.title}</b> — {rich(String(s.content || "").replace(/\n+/g, " "))}{s.suggestion && <div className="note">보완 방법: {rich(s.suggestion)}</div>}</li>)}</ul> : <div className="note">없음</div>}</div></div>
    </Sec>
  </Doc>);
}

/* ───────── 4. 희망학과·대학 유불리 ───────── */
function DiagTab({ G, name, major }) {
  const is2022 = (G.curriculum || "").includes("2022") || G.is2022; const T = G.tierAnalysis || {}; const dept = G.deptReports || [];
  const cmp = useMemo(() => { try {
    const gs = (G.grades || []).filter(r => lvN(r.level) > 0); let f = null;
    if (!is2022 && gs.length >= 3) { const lv = gs.map(r => lvN(r.level)); const m = lv.reduce((a, b) => a + b, 0) / lv.length; const sp = Math.sqrt(lv.reduce((a, b) => a + (b - m) ** 2, 0) / lv.length);
      const core = gs.filter(r => GROUPS.slice(0, 3).includes(r.group)); const ca = core.length ? core.reduce((a, b) => a + lvN(b.level), 0) / core.length : null;
      const mg = getMajorRelatedGroups(major || G.studentType); const mr = gs.filter(r => mg.includes(r.group)); const ma = mr.length ? mr.reduce((a, b) => a + lvN(b.level), 0) / mr.length : null;
      f = { coreAvg: ca ? +ca.toFixed(2) : null, majorAvg: ma ? +ma.toFixed(2) : null, spread: +sp.toFixed(2) }; }
    return compareAllUnivs(G.gradeAvg, major || G.studentType, is2022, f); } catch (e) { return null; } }, [G, major, is2022]);
  const ranks = G.univRecommendRank || []; const top = G.topUnivCompare;
  return (<Doc no="4" title="희망학과·대학 유불리" lead="내신 숫자만이 아니라 정성평가 기준(관련교과·탐구 깊이와 수준·공동체)을 우선해 판단함." name={name} G={G}>
    <Sum items={[T.recommendedTier ? <>현실적인 지원 라인은 <b>{rich(T.recommendedTier)}</b>임.</> : null, T.studentLevel ? rich(firstSentence(T.studentLevel, 150)) : null,
      dept[0] ? <>1순위 희망 <b>{dept[0].univ} {dept[0].dept}</b>의 종합 판정은 <b>{dept[0].overall?.verdict}</b>임.</> : <>희망 대학·학과가 입력되지 않아 «희망학과 분석»은 생략됨.</>,
      is2022 && s9Of(G, true) ? <>2022 개정(5등급제) 평균 {G.gradeAvg}등급은 9등급제 환산 약 {s9Of(G, true).toFixed(2)}등급으로 입결과 비교함.</> : null]} />
    <div className="callout warn"><b>읽는 법 · </b>합격가능성은 서류 기준의 <b>보수적 추정치</b>임. 면접이 있는 전형은 결과에 따라 크게 달라질 수 있고, 인용된 합격선에는 특목·자사고 지원자도 섞여 있어 일반고 학생에게는 더 엄격하게 봐야 함. 합격 사례가 있다는 사실만으로 합격이 보장되지 않음.</div>
    <Sec n="4.1" title="희망학과 분석">
      {dept.length ? dept.map((d, i) => { const gv = d.gradeView || d.gradeAnalysis?.trend, mv = d.majorGradeView || d.gradeAnalysis?.relatedSubjects, op = d.opinion || d.letter; const cu = d._cut;
        const f = (G._coreFit || []).find(x => x.univ === d.univ && x.dept === d.dept); const hasSplit = d.inquiryLevel || d.inquiryVertical || d.inquiryHorizontal || d.inquiryVsUniv;
        return (<div className="rp-box" key={i}><h5 className="rp-h5">{d.rank || i + 1}순위 · {d.univ} {d.dept}</h5>
        <div className="tbl-wrap"><table className="rp kv"><tbody>
          <tr><td>종합 판정</td><td><b>{d.overall?.verdict}</b> — {rich(d.overall?.summary)}</td></tr>
          {d.univProfile && <tr><td>지원 대학 특성</td><td>{rich(d.univProfile)}</td></tr>}
          {gv && <tr><td>교과 성적</td><td>{rich(gv)}</td></tr>}{mv && <tr><td>학과 관련 성적</td><td>{rich(mv)}</td></tr>}
          {f?.found && <tr><td>핵심·권장과목 이수</td><td>핵심 {f.core.rate == null ? (f.core.free ? "자유 선택" : "지정 없음") : <b>{f.core.rate}% ({f.core.items.filter(x => x.status !== "no").length}/{f.core.items.length})</b>} · 권장 {f.rec.rate == null ? "지정 없음" : <b>{f.rec.rate}%</b>}{f.core.items.some(x => x.status === "no") && <> — 미이수 핵심: {f.core.items.filter(x => x.status === "no").map(x => x.name).join(", ")}</>}</td></tr>}
          {hasSplit ? <>{d.inquiryLevel && <tr><td>탐구 수준</td><td>{rich(d.inquiryLevel)}</td></tr>}{d.inquiryVertical && <tr><td>종적 연결</td><td>{rich(d.inquiryVertical)}</td></tr>}{d.inquiryHorizontal && <tr><td>횡적 연결</td><td>{rich(d.inquiryHorizontal)}</td></tr>}{d.inquiryVsUniv && <tr><td>이 대학 평가 요소 대비</td><td>{rich(d.inquiryVsUniv)}</td></tr>}</>
            : (d.inquiryView || d.activityFit?.detail) && <tr><td>탐구 수준·연결</td><td>{rich(d.inquiryView || d.activityFit?.detail)}</td></tr>}</tbody></table></div>
        {cu && cu.lines?.length > 0 && <><h5 className="rp-h5">학과별 최근 입결 <small>— {cu.basis}</small></h5><div className="tbl-wrap"><table className="rp"><thead><tr><th>전형</th><th>학년도</th><th>50%컷</th><th>70%컷</th><th>모집</th><th>경쟁률</th><th>충원율</th></tr></thead><tbody>
          {cu.lines.flatMap((ln, li) => [...ln.years].reverse().map((y, yi) => <tr key={li + "-" + yi}>{yi === 0 && <td rowSpan={ln.years.length}><b>{ln.jh}</b><div className="note">{ln.dept}</div></td>}<td className="c">{y.y}</td><td className="c">{y.c50 != null ? y.c50.toFixed(2) : "-"}</td><td className="c">{y.c70 != null ? y.c70.toFixed(2) : "-"}</td><td className="c">{y.recruit ?? "-"}</td><td className="c">{y.comp != null ? y.comp.toFixed(1) + ":1" : "-"}</td><td className="c">{y.add != null ? Math.round(y.add) + "%" : "-"}</td></tr>))}</tbody></table></div><div className="note">※ 9등급제 기준 입결이며 특목·자사고 지원자가 섞여 있음. 2022 개정 학생은 5등급 평균을 9등급으로 환산해 비교함.</div></>}
        {(d.qualGaps || []).length > 0 && <><h5 className="rp-h5">정성 평가 — 부족한 부분과 보완 방향</h5><div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 120 }}>영역</th><th style={{ width: "30%" }}>부족한 점</th><th style={{ width: "20%" }}>근거 기록</th><th>보완 방향(무엇을·언제·어떻게)</th><th style={{ width: 64 }}>우선순위</th></tr></thead><tbody>
          {d.qualGaps.map((g, j) => <tr key={j}><td className="c"><b>{g.area}</b></td><td>{rich(g.gap)}</td><td>{g.evidence ? rich(g.evidence) : <span className="note">-</span>}</td><td>{rich(g.fix)}</td><td className="c">{g.priority || "-"}</td></tr>)}</tbody></table></div></>}
        <div className="grid g2" style={{ marginTop: 8 }}><div><h5 className="rp-h5">유리한 점</h5><ul className="rp-ul g">{(d.pros || []).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></div><div><h5 className="rp-h5">불리한 점</h5><ul className="rp-ul r">{(d.cons || []).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></div></div>
        {(d.strategy?.전형추천 || (d.strategy?.key3 || []).length > 0) && <p className="rp-p"><b>추천 전형 · </b>{d.strategy?.전형추천}{(d.strategy?.key3 || []).length > 0 && <> <b style={{ marginLeft: 10 }}>핵심 보완 · </b>{d.strategy.key3.map((x, j) => `${j + 1}) ${x}`).join("  ")}</>}</p>}
        {op && <div className="rp-opinion"><h5 className="rp-h5">종합 의견</h5><p className="rp-p">{rich(String(op).replace(/\n+/g, " "))}</p></div>}
      </div>); })
        : <div className="rp-empty">희망 대학·학과를 입력하지 않아 이 구간은 비어 있음. 아래 ‘대학 유불리’는 입력과 무관하게 제공됨.</div>}
    </Sec>
    <Sec n="4.2" title="대학 유불리 비교">
      {T.studentLevel && <p className="rp-p"><b>현재 위치 · </b>{rich(T.studentLevel)}</p>}
      {cmp && <Fig no="6" cap="티어별 참고 합격선(특목·자사고가 섞인 평균)과 내 평균등급(9등급제 기준) — 점 위에 올리면 대학명이 보임"><PositionMap tiers={cmp.filter(t => !/교대/.test(t.tier))} student={parseFloat(G.gradeAvg) || null} is5={is2022} /></Fig>}
      {(cmp || []).map((tier, ti) => { const ta = (T.tiers || []).find(t => t.tier === tier.tier); const us = tier.univs.filter(u => !u.artsNote); const rowsU = []; for (let k = 0; k < us.length; k += 4) rowsU.push(us.slice(k, k + 4));
        return (<div className="rp-slide" key={ti}>
          <div className="rp-slide-h" style={{ background: tier.color }}><div><b>{tier.tier}</b><span>{tier.desc}</span></div><div className="rp-slide-r">{ta && <em>{ta.verdict}</em>}{ta?.admissionProbability?.min != null && <strong>추정 합격가능성 {probTxt(ta.admissionProbability)}</strong>}</div></div>
          <div className="rp-slide-b">
            <div><h6>판단 근거</h6>{ta?.reason ? <P t={ta.reason} /> : <p className="rp-p note">이 구간은 세부 판정 없이 참고컷만 제공함.</p>}</div>
            <div><h6>전형·전략</h6>{ta?.strategy ? <p className="rp-p">{rich(ta.strategy)}</p> : <p className="rp-p note">-</p>}</div></div>
          {rowsU.length > 0 && <table className="rp mini"><thead><tr>{[0, 1, 2, 3].map(k => <React.Fragment key={k}><th>대학</th><th style={{ width: 58 }}>참고컷</th></React.Fragment>)}</tr></thead><tbody>{rowsU.map((r, ri) => <tr key={ri}>{[0, 1, 2, 3].map(k => r[k] ? <React.Fragment key={k}><td>{r[k].name}</td><td className="c">{r[k].cutShow || r[k].cut}</td></React.Fragment> : <React.Fragment key={k}><td /><td /></React.Fragment>)}</tr>)}</tbody></table>}
        </div>); })}
    </Sec>
    <Sec n="4.3" title="지원 검토 순서(추천 순위)">
      {ranks.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 54 }}>순위</th><th style={{ width: "16%" }}>대학·학과</th><th style={{ width: 74 }}>판정</th><th style={{ width: 120 }}>추정 합격가능성</th><th>근거</th></tr></thead><tbody>
        {ranks.map((r, i) => <tr key={i}><td className="c">{r.rank || i + 1}</td><td><b>{r.univ}</b><div className="note">{r.recommendedDept}</div></td><td className="c">{r.verdict}</td><td className="c"><b>{probTxt(r.admissionProbability)}</b></td><td>{rich(String(r.reason || "").replace(/\n+/g, " "))}</td></tr>)}</tbody></table></div> : <div className="rp-empty">추천 순위 데이터가 없습니다.</div>}
      {top?.univs?.length > 0 && <details><summary>주요 상위 10개 대학 개별 비교</summary><div className="tbl-wrap"><table className="rp"><thead><tr><th>대학</th><th>판정</th><th>합격가능성</th><th>추천 전형</th><th>평가</th></tr></thead><tbody>
        {top.univs.map((u, i) => <tr key={i}><td><b>{u.univ}</b></td><td className="c">{u.verdict}</td><td className="c">{probTxt(u.admissionProbability)}</td><td>{u.전형추천}</td><td>{rich(String(u.summary || "").replace(/\n+/g, " "))}</td></tr>)}</tbody></table></div>{top.advice && <P t={top.advice} />}</details>}
    </Sec>
  </Doc>);
}

/* ───────── 5. 종합 리포트 ───────── */
function FinalTab({ G, name, onExport }) {
  const F = G.finalRecommendation || {}; const E = G.executiveSummary || {}; const overall = tierOfG(G, "overall"); const is2022 = (G.curriculum || "").includes("2022") || G.is2022; const s9 = s9Of(G, is2022);
  const strengths = E.strengths?.length ? E.strengths : (G.strengths || []).slice(0, 3).map(s => s.title); const risks = E.risks?.length ? E.risks : (G.weaknesses || []).slice(0, 3).map(s => s.title); const actions = E.actions?.length ? E.actions : (G.deptReports?.[0]?.strategy?.key3 || []);
  return (<Doc no="5" title="종합 리포트" lead="어느 대학·학과를 어떤 전형으로 지원하는 것이 현실적인가에 대한 최종 의견." name={name} G={G}>
    <Sum items={[<>{rich(E.headline || firstSentence(G.studentType, 120))}</>, <>종합 수준 판정: <b>{overall.label}</b> ({overall.ex})</>, F.top10?.[0] ? <>우선 검토할 지원: <b>{F.top10[0].univ} {F.top10[0].dept}</b> · {F.top10[0].admissionType}</> : null]} />
    <Sec n="5.1" title="핵심 진단">
      <Fig no="7" cap="종합 수준 판정"><TierLadder idx={overall.idx} sub={overall.sub} steps={TIER_STEPS} /></Fig>
      <div className="tbl-wrap"><table className="rp"><thead><tr><th>강점(＋)</th><th>리스크(－)</th><th>지금 할 일</th></tr></thead><tbody><tr>
        {[strengths, risks, actions].map((l, i) => <td key={i}><ul className={`rp-ul ${i === 0 ? "g" : i === 1 ? "r" : ""}`}>{(l || []).slice(0, 3).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></td>)}</tr></tbody></table></div>
    </Sec>
    <Sec n="5.2" title="이렇게 지원하는 것을 추천합니다">
      {F.interviewCaveat && <div className="callout warn"><b>면접 유의 · </b>{rich(F.interviewCaveat)}</div>}
      {F.top10?.length ? <><div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 50 }}>순위</th><th>대학·학과</th><th>전형</th><th style={{ width: 64 }}>라인</th><th style={{ width: 120 }}>추정 합격가능성</th><th style={{ width: 150 }}>합격 등급 범위(70%컷)</th></tr></thead><tbody>
        {F.top10.map((r, i) => <tr key={i}><td className="c">{r.rank || i + 1}</td><td><b>{r.univ}</b> {r.dept}</td><td>{r.admissionType}{r.hasInterview ? " (면접 포함)" : ""}</td><td className="c">{r.tier}</td><td className="c"><b>{probTxt(r.admissionProbability)}</b></td><td className="c">{r._cut?.c70 != null ? `${r._cut.c70.toFixed(2)}등급` : "자료 없음"}</td></tr>)}</tbody></table></div>
        <div className="note">※ 합격 등급 범위는 최근 입결(9등급제) 자료이며 특목·자사고 지원자가 섞여 있음. 확률은 서류 기준 보수적 추정이며 실제 결과는 이보다 낮거나 높을 수 있음.</div>
        <h5 className="rp-h5" style={{ marginTop: 26 }}>지원별 상세 분석</h5>
        {F.top10.map((r, i) => { const c = r._cut; return (<div className="rp-app" key={i}>
          <div className="rp-app-h"><span className="no">{r.rank || i + 1}</span><b>{r.univ} {r.dept}</b><span>{r.admissionType}{r.hasInterview ? " · 면접 포함" : ""}</span><span className="ln">{r.tier} · 추정 합격가능성 {probTxt(r.admissionProbability)}</span></div>
          <table className="rp kv"><tbody>
            {r.profile && <tr><td>이 전형이 선호하는 지원자</td><td>{rich(r.profile)}</td></tr>}
            <tr><td>합격 등급 범위</td><td className="gb">{c ? <><GradeBand c50={c.c50} c70={c.c70} lo={c.lo} hi={c.hi} student={s9} />
              <div className="note" style={{ marginTop: 6 }}>{c.year}학년도 합격자 50%컷 {c.c50 != null ? c.c50.toFixed(2) : "-"}등급 ~ 70%컷 {c.c70 != null ? c.c70.toFixed(2) : "-"}등급(범위 {c.lo != null && isFinite(c.lo) ? c.lo.toFixed(2) : "-"}~{c.hi != null && isFinite(c.hi) ? c.hi.toFixed(2) : "-"}){c.comp != null ? `, 경쟁률 ${c.comp.toFixed(1)}:1` : ""}{c.add != null ? `, 충원율 ${Math.round(c.add)}%` : ""} · 기준: {c.basis}{s9 != null && c.c70 != null ? ` · 내 평균 ${s9.toFixed(2)}등급은 70%컷 대비 ${(s9 - c.c70) > 0 ? `${(s9 - c.c70).toFixed(2)}등급 낮음(불리)` : `${Math.abs(s9 - c.c70).toFixed(2)}등급 높음(유리)`}${is2022 ? "(5등급제를 9등급제로 환산해 비교)" : ""}` : ""}</div></> : <span className="note">이 대학·학과·전형 유형의 입결 자료를 찾지 못함.</span>}</td></tr>
            {r.gradeView && <tr><td>교과 성적 해석</td><td>{rich(r.gradeView)}</td></tr>}
            {r.inquiryFit && <tr><td>탐구 수준·연결</td><td>{rich(r.inquiryFit)}</td></tr>}
            {(r.gaps || []).length > 0 && <tr><td>부족한 정성 요소</td><td><ul className="rp-ul r">{r.gaps.map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></td></tr>}
            <tr><td>종합 판단</td><td>{rich(String(r.reason || "").replace(/\n+/g, " "))}</td></tr></tbody></table></div>); })}</>
        : <div className="rp-empty">최종 추천 데이터가 없습니다.</div>}
    </Sec>
    {F.avoid?.length > 0 && <Sec n="5.3" title="현재로선 피하는 것이 좋은 대학·학과"><div className="callout bad">{F.avoid.map((a, i) => <p key={i} className="rp-p" style={{ margin: "0 0 8px" }}><b>{a.univ}{a.dept ? ` · ${a.dept}` : ""}</b> — {rich(a.reason)}</p>)}</div></Sec>}
    <Sec n={F.avoid?.length ? "5.4" : "5.3"} title="상담 의견">
      {G.summaryLetter ? <div className="letter">{rich(G.summaryLetter)}</div> : <div className="rp-empty">편지 데이터가 없습니다.</div>}
      {G.reportLetter && <details><summary>상세 상담 편지 전문</summary><div className="letter" style={{ marginTop: 10 }}>{rich(G.reportLetter)}</div></details>}
    </Sec>
    <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 24 }}><button className="mini-btn" onClick={() => window.print()}>전체 인쇄 / PDF 저장</button><button className="mini-btn" onClick={onExport}>워드(.doc) 내보내기</button></div>
  </Doc>);
}

export default function Report({ G, name, total, grd, inMajor, onReset, onExport }) {
  const [tab, setTab] = useState(0); const go = i => { setTab(i); window.scrollTo({ top: 0 }); }; const overall = tierOfG(G, "overall");
  const bodies = [<GradesTab G={G} name={name} major={inMajor} />, <LineageTab G={G} name={name} />, <CompTab G={G} name={name} />, <DiagTab G={G} name={name} major={inMajor} />, <FinalTab G={G} name={name} onExport={onExport} />];
  useEffect(() => { const open = () => document.querySelectorAll("details").forEach(d => { d.open = true; }); window.addEventListener("beforeprint", open); return () => window.removeEventListener("beforeprint", open); }, []);
  return (<div className="shell">
    <aside className="rail">
      <div className="logo-pill"><span className="brand-dot">RI</span>리포트아이</div>
      <div className="who"><small>{G.schoolName || ""}</small><h3>{name}</h3><div className="who-tier">{overall.label}</div><p>{overall.ex}</p></div>
      <nav className="nav">{TABS.map((t, i) => <button key={i} className={tab === i ? "on" : ""} onClick={() => go(i)}><b>{i + 1}</b>{t}</button>)}</nav>
      <div className="rail-foot no-print"><button className="mini-btn" onClick={onExport}>워드로 저장</button><button className="mini-btn" onClick={() => window.print()}>인쇄</button><button className="mini-btn" onClick={onReset}>새 분석</button></div>
    </aside>
    <main className="main">{bodies.map((b, i) => <div key={i} className={`chapter${tab === i ? " on" : ""}`}>{b}</div>)}</main>
    <nav className="dock">{TABS.map((t, i) => <button key={i} className={tab === i ? "on" : ""} onClick={() => go(i)}><b>{i + 1}</b>{["성적", "계보", "역량", "입시", "종합"][i]}</button>)}</nav>
  </div>);
}
