import React, { useState, useMemo } from "react";
import { rich, firstSentence, getMajorRelatedGroups, lvN, verdictTone, Depth } from "./util.jsx";
import { compareAllUnivs } from "../prediction2028.js";
import { Radar, RangeBar, PositionMap, DepthBars, TierLadder } from "./charts.jsx";
import { RUBRIC_TABLE, TIER_STEPS, tierOf, fitWord } from "../scoring.js";
import { connectionMetrics } from "../connections.js";

const TABS = ["성적·이수 분석", "탐구 계보를 통한 추천학과", "역량 분석", "희망학과·대학 유불리", "종합 리포트"];
const COMP = [["academic", "학업역량"], ["inquiry", "탐구역량"], ["career", "진로역량"], ["community", "공동체역량"], ["growth", "성장역량"]];
const MAXES = { academic: 40, inquiry: 25, career: 15, community: 10, growth: 10 };
const GROUPS = ["국어", "수학", "영어", "사회", "과학"];
const LVL = { 기본: "교과 기본", 심화: "교과 심화", 전공: "대학 전공" };

const Sec = ({ n, title, children }) => (<section className="rp-sec"><h3><span>{n}</span>{title}</h3>{children}</section>);
const P = ({ t }) => !t ? null : <>{String(t).split(/\n{2,}/).map((x, i) => <p className="rp-p" key={i}>{rich(x)}</p>)}</>;
const Sum = ({ items }) => (<div className="rp-sum"><h4>핵심 요약</h4><ul>{items.filter(Boolean).slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ul></div>);
const Fig = ({ no, cap, children }) => (<figure className="fig">{children}<figcaption>그림 {no}. {cap}</figcaption></figure>);
const Lv = ({ v }) => { const n = Math.round(v || 0); return <span className={`lv lv${Math.min(Math.max(n, 0), 9)}`}>{v ? (Number.isInteger(v) ? v : v.toFixed(1)) : "·"}</span>; };
const LvlTag = ({ a }) => a.level ? <span className={`lvl lvl-${a.level} fit-${a.levelFit || ""}`}>{LVL[a.level] || a.level}{a.levelFit && a.levelFit !== "판단불가" ? ` · ${a.levelFit}` : ""}</span> : null;
const Doc = ({ no, title, lead, name, G, children }) => (<article className="sheet">
  <div className="rp-meta"><span>REPORT·I · 학생부 정밀 진단 보고서</span><span>{name}{G.schoolName ? ` · ${G.schoolName}` : ""} · {new Date().toLocaleDateString("ko-KR")}</span></div>
  <div className="rp-chap">제 {no} 장</div><h1 className="rp-title">{title}</h1>{lead && <div className="rp-lead">{lead}</div>}{children}
  <div className="rp-foot">본 보고서는 학생부 기록과 공개 입시 자료를 바탕으로 한 참고용 진단이며, 실제 합격 여부는 대학별 평가와 면접 등에 따라 달라질 수 있습니다.</div></article>);

/* ───────── 1. 성적·이수 분석 ───────── */
function GradesTab({ G, name, major }) {
  const is2022 = (G.curriculum || "").includes("2022") || G.is2022; const maxLv = is2022 ? 5 : 9;
  const grades = useMemo(() => (G.grades || []).map(r => ({ ...r, lv: lvN(r.level), g: +r.gN || parseInt(r.grade) || 0, s: +r.sN || parseInt(r.semester) || 0, w: parseFloat(r.credit) || 1 })), [G]);
  const keys = [...new Set(grades.filter(r => r.g && r.s).map(r => `${r.g}-${r.s}`))].sort();
  const avg = list => { const f = list.filter(r => r.lv > 0); const w = f.reduce((a, r) => a + r.w, 0); return w ? f.reduce((a, r) => a + r.lv * r.w, 0) / w : null; };
  const cell = (grp, k) => avg(grades.filter(r => r.group === grp && `${r.g}-${r.s}` === k));
  const core = k => avg(grades.filter(r => GROUPS.includes(r.group) && `${r.g}-${r.s}` === k));
  const all = k => avg(grades.filter(r => `${r.g}-${r.s}` === k));
  const coreAll = avg(grades.filter(r => GROUPS.includes(r.group)));
  const rg = getMajorRelatedGroups(major || G.studentType); const relAll = avg(grades.filter(r => rg.includes(r.group)));
  const top = grades.filter(r => r.lv > 0 && r.lv <= (is2022 ? 1 : 2)).length;
  const series = keys.map(k => core(k)); const first = series.find(v => v != null), last = [...series].reverse().find(v => v != null);
  const diff = (first != null && last != null) ? last - first : 0;
  const trend = first == null ? "-" : Math.abs(diff) < 0.25 ? "안정 유지형" : diff < 0 ? "상승형" : "하락형";
  const W = 600, H = 200, px = 40, py = 30; const X = i => keys.length < 2 ? W / 2 : px + 22 + i * ((W - px - 70) / (keys.length - 1)); const Y = v => py + ((v - 1) / (maxLv - 1)) * (H - py * 2);
  const pts = series.map((v, i) => v != null ? [X(i), Y(v), v] : null).filter(Boolean);
  const radarVals = GROUPS.map(g => { const a = avg(grades.filter(r => r.group === g)); return { label: g, value: a ? Math.max(0, (maxLv - a) / (maxLv - 1) * 100) : 0, text: a ? a.toFixed(2) : "-" }; });
  const ach = G.achievementSubjects || []; const gOf = r => GROUPS.includes(r.group) ? r.group : "기타"; const cr = G.creditStatus;
  return (<Doc no="1" title="성적·이수 분석" lead={`${G.stageLabel || ""} · ${is2022 ? "2022 개정(5등급제)" : "2015 개정(9등급제)"}`} name={name} G={G}>
    <Sum items={[<>전체 평균등급 <b>{G.gradeAvg || "-"}</b>, 국영수사과 학점가중 평균 <b>{coreAll ? coreAll.toFixed(2) : "-"}</b>, 성적 추이는 <b>{trend}</b>{first != null && last != null ? ` (${first.toFixed(2)} → ${last.toFixed(2)})` : ""}임.</>,
      relAll != null && coreAll != null ? <>전공 관련 교과({rg.join("·")}) 평균은 <b>{relAll.toFixed(2)}</b>로 전체 대비 {relAll < coreAll - 0.2 ? "우수" : relAll > coreAll + 0.2 ? "열세" : "비슷"}한 수준임.</> : null,
      G.gradeAnalysis?.overall ? rich(firstSentence(G.gradeAnalysis.overall, 120)) : null]} />
    <Sec n="1.1" title="학기별 성적 추이와 교과군 균형">
      {keys.length ? <div className="grid split"><Fig no="1" cap="국영수사과 학기별 평균등급(위로 갈수록 우수)"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {Array.from({ length: maxLv }, (_, i) => i + 1).map(v => <g key={v}><line x1={px} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="#ece4d8" /><text x={px - 8} y={Y(v) + 4} fontSize="13" fill="#8b8478" textAnchor="end">{v}</text></g>)}
        {keys.map((k, i) => <text key={k} x={X(i)} y={H - 4} fontSize="13" fill="#44506b" textAnchor="middle" fontWeight="700">{k.replace("-", "·") + "학기"}</text>)}
        <polyline fill="none" stroke="#0f9a90" strokeWidth="3" strokeLinejoin="round" points={pts.map(p => p[0] + "," + p[1]).join(" ")} />
        {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="6" fill="#fff" stroke="#0b7a77" strokeWidth="3" /><text x={p[0]} y={p[1] - 12} fontSize="14" fontWeight="800" fill="#1c2538" textAnchor="middle">{p[2].toFixed(2)}</text></g>)}</svg></Fig>
        <Fig no="2" cap="교과군별 평균(바깥일수록 우수)"><Radar values={radarVals} size={270} /></Fig></div> : <div className="rp-empty">학기별 성적 데이터를 찾지 못했습니다. 파일 형식을 확인해 주세요.</div>}
    </Sec>
    <Sec n="1.2" title="교과군 × 학기 성적표">
      {keys.length > 0 && <div className="tbl-wrap"><table className="rp"><thead><tr><th>교과군</th>{keys.map(k => <th key={k} style={{ textAlign: "center" }}>{k}</th>)}</tr></thead><tbody>
        {GROUPS.map(gp => <tr key={gp}><td>{gp}</td>{keys.map(k => <td key={k} style={{ textAlign: "center" }}><Lv v={cell(gp, k)} /></td>)}</tr>)}
        <tr className="tot"><td>국영수사과</td>{keys.map(k => <td key={k} style={{ textAlign: "center" }}><Lv v={core(k)} /></td>)}</tr>
        <tr className="tot"><td>전과목</td>{keys.map(k => <td key={k} style={{ textAlign: "center" }}><Lv v={all(k)} /></td>)}</tr></tbody></table></div>}
      <div className="note">※ {is2022 ? "5등급제" : "9등급제"} 학점 가중 평균. 1·2등급(5등급제는 1등급) 과목 {top}개 / 석차등급 과목 {grades.filter(r => r.lv > 0).length}개.</div>
    </Sec>
    <Sec n="1.3" title="이수과목 현황">
      <div className="tbl-wrap"><table className="rp"><thead><tr><th>교과군</th><th>1학년</th><th>2학년</th><th>3학년</th></tr></thead><tbody>
        {[...GROUPS, "기타"].map(gp => { const rows = [1, 2, 3].map(n => ({ list: grades.filter(r => gOf(r) === gp && r.g === n), ach: ach.filter(a => (+a.gN || parseInt(a.grade)) === n && (GROUPS.includes(a.group) ? a.group : "기타") === gp) }));
          if (rows.every(r => !r.list.length && !r.ach.length)) return null;
          return <tr key={gp}><td>{gp}</td>{rows.map((r, i) => <td key={i}>{r.list.map((x, j) => <span key={j} className="sub-chip">{x.subject}<em>{x.lv || "-"}</em></span>)}{r.ach.map((x, j) => <span key={"a" + j} className="sub-chip opt">{x.subject}<em>{x.achievement}</em></span>)}</td>)}</tr>; })}</tbody></table></div>
      <div className="note">※ 숫자는 석차등급, 점선 칸은 진로선택과목(성취도).</div>
      {cr?.summary && <p className="rp-p" style={{ marginTop: 12 }}>{rich(cr.summary)}</p>}
      {!!cr?.byUniv?.length && <div className="tbl-wrap"><table className="rp"><thead><tr><th>대학·학과</th><th>관련 이수 교과</th>{!(G.curriculum || "").includes("2015") && <th>권장과목 충족</th>}<th>해설</th></tr></thead><tbody>
        {cr.byUniv.map((u, i) => <tr key={i}><td>{u.univ} {u.dept}</td><td>{(u.satisfied || u.matched || []).slice(0, 8).join(", ")}{(u.missing || []).length > 0 && <div className="note">보완: {u.missing.slice(0, 4).join(", ")}</div>}</td>{!(G.curriculum || "").includes("2015") && <td>{u.rate != null ? u.rate + "%" : "-"}</td>}<td>{rich(firstSentence(u.analysis, 130))}</td></tr>)}</tbody></table></div>}
    </Sec>
    <Sec n="1.4" title="종합 해설">
      <P t={G.gradeAnalysis?.overall} />{G.gradeAnalysis?.majorLink && <><h5 className="rp-h5">전공 연계 교과</h5><P t={G.gradeAnalysis.majorLink} /></>}
    </Sec>
  </Doc>);
}

/* ───────── 2. 탐구 계보를 통한 추천학과 ───────── */
const ROW_ORDER = ["진로", "동아리", "자율", "봉사", "국어", "수학", "영어", "사회", "과학", "정보·기술", "예체능", "기타"];
function LineageTab({ G, name }) {
  const [sel, setSel] = useState(null);
  const acts = useMemo(() => (G.activities || []).map((a, i) => {
    const g = +a.gN || parseInt(a.year) || 1; let s = +a.sN || parseInt(a.semester) || 1; if (s !== 1 && s !== 2) s = 1;
    let row = a.subject || ""; if (/자율|동아리|진로|봉사/.test(a.type || "") && !/세특/.test(a.type)) row = (a.type.match(/자율|동아리|진로|봉사/) || [""])[0];
    if (!ROW_ORDER.includes(row)) row = /정보|기술|가정/.test(row) ? "정보·기술" : /예|체|음악|미술/.test(row) ? "예체능" : (ROW_ORDER.includes((a.type || "").slice(0, 2)) ? (a.type || "").slice(0, 2) : "기타");
    return { ...a, i, key: `${g}-${s}`, row, depthN: Math.min(4, Math.max(1, parseInt(a.depth) || 1)) };
  }), [G]);
  const cols = ["1-1", "1-2", "2-1", "2-2", "3-1"].concat(acts.some(a => a.key === "3-2") ? ["3-2"] : []);
  const rows = ROW_ORDER.filter(r => acts.some(a => a.row === r)); const counts = cols.map(c => acts.filter(a => a.key === c).length);
  const gradeKeys = [...new Set((G.grades || []).map(r => `${+r.gN || parseInt(r.grade)}-${+r.sN || parseInt(r.semester)}`))];
  const missing = cols.filter((c, i) => counts[i] === 0 && gradeKeys.includes(c));
  const selA = sel != null ? acts.find(a => a.i === sel) : null; const hot = selA && selA.topicKey ? acts.filter(a => a.topicKey && a.topicKey === selA.topicKey).map(a => a.i) : [];
  const threads = G.inquiryThreads || []; const majors = G.recommendedMajors || []; const cnt = (k, v) => acts.filter(a => a[k] === v).length; const hasLevel = acts.some(a => a.level);
  const avgDepth = acts.length ? acts.reduce((a, x) => a + x.depthN, 0) / acts.length : 0;
  const CM = useMemo(() => connectionMetrics(G), [G]); const CA = G.connectionAnalysis || {};
  const ORD = ["미흡", "보통", "양호", "우수"]; const cons = (a, b) => { const x = ORD.indexOf(a), y = ORD.indexOf(b); return x < 0 ? b || a : y < 0 ? a : ORD[Math.min(x, y)]; };
  const vV = cons(CM.verdict.vertical, CA.vertical?.verdict), vH = cons(CM.verdict.horizontal, CA.horizontal?.verdict);
  return (<Doc no="2" title="탐구 계보를 통한 추천학과" lead="학기를 건너 이어진 관심의 줄기와 깊이·수준을 읽고, 그 줄기가 가리키는 학과를 제시합니다." name={name} G={G}>
    <Sum items={[<>추출된 탐구 기록 <b>{acts.length}건</b>, 평균 탐구 깊이 <b>{avgDepth ? avgDepth.toFixed(1) : "-"}단계</b>(4단계 만점), 2학기 이상 이어진 줄기 <b>{threads.length}개</b>임.</>,
      hasLevel ? <>내용 수준은 교과 기본 {cnt("level", "기본")}건 · 교과 심화 {cnt("level", "심화")}건 · 대학 전공 {cnt("level", "전공")}건이며, 희망 학과군 적정 수준에 부합하는 기록은 {cnt("levelFit", "적정")}건임.</> : null,
      majors[0] ? <>탐구가 가장 뚜렷하게 가리키는 학과는 <b>{majors[0].major}</b>{majors[1] ? `, 다음으로 ${majors[1].major}` : ""}임.</> : null]} />
    {missing.length > 0 && <div className="callout bad"><b>기록 누락 의심 · </b>{missing.join(", ")}에 성적은 있으나 탐구 기록이 추출되지 않았습니다. 원문에 세특이 있다면 HTML(.htm)로 다시 올리거나 파일을 확인해 주세요.</div>}
    <Sec n="2.1" title="학기별 탐구 기록과 깊이">
      {acts.length > 0 && <Fig no="3" cap="학기별 탐구 기록 수와 깊이 분포(1단계 정리·참여 ~ 4단계 성찰·확장)"><DepthBars cols={cols} acts={acts} /></Fig>}
      <div className="note">깊이는 «수행 방법»의 단계이고, 아래 2.3의 수준은 «내용의 난도»입니다. 두 축을 함께 봐야 합니다.</div>
    </Sec>
    <Sec n="2.2" title="탐구 계보도">
      {acts.length ? <div className="lineage-wrap"><div className="lineage" style={{ gridTemplateColumns: `64px repeat(${cols.length},minmax(150px,1fr))` }}>
        <div />{cols.map((c, i) => <div key={c} className="lh">{c.replace("-", "학년 ")}학기 · {counts[i]}건</div>)}
        {rows.map(r => (<React.Fragment key={r}><div className="lrow">{r}</div>{cols.map(c => <div key={c} className="lcell">{acts.filter(a => a.row === r && a.key === c).map(a => (
          <button key={a.i} className={`lcard d${a.depthN}${sel === a.i ? " sel" : ""}${sel != null && sel !== a.i && !hot.includes(a.i) ? " dim" : ""}`} onClick={() => setSel(sel === a.i ? null : a.i)}>
            <small>{a.subjectName || a.type || a.row}</small> <Depth n={a.depthN} /><b>{a.title}</b><LvlTag a={a} />
            {a.linkType && a.linkType !== "없음" && <span className={`link ${a.linkType}`}>{a.linkType}{a.linkFrom ? ` ← ${a.linkFrom}` : ""}</span>}</button>))}</div>)}</React.Fragment>))}
      </div></div> : <div className="rp-empty">탐구 기록을 추출하지 못했습니다.</div>}
      <div className="note">카드를 누르면 같은 관심 주제로 이어진 기록이 강조되고 상세 내용이 열립니다. 막대 ▂▄▆█ = 깊이 1~4단계, 심화·확장·전환·반복 = 앞선 기록과의 연결 종류.</div>
    </Sec>
    <Sec n="2.3" title="탐구 수준 진단">
      <p className="rp-p">탐구 수준은 교과 기본 → 교과 심화 → 대학 전공 수준으로 나뉘며, 대부분의 학과군에서 면접의 깊이 있는 질문이 집중되는 적정 구간은 «교과 심화 수준 + 직접 설명 가능»입니다(모두의 진학, 면접 질문 2,491건 분석).</p>
      {hasLevel ? <div className="tbl-wrap"><table className="rp"><thead><tr><th>구분</th><th>건수</th><th>의미</th></tr></thead><tbody>
        {[["내용 수준", "교과 기본", cnt("level", "기본"), "교과서 개념 정리·소개 — 개념 정의를 정확히 말하면 충분"], ["내용 수준", "교과 심화", cnt("level", "심화"), "Ⅱ·진로선택 개념을 실험·계산·모델링에 적용"], ["내용 수준", "대학 전공", cnt("level", "전공"), "직접 유도·설명할 수 있을 때만 강점"],
          ["적합도", "적정", cnt("levelFit", "적정"), "희망 학과군 적정 수준에 부합"], ["적합도", "과소", cnt("levelFit", "과소"), "교과 기본 반복·기사 수준 인용"], ["적합도", "과잉", cnt("levelFit", "과잉"), "전공 용어 나열, 직접 설명 근거 부족"]].map((r, i) => <tr key={i}><td>{r[0]} · {r[1]}</td><td className="mono">{r[2]}건</td><td>{r[3]}</td></tr>)}</tbody></table></div> : <div className="rp-empty">활동별 탐구 수준 판정 데이터가 없습니다.</div>}
      {(G._levelInfo || []).map((g, i) => (<div className="rp-box" key={i}><h5 className="rp-h5">{g.name} <small>({g.fam})</small> — 이 학과군 지원자가 면접에서 질문받은 탐구 기준</h5>
        <p className="rp-p"><b>적정 수준 · </b>{rich(g.proper)}</p>{g.adjust && <p className="rp-p"><b>수준 조절 · </b>{rich(g.adjust)}</p>}{g.caution && <p className="rp-p"><b>주의 · </b>{rich(g.caution)}</p>}
        {g.examples && <details><summary>좋은 평가를 받는 탐구 예시</summary><p className="rp-p">{rich(g.examples)}</p></details>}</div>))}
      {!(G._levelInfo || []).length && <div className="note">희망 대학·학과를 입력하면 해당 학과군의 적정 탐구 수준 기준이 함께 표시됩니다.</div>}
    </Sec>
    <Sec n="2.4" title="종적·횡적 연결 분석">
      <p className="rp-p">종적 연결은 같은 주제가 학기·학년을 건너 어떻게 깊어졌는지, 횡적 연결은 같은 시기에 서로 다른 교과·창체가 같은 주제를 어떻게 함께 다뤘는지를 뜻함. 두 연결이 모두 확인되고 수준이 적정할 때 전공 적합성과 탐구 신뢰도가 함께 높게 평가됨.</p>
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 90 }}>구분</th><th style={{ width: 70 }}>판정</th><th style={{ width: "30%" }}>판정(코드 산정과 AI 판단 중 보수적인 쪽)</th><th>해설</th></tr></thead><tbody>
        <tr><td>종적 연결</td><td><b className="tier-t">{vV}</b></td><td>줄기 {CM.vertical.length}개 · 깊이 상승 {CM.vertical.filter(v => v.trend === "상승").length}개 · 줄기에 속한 기록 {Math.round(CM.coverage * 100)}%</td><td>{CA.vertical?.comment ? rich(CA.vertical.comment) : "-"}</td></tr>
        <tr><td>횡적 연결</td><td><b className="tier-t">{vH}</b></td><td>같은 학기 2개 이상 교과가 한 주제를 다룬 사례 {CM.horizontal.length}건</td><td>{CA.horizontal?.comment ? rich(CA.horizontal.comment) : "-"}</td></tr>
        <tr><td>탐구 수준</td><td><b className="tier-t">{CA.level?.verdict || (hasLevel ? (cnt("levelFit", "과잉") >= 2 ? "과잉" : cnt("levelFit", "적정") >= Math.ceil(acts.length / 2) ? "적정" : "과소") : "-")}</b></td><td>심화 이상 {cnt("level", "심화") + cnt("level", "전공")}건 · 적정 {cnt("levelFit", "적정")}건 · 과소 {cnt("levelFit", "과소")}건 · 과잉 {cnt("levelFit", "과잉")}건</td><td>{CA.level?.comment ? rich(CA.level.comment) : "-"}</td></tr></tbody></table></div>
      <h5 className="rp-h5">종적 연결 — 주제별 경로</h5>
      {CM.vertical.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: "13%" }}>주제</th><th>경로(학기 · 교과 · 활동)</th><th style={{ width: 96 }}>깊이 변화</th><th style={{ width: 62 }}>추세</th><th style={{ width: "26%" }}>평가</th></tr></thead><tbody>
        {CM.vertical.map((v, i) => { const th = threads.find(t => t.theme === v.topic); return <tr key={i}><td><b>{v.topic}</b><div className="note">교과 이동 {v.moves}회</div></td>
          <td>{v.path.map((s, j) => <div key={j} className="rp-step">{String(s.key).replace("-", "학년 ")}학기 · {s.subj}{s.title ? ` · ${s.title}` : ""} <Depth n={s.d} /></div>)}</td>
          <td className="mono">{v.depths.join(" → ")}</td><td><b style={{ color: v.trend === "상승" ? "#2f9e6f" : v.trend === "하락" ? "#d2495a" : "#8b8478" }}>{v.trend}{v.lastDrop ? " ▼" : ""}</b></td><td>{th?.verdict ? rich(th.verdict) : (v.lastDrop ? "마지막 단계 깊이가 앞 단계보다 낮아짐." : "-")}</td></tr>; })}</tbody></table></div>
        : <div className="rp-empty">여러 학기에 걸쳐 이어진 탐구 줄기가 확인되지 않음. 활동이 학기마다 흩어져 있다는 신호임.</div>}
      <h5 className="rp-h5">횡적 연결 — 같은 시기 다른 교과의 주제 공유</h5>
      {CM.horizontal.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 110 }}>학기</th><th style={{ width: "18%" }}>주제</th><th>함께 다룬 교과</th></tr></thead><tbody>
        {CM.horizontal.sort((a, b) => a.key.localeCompare(b.key)).map((h, i) => <tr key={i}><td>{h.key.replace("-", "학년 ")}학기</td><td><b>{h.topic}</b></td><td>{h.subjects.join(" · ")}</td></tr>)}</tbody></table></div>
        : <div className="rp-empty">같은 학기에 서로 다른 교과가 같은 주제를 함께 다룬 사례가 확인되지 않음. 교과 융합·창체 연계가 드러나지 않는 상태임.</div>}
      {CM.isolated.length > 0 && <p className="rp-p" style={{ marginTop: 12 }}><b>줄기 밖 고립 기록 {CM.isolated.length}건 · </b>{CM.isolated.slice(0, 8).map(a => `${a.key.replace("-", "·")} ${a.subj}「${a.title}」`).join(", ")}{CM.isolated.length > 8 ? " 외" : ""}. 앞뒤 기록과 이어지지 않은 단발 활동은 전공 적합성 근거로 약하게 작용함.</p>}
      {CA.overall && <div className="rp-box"><h5 className="rp-h5">탐구 종합 의견</h5><p className="rp-p">{rich(CA.overall)}</p></div>}
      {G.activityInsight?.continuity && !CA.overall && <p className="rp-p"><b>연속성 평가 · </b>{rich(G.activityInsight.continuity)}</p>}
    </Sec>
    <Sec n="2.5" title="추천학과">
      {majors.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 44 }}>순위</th><th style={{ width: "17%" }}>추천 학과</th><th style={{ width: 84 }}>적합도</th><th>근거</th><th style={{ width: "20%" }}>관련 이수 교과</th></tr></thead><tbody>
        {majors.slice(0, 5).map((m, i) => <tr key={i}><td className="mono">{i + 1}</td><td><b>{m.major}</b></td><td>{fitWord(m.score)}</td><td>{rich(firstSentence(m.reason, 190))}</td><td>{(m.matchedSubjects || []).slice(0, 5).join(", ")}</td></tr>)}</tbody></table></div> : <div className="rp-empty">추천학과 데이터가 없습니다.</div>}
      <div className="note">※ 추천학과는 이수과목·세특·탐구 줄기를 종합한 «적합도»이며 합격 가능성이 아닙니다. 합격 가능성은 4장에서 다룹니다.</div>
    </Sec>
    {selA && <aside className="drawer"><button className="mini-btn" style={{ float: "right" }} onClick={() => setSel(null)}>닫기 ✕</button>
      <div className="pg-eye">{selA.key.replace("-", "학년 ")}학기 · {selA.subjectName || selA.row}</div><h3 style={{ fontSize: 19, margin: "4px 0 8px" }}>{selA.title}</h3>
      <div style={{ marginBottom: 10 }}><Depth n={selA.depthN} /> 깊이 {selA.depthN}단계 {selA.linkType && selA.linkType !== "없음" && <span className={`link ${selA.linkType}`}>{selA.linkType}{selA.linkFrom ? ` ← ${selA.linkFrom}` : ""}</span>}</div>
      {selA.level && <p className="rp-p"><b>탐구 수준 · </b><LvlTag a={selA} /> {selA.levelNote}</p>}
      {(selA.methods || []).length > 0 && <p className="rp-p"><b>방법 · </b>{selA.methods.join(", ")}</p>}
      <P t={selA.content} />{selA.motivation && <p className="rp-p"><b>동기 · </b>{rich(selA.motivation)}</p>}{selA.process && <p className="rp-p"><b>과정 · </b>{rich(selA.process)}</p>}{selA.growth && <p className="rp-p"><b>성장 · </b>{rich(selA.growth)}</p>}</aside>}
  </Doc>);
}

/* ───────── 3. 역량 분석 ───────── */
function CompTab({ G, name, total }) {
  const comps = G.competencies || {}; const S = G.strengths || [], W = G.weaknesses || [];
  const overall = tierOf(total, 100); const lv = COMP.map(([k, n]) => ({ k, n, d: comps[k] || {}, t: tierOf(comps[k]?.score, MAXES[k]) }));
  return (<Doc no="3" title="역량 분석" lead="점수 대신, 각 역량이 «어느 대학 그룹 수준»에 해당하는지와 그 근거(＋/－)를 제시합니다." name={name} G={G}>
    <Sum items={[<>5대 역량을 종합한 수준은 <b>{overall.label}</b>({overall.ex}) 임.</>, G.scoreSummary ? rich(G.scoreSummary) : null,
      <>가장 강한 역량은 <b>{[...lv].sort((a, b) => a.t.idx - b.t.idx)[0]?.n}</b>, 가장 보완이 필요한 역량은 <b>{[...lv].sort((a, b) => b.t.idx - a.t.idx)[0]?.n}</b>임.</>]} />
    <Sec n="3.1" title="종합 수준 판정">
      <div className="grid split"><Fig no="4" cap="대학 그룹 수준 사다리 — 현재 위치"><TierLadder idx={overall.idx} sub={overall.sub} steps={TIER_STEPS} /></Fig>
        <Fig no="5" cap="5대 역량의 수준 프로파일(바깥일수록 높은 수준)"><Radar values={lv.map(x => ({ label: x.n.replace("역량", ""), value: Math.max(8, 100 - x.t.idx * 18), text: x.t.short }))} size={280} /></Fig></div>
    </Sec>
    <Sec n="3.2" title="역량별 수준과 근거">
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: "14%" }}>역량</th><th style={{ width: "15%" }}>수준</th><th>플러스(＋) 근거</th><th>마이너스(－) 근거</th></tr></thead><tbody>
        {lv.map(x => { const b = x.d.scoreBreakdown || {}; return <tr key={x.k}><td><b>{x.n}</b></td><td><b className="tier-t">{x.t.shortLabel}</b></td>
          <td><ul className="rp-ul g">{(b.plusFactors || []).map((p, i) => <li key={i}>{rich(p.reason)}</li>)}</ul></td>
          <td><ul className="rp-ul r">{(b.minusFactors || []).map((p, i) => <li key={i}>{rich(p.reason)}</li>)}{!(b.minusFactors || []).length && <li className="none">확인된 감점 요인 없음</li>}</ul></td></tr>; })}</tbody></table></div>
    </Sec>
    <Sec n="3.3" title="역량별 해설">
      {lv.map(x => { const b = x.d.scoreBreakdown || {}; return (<div key={x.k} className="rp-item"><h5 className="rp-h5">{x.n} — {x.t.label}{b.final ? <small> · {rich(b.final)}</small> : null}</h5>
        <P t={x.d.detail} />{(x.d.evidenceList || []).length > 0 && <ul className="rp-quote">{x.d.evidenceList.slice(0, 3).map((e, i) => <li key={i}>{rich(e)}</li>)}</ul>}</div>); })}
    </Sec>
    <Sec n="3.4" title="산정 근거 — 코드가 직접 센 항목(학업·탐구)">
      <p className="rp-p">학업역량과 탐구역량은 AI의 인상이 아니라 아래 항목을 코드가 세어 기본 수준을 정하고, AI는 한 단계 안에서만 보정합니다. 같은 학생부는 항상 같은 기본 수준이 나옵니다.</p>
      <div className="grid g2">{["academic", "inquiry"].map(k => comps[k]?.quant ? (<div key={k} className="rp-box"><h5 className="rp-h5">{k === "academic" ? "학업역량" : "탐구역량"} — 기준 수준 {tierOf(comps[k].quant.base, MAXES[k]).label}</h5>
        <ul className="rp-ul">{comps[k].quant.rows.map((r, i) => <li key={i} className={i > 0 && r.pts > 0 ? "g" : r.pts < 0 ? "r" : ""}>{i === 0 ? "기준 · " : r.pts > 0 ? "▲ " : "▼ "}{r.label}</li>)}{(comps[k].quant.caps || []).map((x, i) => <li key={"c" + i} className="r">▼ 상한 · {x}</li>)}</ul>
        <div className="note">AI 판단은 기준 수준에서 한 단계 이내로만 반영됩니다{comps[k].quant.ai !== comps[k].quant.final ? " (이번에는 보정이 적용됨)" : ""}.</div></div>) : null)}</div>
    </Sec>
    <Sec n="3.5" title="수준 판정 기준표">
      <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: "14%" }}>역량</th><th>산정 방식</th><th style={{ width: "42%" }}>수준 기준</th></tr></thead><tbody>
        {RUBRIC_TABLE.map(r => <tr key={r.key}><td><b>{r.name}</b><div className="note">현재 {tierOf(comps[r.key]?.score, MAXES[r.key]).shortLabel}</div></td><td>{r.how}</td>
          <td><ul className="rp-ul">{r.bands.map((b, i) => <li key={i}><b>{b[0]}</b> — {b[1]}</li>)}</ul></td></tr>)}</tbody></table></div>
      <div className="note">※ 대학 그룹은 1장 합격선 지도와 같은 구분(최상위권·상위권·중상위권·중위권·거점국립대)을 따릅니다. 학종 평가는 대학·전형·학과마다 다르므로 «참고 수준»입니다.</div>
    </Sec>
    <Sec n="3.6" title="강점과 보완점">
      <div className="grid g2"><div className="rp-box g"><h5 className="rp-h5">＋ 강점</h5>{S.length ? <ul className="rp-ul">{S.map((s, i) => <li key={i}><b>{s.title}</b> — {rich(firstSentence(s.content, 150))}{s.highlight && <div className="note">입시에서의 의미: {rich(s.highlight)}</div>}</li>)}</ul> : <div className="note">없음</div>}</div>
        <div className="rp-box r"><h5 className="rp-h5">－ 보완점</h5>{W.length ? <ul className="rp-ul">{W.map((s, i) => <li key={i}><b>{s.title}</b> — {rich(firstSentence(s.content, 150))}{s.suggestion && <div className="note">보완 방법: {rich(s.suggestion)}</div>}</li>)}</ul> : <div className="note">없음</div>}</div></div>
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
  return (<Doc no="4" title="희망학과·대학 유불리" lead="내신 숫자만이 아니라 정성평가 기준(관련교과·탐구 깊이와 수준·공동체)을 우선해 판단했습니다." name={name} G={G}>
    <Sum items={[T.recommendedTier ? <>현실적인 지원 라인은 <b>{rich(T.recommendedTier)}</b>임.</> : null, T.studentLevel ? rich(firstSentence(T.studentLevel, 150)) : null,
      dept[0] ? <>1순위 희망 <b>{dept[0].univ} {dept[0].dept}</b>의 종합 판정은 <b>{dept[0].overall?.verdict}</b>임.</> : <>희망 대학·학과가 입력되지 않아 «희망학과 분석»은 생략되었습니다.</>]} />
    <div className="callout warn"><b>읽는 법 · </b>합격가능성은 서류 기준의 <b>보수적 추정치</b>입니다. 면접이 있는 전형은 결과에 따라 크게 달라질 수 있고, 인용된 합격선에는 특목·자사고 지원자도 섞여 있어 일반고 학생에게는 더 엄격하게 봐야 합니다.</div>
    <Sec n="4.1" title="희망학과 분석">
      {dept.length ? dept.map((d, i) => { const gv = d.gradeView || d.gradeAnalysis?.trend, mv = d.majorGradeView || d.gradeAnalysis?.relatedSubjects, iv = d.inquiryView || d.activityFit?.detail, op = d.opinion || d.letter;
        return (<div className="rp-box" key={i}><h5 className="rp-h5">{d.rank || i + 1}순위 · {d.univ} {d.dept}</h5>
        <div className="tbl-wrap"><table className="rp kv"><tbody>
          <tr><td>종합 판정</td><td><b>{d.overall?.verdict}</b> — {rich(d.overall?.summary)}</td></tr>
          {d.univProfile && <tr><td>지원 대학 특성</td><td>{rich(d.univProfile)}</td></tr>}
          {gv && <tr><td>교과 성적</td><td>{rich(gv)}</td></tr>}
          {mv && <tr><td>학과 관련 성적</td><td>{rich(mv)}</td></tr>}
          {iv && <tr><td>탐구 수준·연결</td><td>{rich(iv)}</td></tr>}</tbody></table></div>
        {(d.qualGaps || []).length > 0 && <><h5 className="rp-h5">정성 평가 — 부족한 부분과 보완 방향</h5><div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 110 }}>영역</th><th>부족한 점</th><th style={{ width: "34%" }}>보완 방향</th></tr></thead><tbody>
          {d.qualGaps.map((g, j) => <tr key={j}><td><b>{g.area}</b></td><td>{rich(g.gap)}</td><td>{rich(g.fix)}</td></tr>)}</tbody></table></div></>}
        <div className="grid g2" style={{ marginTop: 8 }}><div><h5 className="rp-h5">유리한 점</h5><ul className="rp-ul g">{(d.pros || []).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></div><div><h5 className="rp-h5">불리한 점</h5><ul className="rp-ul r">{(d.cons || []).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></div></div>
        {(d.strategy?.전형추천 || (d.strategy?.key3 || []).length > 0) && <p className="rp-p"><b>추천 전형 · </b>{d.strategy?.전형추천}{(d.strategy?.key3 || []).length > 0 && <> <b style={{ marginLeft: 8 }}>핵심 보완 · </b>{d.strategy.key3.map((x, j) => `${j + 1}) ${x}`).join("  ")}</>}</p>}
        {op && <div className="rp-opinion"><h5 className="rp-h5">종합 의견</h5><p className="rp-p">{rich(op)}</p></div>}
        {(d.gradeAnalysis?.relatedSubjects && !d.majorGradeView) && <details><summary>이전 형식의 상세 분석</summary>{[["활동·탐구", d.activityFit?.detail], ["역량", d.competencyFit?.detail], ["합격 전략", d.strategy?.actionPlan]].map(([t, x], j) => x ? <div key={j}><h5 className="rp-h5">{t}</h5><P t={x} /></div> : null)}</details>}
      </div>); })
        : <div className="rp-empty">희망 대학·학과를 입력하지 않아 이 구간은 비어 있음. 아래 ‘대학 유불리’는 입력과 무관하게 제공됨.</div>}
    </Sec>
    <Sec n="4.2" title="대학 유불리 비교">
      {T.studentLevel && <p className="rp-p"><b>현재 위치 · </b>{rich(T.studentLevel)}</p>}
      {cmp && <Fig no="6" cap="티어별 참고 합격선(특목·자사고가 섞인 평균)과 내 평균등급 — 점 위에 올리면 대학명이 보입니다"><PositionMap tiers={cmp.filter(t => !/교대/.test(t.tier))} student={parseFloat(G.gradeAvg) || null} is5={is2022} /></Fig>}
      {(cmp || []).map((tier, ti) => { const ta = (T.tiers || []).find(t => t.tier === tier.tier); return (<div className="rp-tier" key={ti} style={{ borderLeftColor: tier.color }}>
        <div className="rp-tier-h"><b style={{ color: tier.color }}>{tier.tier}</b><span className="note">{tier.desc}</span>{ta && <span className={`tag ${verdictTone(ta.verdict)}`}>{ta.verdict}</span>}{ta?.admissionProbability?.min != null && <div style={{ marginLeft: "auto", minWidth: 180 }}><RangeBar min={ta.admissionProbability.min} max={ta.admissionProbability.max} color={tier.color} /></div>}</div>
        {ta?.reason && <P t={ta.reason} />}{ta?.strategy && <p className="rp-p"><b>전형·전략 · </b>{rich(ta.strategy)}</p>}
        <div className="note" style={{ marginTop: 6 }}>해당 대학(참고컷): {tier.univs.map(u => `${u.name}${!u.artsNote ? " " + (u.cutShow || u.cut) : "(실기)"}`).join(" · ")}</div></div>); })}
    </Sec>
    <Sec n="4.3" title="지원 검토 순서(추천 순위)">
      {ranks.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 44 }}>순위</th><th>대학·학과</th><th style={{ width: 64 }}>판정</th><th style={{ width: 160 }}>추정 합격가능성</th><th>근거</th></tr></thead><tbody>
        {ranks.map((r, i) => <tr key={i}><td className="mono">{r.rank || i + 1}</td><td><b>{r.univ}</b><div className="note">{r.recommendedDept}</div></td><td>{r.verdict}</td><td><RangeBar min={r.admissionProbability?.min} max={r.admissionProbability?.max} color="#0f9a90" /></td><td>{rich(firstSentence(r.reason, 140))}</td></tr>)}</tbody></table></div> : <div className="rp-empty">추천 순위 데이터가 없습니다.</div>}
      {top?.univs?.length > 0 && <details><summary>주요 상위 10개 대학 개별 비교</summary><div className="tbl-wrap"><table className="rp"><thead><tr><th>대학</th><th>판정</th><th>합격가능성</th><th>추천 전형</th><th>평가</th></tr></thead><tbody>
        {top.univs.map((u, i) => <tr key={i}><td><b>{u.univ}</b></td><td>{u.verdict}</td><td className="mono">{u.admissionProbability ? `${u.admissionProbability.min}~${u.admissionProbability.max}%` : "-"}</td><td>{u.전형추천}</td><td>{rich(firstSentence(u.summary, 120))}</td></tr>)}</tbody></table></div>{top.advice && <P t={top.advice} />}</details>}
    </Sec>
  </Doc>);
}

/* ───────── 5. 종합 리포트 ───────── */
function FinalTab({ G, name, total, onExport }) {
  const F = G.finalRecommendation || {}; const E = G.executiveSummary || {}; const overall = tierOf(total, 100);
  const strengths = E.strengths?.length ? E.strengths : (G.strengths || []).slice(0, 3).map(s => s.title);
  const risks = E.risks?.length ? E.risks : (G.weaknesses || []).slice(0, 3).map(s => s.title);
  const actions = E.actions?.length ? E.actions : (G.deptReports?.[0]?.strategy?.key3 || []);
  return (<Doc no="5" title="종합 리포트" lead="어느 대학·학과를 어떤 전형으로 지원하는 것이 현실적인가에 대한 최종 의견입니다." name={name} G={G}>
    <Sum items={[<>{rich(E.headline || firstSentence(G.studentType, 120))}</>, <>종합 수준 판정: <b>{overall.label}</b> ({overall.ex})</>, F.top10?.[0] ? <>우선 검토할 지원: <b>{F.top10[0].univ} {F.top10[0].dept}</b> · {F.top10[0].admissionType}</> : null]} />
    <Sec n="5.1" title="핵심 진단">
      <div><Fig no="7" cap="종합 수준 판정"><TierLadder idx={overall.idx} sub={overall.sub} steps={TIER_STEPS} /></Fig><div className="tbl-wrap" style={{marginTop:14}}><table className="rp"><thead><tr><th>강점(＋)</th><th>리스크(－)</th><th>지금 할 일</th></tr></thead><tbody><tr>
        {[strengths, risks, actions].map((l, i) => <td key={i}><ul className={`rp-ul ${i === 0 ? "g" : i === 1 ? "r" : ""}`}>{(l || []).slice(0, 3).map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></td>)}</tr></tbody></table></div></div>
    </Sec>
    <Sec n="5.2" title="이렇게 지원하는 것을 추천합니다">
      {F.interviewCaveat && <div className="callout warn">🎤 <b>면접 유의 · </b>{rich(F.interviewCaveat)}</div>}
      {F.top10?.length ? <div className="tbl-wrap"><table className="rp"><thead><tr><th style={{ width: 40 }}>순위</th><th>대학·학과</th><th>전형</th><th style={{ width: 60 }}>라인</th><th style={{ width: 150 }}>추정 합격가능성</th><th>근거</th></tr></thead><tbody>
        {F.top10.map((r, i) => <tr key={i}><td className="mono">{r.rank || i + 1}</td><td><b>{r.univ}</b><div className="note">{r.dept}</div></td><td>{r.admissionType}{r.hasInterview && " 🎤"}</td><td>{r.tier}</td>
          <td><RangeBar min={r.admissionProbability?.min} max={r.admissionProbability?.max} color={r.tier === "안정" ? "#2f9e6f" : r.tier === "적정" ? "#0f9a90" : r.tier === "소신" ? "#f0a931" : "#d2495a"} /></td><td>{rich(firstSentence(r.reason, 120))}</td></tr>)}</tbody></table></div> : <div className="rp-empty">최종 추천 데이터가 없습니다.</div>}
      <div className="note">🎤 면접 포함 전형 · 확률은 서류 기준 보수적 추정이며 실제 결과는 이보다 낮거나 높을 수 있습니다.</div>
    </Sec>
    {F.avoid?.length > 0 && <Sec n="5.3" title="현재로선 피하는 것이 좋은 대학·학과"><div className="callout bad">{F.avoid.map((a, i) => <p key={i} className="rp-p" style={{ margin: "0 0 6px" }}><b>{a.univ}{a.dept ? ` · ${a.dept}` : ""}</b> — {rich(a.reason)}</p>)}</div></Sec>}
    <Sec n={F.avoid?.length ? "5.4" : "5.3"} title="상담 의견">
      {G.summaryLetter ? <div className="letter">{rich(G.summaryLetter)}</div> : <div className="rp-empty">편지 데이터가 없습니다.</div>}
      {G.reportLetter && <details><summary>상세 상담 편지 전문</summary><div className="letter" style={{ marginTop: 10 }}>{rich(G.reportLetter)}</div></details>}
    </Sec>
    <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 22 }}><button className="mini-btn" onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button><button className="mini-btn" onClick={onExport}>📝 워드(.doc) 내보내기</button></div>
  </Doc>);
}

export default function Report({ G, name, total, grd, inMajor, onReset, onExport }) {
  const [tab, setTab] = useState(0); const go = i => { setTab(i); window.scrollTo({ top: 0 }); }; const overall = tierOf(total, 100);
  const body = [<GradesTab G={G} name={name} major={inMajor} />, <LineageTab G={G} name={name} />, <CompTab G={G} name={name} total={total} />, <DiagTab G={G} name={name} major={inMajor} />, <FinalTab G={G} name={name} total={total} onExport={onExport} />][tab];
  return (<div className="shell">
    <aside className="rail">
      <div className="logo-pill"><span className="brand-dot">RI</span>리포트아이</div>
      <div className="who"><small>{G.schoolName || ""}</small><h3>{name}</h3><div className="who-tier">{overall.label}</div><p>{overall.ex}</p></div>
      <nav className="nav">{TABS.map((t, i) => <button key={i} className={tab === i ? "on" : ""} onClick={() => go(i)}><b>{i + 1}</b>{t}</button>)}</nav>
      <div className="rail-foot no-print"><button className="mini-btn" onClick={onExport}>📝 워드로 저장</button><button className="mini-btn" onClick={() => window.print()}>🖨 인쇄</button><button className="mini-btn" onClick={onReset}>← 새 분석</button></div>
    </aside>
    <main className="main">{body}</main>
    <nav className="dock">{TABS.map((t, i) => <button key={i} className={tab === i ? "on" : ""} onClick={() => go(i)}><b>{i + 1}</b>{["성적", "계보", "역량", "입시", "종합"][i]}</button>)}</nav>
  </div>);
}
