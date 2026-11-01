import React, { useState, useMemo } from "react";
import { rich, firstSentence, getMajorRelatedGroups, lvN, verdictTone, Depth } from "./util.jsx";
import { compareAllUnivs } from "../prediction2028.js";

const TABS=[["성적 · 이수","성적과 이수과목"],["탐구 계보","탐구의 줄기와 추천학과"],["역량 분석","플러스·마이너스로 본 역량"],["입시 진단","희망학과 · 대학 유불리"],["종합 리포트","최종 결론"]];
const COMP=[["academic","학업역량",40,"#3a34a8"],["inquiry","탐구역량",25,"#14a38b"],["career","진로역량",15,"#e49a1c"],["community","공동체역량",10,"#ef5f6b"],["growth","성장역량",10,"#7a6df0"]];
const GROUPS=["국어","수학","영어","사회","과학"];
const GRADE_LABEL={S:"최우수",A:"우수",B:"양호",C:"보통",D:"미흡"};

const Head=({eye,title,sub})=>(<div className="pg-head"><div className="pg-eye">{eye}</div><h2 className="pg-title">{title}</h2>{sub&&<div className="pg-sub">{sub}</div>}</div>);
const Sec=({n,title,note,children})=>(<section className="sec"><div className="sec-h"><b>{n}</b><h3>{title}</h3>{note&&<small>{note}</small>}</div>{children}</section>);
const Empty=({children})=><div className="empty">{children}</div>;
const Prose=({t})=> t?<div className="prose">{rich(t)}</div>:null;
const Lv=({v})=>{ const n=Math.round(v||0); return <span className={`lv lv${Math.min(Math.max(n,0),9)}`}>{v?(Number.isInteger(v)?v:v.toFixed(1)):"·"}</span>; };
const Pct=({p,color})=> p&&p.min!=null ? <div className="pct" style={{color}}>{p.min}~{p.max}%<small>추정 합격가능성</small></div> : null;


/* 원점수·평균·표준편차 → 상위 % (정규분포 추정). 등급 경계에서 밀린 과목을 드러낸다. */
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;};
const topPct=(raw,avg,sd)=>{raw=parseFloat(raw);avg=parseFloat(avg);sd=parseFloat(sd);if(!(sd>0)||isNaN(raw)||isNaN(avg))return null;const z=(raw-avg)/sd;return Math.max(0.5,Math.min(99,(1-(0.5*(1+erf(z/Math.SQRT2))))*100));};
const gradeByPct=p=>p<=4?1:p<=11?2:p<=23?3:p<=40?4:p<=60?5:p<=77?6:p<=89?7:p<=96?8:9;

/* ───────── 1. 성적 · 이수 ───────── */
function GradesTab({G}){
  const is2022=(G.curriculum||"").includes("2022")||G.is2022; const maxLv=is2022?5:9;
  const grades=useMemo(()=>(G.grades||[]).map(r=>({...r,lv:lvN(r.level),g:+r.gN||parseInt(r.grade)||0,s:+r.sN||parseInt(r.semester)||0,w:parseFloat(r.credit)||1})),[G]);
  const keys=[...new Set(grades.filter(r=>r.g&&r.s).map(r=>`${r.g}-${r.s}`))].sort();
  const avg=(list)=>{ const f=list.filter(r=>r.lv>0); const w=f.reduce((a,r)=>a+r.w,0); return w?f.reduce((a,r)=>a+r.lv*r.w,0)/w:null; };
  const cell=(grp,k)=>avg(grades.filter(r=>r.group===grp&&`${r.g}-${r.s}`===k));
  const core=(k)=>avg(grades.filter(r=>GROUPS.includes(r.group)&&`${r.g}-${r.s}`===k));
  const all=(k)=>avg(grades.filter(r=>`${r.g}-${r.s}`===k));
  const coreAll=avg(grades.filter(r=>GROUPS.includes(r.group)));
  const top=grades.filter(r=>r.lv>0&&r.lv<=(is2022?1:2)).length;
  const series=keys.map(k=>core(k)); const first=series.find(v=>v!=null), last=[...series].reverse().find(v=>v!=null);
  const diff=(first!=null&&last!=null)?last-first:0;
  const trend=first==null?"-":Math.abs(diff)<0.25?"안정 유지형":diff<0?"상승형":"하락형";
  // 추이 차트(SVG)
  const W=600,H=190,px=40,py=30; const X=i=>keys.length<2?W/2:px+22+i*((W-px-70)/(keys.length-1)); const Y=v=>py+((v-1)/(maxLv-1))*(H-py*2);
  const pts=series.map((v,i)=>v!=null?[X(i),Y(v),v]:null).filter(Boolean);
  // 이수과목 그리드
  const groupsAll=[...GROUPS,"기타"]; const ach=(G.achievementSubjects||[]);
  const gOf=(r)=>GROUPS.includes(r.group)?r.group:"기타";
  const cr=G.creditStatus;
  const pos=!is2022?grades.map(r=>({r,p:topPct(r.rawScore,r.avg,r.sd)})).filter(x=>x.p!=null&&x.r.lv>0):[];
  const posAvg=pos.length?pos.reduce((a,x)=>a+x.p,0)/pos.length:null;
  const pushed=pos.filter(x=>gradeByPct(x.p)<x.r.lv).sort((a,b)=>(a.p-b.p)).slice(0,3);
  return (<>
    <Head eye="01 · 성적과 이수" title="성적 · 이수과목 분석" sub={`${G.stageLabel||""} ${is2022?"· 2022 개정(5등급제)":"· 2015 개정(9등급제)"}`}/>
    <div className="grid g4">
      <div className="stat"><small>전체 평균등급</small><b>{G.gradeAvg||"-"}</b><span>{is2022?"5등급제 기준":"9등급제 기준"}</span></div>
      <div className="stat"><small>국영수사과 평균</small><b>{coreAll?coreAll.toFixed(2):"-"}</b><span>학점 가중</span></div>
      <div className="stat"><small>{is2022?"1등급 과목":"1·2등급 과목"}</small><b>{top}<span style={{display:"inline",fontSize:13,fontWeight:600}}> / {grades.filter(r=>r.lv>0).length}</span></b><span>전체 석차등급 과목 중</span></div>
      <div className="stat"><small>성적 추이</small><b style={{fontSize:19}}>{trend}</b><span>{first!=null&&last!=null?`${first.toFixed(2)} → ${last.toFixed(2)}`:""}</span></div>
    </div>

    <Sec n="01" title="학기별 성적 추이" note="위로 갈수록 우수">
      {keys.length?(<div className="card"><svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {Array.from({length:maxLv},(_,i)=>i+1).map(v=><g key={v}><line x1={px} x2={W-10} y1={Y(v)} y2={Y(v)} stroke="#ece9f7"/><text x={px-8} y={Y(v)+4} fontSize="14" fill="#8280a3" textAnchor="end">{v}</text></g>)}
        {keys.map((k,i)=><text key={k} x={X(i)} y={H-4} fontSize="14" fill="#47456b" textAnchor="middle" fontWeight="700">{k.replace("-","·")+"학기"}</text>)}
        <polyline fill="none" stroke="#5a52d9" strokeWidth="3" strokeLinejoin="round" points={pts.map(p=>p[0]+","+p[1]).join(" ")}/>
        {pts.map((p,i)=><g key={i}><circle cx={p[0]} cy={p[1]} r="7" fill="#fff" stroke="#3a34a8" strokeWidth="3.5"/><text x={p[0]} y={p[1]-11} fontSize="15" fontWeight="800" fill="#1b1a3a" textAnchor="middle">{p[2].toFixed(2)}</text></g>)}
      </svg></div>):<Empty>학기별 성적 데이터를 찾지 못했어요. 파일 형식을 확인해 주세요.</Empty>}
    </Sec>

    <Sec n="02" title="교과군 × 학기 성적표" note="학점 가중 평균등급">
      {keys.length>0&&<div className="card tbl-wrap"><table className="t"><thead><tr><th>교과군</th>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>
        {GROUPS.map(gp=><tr key={gp}><td>{gp}</td>{keys.map(k=><td key={k}><Lv v={cell(gp,k)}/></td>)}</tr>)}
        <tr><td>국영수사과</td>{keys.map(k=><td key={k}><Lv v={core(k)}/></td>)}</tr>
        <tr><td>전과목</td>{keys.map(k=><td key={k}><Lv v={all(k)}/></td>)}</tr>
      </tbody></table></div>}
      {posAvg!=null&&<div className="callout" style={{marginTop:12}}><b>등급 뒤의 실제 위치 · </b>원점수·평균·표준편차로 추정한 평균 위치는 <b>상위 {posAvg.toFixed(1)}%</b>입니다.
        {pushed.length>0?<> 등급 경계에서 밀린 과목: {pushed.map((x,i)=><span key={i}><b>{x.r.subject}({x.r.g}-{x.r.s})</b> {x.r.lv}등급이지만 상위 {x.p.toFixed(0)}%{i<pushed.length-1?", ":""}</span>)}.</>:null}
        <div className="note" style={{marginTop:4}}>정규분포를 가정한 추정치이며 수강자 수가 적을수록 오차가 큽니다.</div></div>}
      {G.gradeAnalysis?.overall&&<div className="card" style={{marginTop:12}}><Prose t={G.gradeAnalysis.overall}/></div>}
    </Sec>

    <Sec n="03" title="이수과목 현황" note="숫자=석차등급 · 점선=진로선택(성취도)">
      <div className="card tbl-wrap"><table className="t"><thead><tr><th>교과군</th><th>1학년</th><th>2학년</th><th>3학년</th></tr></thead><tbody>
        {groupsAll.map(gp=>{ const rows=[1,2,3].map(n=>({list:grades.filter(r=>gOf(r)===gp&&r.g===n),ach:ach.filter(a=>(+a.gN||parseInt(a.grade))===n&&(GROUPS.includes(a.group)?a.group:"기타")===gp)}));
          if(rows.every(r=>!r.list.length&&!r.ach.length)) return null;
          return <tr key={gp}><td>{gp}</td>{rows.map((r,i)=><td key={i} style={{textAlign:"left"}}>
            {r.list.map((x,j)=><span key={j} className="sub-chip">{x.subject}<em>{x.lv||"-"}</em></span>)}
            {r.ach.map((x,j)=><span key={"a"+j} className="sub-chip opt">{x.subject}<em>{x.achievement}</em></span>)}</td>)}</tr>; })}
      </tbody></table></div>
      {G.gradeAnalysis?.majorLink&&<div className="callout" style={{marginTop:12}}><b>전공 연계 교과 · </b>{rich(G.gradeAnalysis.majorLink)}</div>}
      {cr?.summary&&<div className="callout" style={{marginTop:12}}>{rich(cr.summary)}</div>}
      {!!cr?.byUniv?.length&&<div className="grid g2" style={{marginTop:12}}>{cr.byUniv.map((u,i)=>(
        <div className="card" key={i}><b>{u.univ} {u.dept}</b>
          {!(G.curriculum||"").includes("2015")&&u.rate!=null&&<span className="tag brand" style={{marginLeft:8}}>권장과목 충족 {u.rate}%</span>}
          <div style={{margin:"8px 0"}}>{(u.satisfied||u.matched||[]).slice(0,8).map((s,j)=><span key={j} className="tag good" style={{margin:2}}>{s}</span>)}{(u.missing||[]).slice(0,5).map((s,j)=><span key={"m"+j} className="tag bad" style={{margin:2}}>{s}</span>)}</div>
          <div className="prose" style={{fontSize:13}}>{rich(firstSentence(u.analysis,140))}</div></div>))}</div>}
    </Sec>
  </>);
}

/* ───────── 2. 탐구 계보 ───────── */
const ROW_ORDER=["진로","동아리","자율","봉사","국어","수학","영어","사회","과학","정보·기술","예체능","기타"];
function LineageTab({G}){
  const [sel,setSel]=useState(null);
  const acts=useMemo(()=>(G.activities||[]).map((a,i)=>{
    const g=+a.gN||parseInt(a.year)||1; let s=+a.sN||parseInt(a.semester)||1; if(s!==1&&s!==2) s=1;
    let row=a.subject||""; if(/자율|동아리|진로|봉사/.test(a.type||"")&&!/세특/.test(a.type)) row=(a.type.match(/자율|동아리|진로|봉사/)||[""])[0];
    if(!ROW_ORDER.includes(row)) row=/정보|기술|가정/.test(row)?"정보·기술":/예|체|음악|미술/.test(row)?"예체능":(ROW_ORDER.includes((a.type||"").slice(0,2))?(a.type||"").slice(0,2):"기타");
    return {...a,i,key:`${g}-${s}`,row,depthN:Math.min(4,Math.max(1,parseInt(a.depth)||1))};
  }),[G]);
  const cols=["1-1","1-2","2-1","2-2","3-1"].concat(acts.some(a=>a.key==="3-2")?["3-2"]:[]);
  const rows=ROW_ORDER.filter(r=>acts.some(a=>a.row===r));
  const counts=cols.map(c=>acts.filter(a=>a.key===c).length);
  const gradeKeys=[...new Set((G.grades||[]).map(r=>`${+r.gN||parseInt(r.grade)}-${+r.sN||parseInt(r.semester)}`))];
  const missing=cols.filter((c,i)=>counts[i]===0&&gradeKeys.includes(c));
  const selA=sel!=null?acts.find(a=>a.i===sel):null;
  const hot=selA&&selA.topicKey?acts.filter(a=>a.topicKey&&a.topicKey===selA.topicKey).map(a=>a.i):[];
  const threads=G.inquiryThreads||[]; const majors=G.recommendedMajors||[];
  const avgDepth=acts.length?(acts.reduce((a,x)=>a+x.depthN,0)/acts.length):0;
  return (<>
    <Head eye="02 · 탐구의 줄기" title="탐구 계보도 · 추천학과" sub="가로=학기 · 세로=창체와 교과군 · 카드를 누르면 같은 관심 주제가 이어진 기록이 밝아집니다"/>
    <div className="grid g4">
      <div className="stat"><small>탐구 기록</small><b>{acts.length}</b><span>추출된 활동·세특</span></div>
      <div className="stat"><small>이어진 줄기</small><b>{threads.length}</b><span>2학기 이상 이어진 관심</span></div>
      <div className="stat"><small>평균 탐구 깊이</small><b>{avgDepth?avgDepth.toFixed(1):"-"}</b><span>4단계 만점</span></div>
      <div className="stat"><small>4단계(성찰·확장)</small><b>{acts.filter(a=>a.depthN>=4).length}</b><span>한계·개선·후속까지</span></div>
    </div>
    {missing.length>0&&<div className="callout bad" style={{marginTop:14}}><b>기록 누락 의심 · </b>{missing.join(", ")}에 성적은 있는데 탐구 기록이 하나도 추출되지 않았어요. 원문에 세특이 있다면 HTML(.htm)로 다시 올리거나 파일을 확인해 주세요.</div>}

    <Sec n="01" title="탐구 계보도" note="깊이 ▂▄▆█ = 1~4단계">
      {acts.length?(<div className="card" style={{padding:14}}><div className="lineage" style={{gridTemplateColumns:`72px repeat(${cols.length},minmax(150px,1fr))`}}>
        <div/>{cols.map((c,i)=><div key={c} className="lh">{c.replace("-","학년 ")}학기<br/><span style={{fontWeight:600}}>{counts[i]}건</span></div>)}
        {rows.map(r=>(<React.Fragment key={r}><div className="lrow">{r}</div>
          {cols.map(c=><div key={c} className="lcell">{acts.filter(a=>a.row===r&&a.key===c).map(a=>(
            <button key={a.i} className={`lcard${sel===a.i?" sel":""}${sel!=null&&sel!==a.i&&!hot.includes(a.i)?" dim":""}`} onClick={()=>setSel(sel===a.i?null:a.i)}>
              <small>{a.subjectName||a.type||a.row}</small> <Depth n={a.depthN}/>
              <b>{a.title}</b>
              {a.linkType&&a.linkType!=="없음"&&<span className={`link ${a.linkType}`}>{a.linkType}{a.linkFrom?` ← ${a.linkFrom}`:""}</span>}
            </button>))}</div>)}
        </React.Fragment>))}
      </div></div>):<Empty>탐구 기록을 추출하지 못했어요.</Empty>}
    </Sec>

    <Sec n="02" title="이어진 탐구 줄기" note="한 번 나온 주제가 아니라 학기를 건너 이어진 관심만">
      {threads.length?threads.map((t,i)=>(<div className="thread" key={i}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><span className="tag brand">줄기 {i+1}</span><b style={{fontSize:16}}>{t.theme}</b>{t.majorHint&&<span className="tag">→ {t.majorHint}</span>}</div>
        <div className="thread-steps">{(t.steps||[]).map((s,j)=>(<React.Fragment key={j}>{j>0&&<span className="arrow">→</span>}<span className="thread-step"><b>{String(s.when||"").replace("-","학년 ")}{s.when?"학기":""} · {s.subject}</b>{s.title} <Depth n={+s.depth||1}/></span></React.Fragment>))}</div>
        <Prose t={t.verdict}/></div>)):<Empty>여러 학기에 걸쳐 이어진 탐구 줄기가 뚜렷하지 않아요. 활동이 학기마다 흩어져 있다는 신호일 수 있습니다.</Empty>}
      {G.activityInsight?.continuity&&<div className="callout" style={{marginTop:10}}><b>연속성 평가 · </b>{rich(firstSentence(G.activityInsight.continuity,220))}</div>}
    </Sec>

    <Sec n="03" title="탐구가 가리키는 추천학과" note="이수과목·성적·세특 종합">
      {majors.length?<div className="grid">{majors.slice(0,5).map((m,i)=>(<div className="card" key={i}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><span className="rank-n">{i+1}</span><b style={{fontSize:17}}>{m.major}</b>
          <span className="pct" style={{color:"var(--brand)"}}>{m.score}<small>적합도(합격률 아님)</small></span></div>
        <div className="meter" style={{margin:"10px 0"}}><i style={{width:(m.score||0)+"%",background:"var(--brand2)"}}/></div>
        <div className="prose" style={{fontSize:13.5}}>{rich(firstSentence(m.reason,170))}</div>
        <div style={{marginTop:8}}>{(m.matchedSubjects||[]).slice(0,6).map((s,j)=><span key={j} className="tag brand" style={{margin:2}}>{s}</span>)}</div>
        {m.reason&&m.reason.length>180&&<details style={{marginTop:6}}><summary style={{cursor:"pointer",fontSize:12.5,color:"var(--brand)",fontWeight:700}}>자세히</summary><div style={{marginTop:6}}><Prose t={m.reason}/></div></details>}
      </div>))}</div>:<Empty>추천학과 데이터가 없어요.</Empty>}
    </Sec>

    {selA&&<aside className="drawer"><button className="mini-btn" style={{float:"right"}} onClick={()=>setSel(null)}>닫기 ✕</button>
      <div className="pg-eye">{selA.key.replace("-","학년 ")}학기 · {selA.subjectName||selA.row}</div>
      <h3 style={{fontSize:19,margin:"4px 0 8px"}}>{selA.title}</h3>
      <div style={{marginBottom:10}}><Depth n={selA.depthN}/> <span className="tag">깊이 {selA.depthN}단계</span> {selA.linkType&&selA.linkType!=="없음"&&<span className={`link ${selA.linkType}`}>{selA.linkType}{selA.linkFrom?` ← ${selA.linkFrom}`:""}</span>}</div>
      <div style={{marginBottom:10}}>{(selA.methods||[]).map((m,i)=><span key={i} className="tag brand" style={{margin:2}}>{m}</span>)}</div>
      <Prose t={selA.content}/>
      {selA.motivation&&<div className="callout" style={{marginTop:10}}><b>동기 · </b>{rich(selA.motivation)}</div>}
      {selA.process&&<div className="callout" style={{marginTop:8}}><b>과정 · </b>{rich(selA.process)}</div>}
      {selA.growth&&<div className="callout" style={{marginTop:8}}><b>성장 · </b>{rich(selA.growth)}</div>}
    </aside>}
  </>);
}

/* ───────── 3. 역량 분석 ───────── */
function CompTab({G,total,grd}){
  const comps=G.competencies||{}; const S=G.strengths||[], W=G.weaknesses||[];
  return (<>
    <Head eye="03 · 역량" title="역량 분석" sub="점수는 ‘기본점수 + 플러스 요인 − 마이너스 요인’으로 산정 근거를 공개합니다"/>
    <div className="grid g2" style={{gridTemplateColumns:"260px 1fr"}}>
      <div className="stat" style={{textAlign:"center",padding:22}}><small>종합 역량 점수</small><b style={{fontSize:46}}>{total}</b><span><span className="tag brand">{grd}등급 · {GRADE_LABEL[grd]}</span></span></div>
      <div className="callout" style={{display:"flex",alignItems:"center"}}>{rich(G.scoreSummary||"총점은 5개 역량 점수의 합계이며, 다수 지원자는 55~70점 구간에 분포합니다.")}</div>
    </div>
    <Sec n="01" title="5대 역량 점수와 산정 근거">
      <div className="grid">{COMP.map(([k,n,max,c])=>{ const d=comps[k]||{}; const b=d.scoreBreakdown||{};
        return (<div className="card" key={k}>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}><b style={{fontSize:17}}>{n}</b><span className="tag" style={{background:c+"1f",color:c}}>{d.grade||"-"}</span>
            <span className="pct mono" style={{color:c}}>{d.score??"-"}<span style={{fontSize:13,color:"var(--ink3)"}}> / {max}</span></span></div>
          <div className="meter" style={{margin:"8px 0"}}><i style={{width:Math.min(100,((d.score||0)/max)*100)+"%",background:c}}/></div>
          {(b.base||b.plusFactors?.length||b.minusFactors?.length)&&<div className="ledger">
            {b.base&&<div>기본 · {rich(b.base)}</div>}
            {(b.plusFactors||[]).map((p,i)=><div className="p" key={"p"+i}><b>{p.points||"+"}</b>{rich(p.reason)}</div>)}
            {(b.minusFactors||[]).map((p,i)=><div className="m" key={"m"+i}><b>{p.points||"−"}</b>{rich(p.reason)}</div>)}
            {b.final&&<div style={{borderTop:"1px dashed var(--line2)",paddingTop:6,fontWeight:800}}>→ {rich(b.final)}</div>}
          </div>}
          <details style={{marginTop:8}}><summary style={{cursor:"pointer",fontSize:12.5,color:"var(--brand)",fontWeight:700}}>상세 분석 · 근거 기록</summary>
            <div style={{marginTop:8}}><Prose t={d.detail}/>
            {(d.evidenceList||[]).length>0&&<ul style={{margin:"10px 0 0 18px",fontSize:13,color:"var(--ink2)"}}>{d.evidenceList.map((e,i)=><li key={i} style={{marginBottom:4}}>{rich(e)}</li>)}</ul>}</div></details>
        </div>);})}</div>
    </Sec>
    <Sec n="02" title="플러스(+) · 마이너스(−) 요인 종합" note="학생부 전체에서 가려낸 핵심">
      <div className="pm">
        <div className="plus"><h4 style={{color:"var(--mint)"}}>＋ 강점</h4>{S.length?<ul>{S.map((s,i)=><li key={i}><b>{s.title}</b> — {rich(firstSentence(s.content,110))}
          {s.highlight&&<details><summary style={{cursor:"pointer",fontSize:12,color:"var(--brand)"}}>입시에서의 의미</summary>{rich(s.highlight)}</details>}</li>)}</ul>:<Empty>없음</Empty>}</div>
        <div className="minus"><h4 style={{color:"var(--red)"}}>－ 보완점</h4>{W.length?<ul>{W.map((s,i)=><li key={i}><b>{s.title}</b> — {rich(firstSentence(s.content,110))}
          {s.suggestion&&<details><summary style={{cursor:"pointer",fontSize:12,color:"var(--brand)"}}>보완 방법</summary>{rich(s.suggestion)}</details>}</li>)}</ul>:<Empty>없음</Empty>}</div>
      </div>
    </Sec>
  </>);
}

/* ───────── 4. 입시 진단 ───────── */
function DiagTab({G,major}){
  const is2022=(G.curriculum||"").includes("2022")||G.is2022; const T=G.tierAnalysis||{}; const dept=G.deptReports||[];
  const cmp=useMemo(()=>{ try{
    const gs=(G.grades||[]).filter(r=>lvN(r.level)>0); let f=null;
    if(!is2022&&gs.length>=3){ const lv=gs.map(r=>lvN(r.level)); const m=lv.reduce((a,b)=>a+b,0)/lv.length; const sp=Math.sqrt(lv.reduce((a,b)=>a+(b-m)**2,0)/lv.length);
      const core=gs.filter(r=>GROUPS.slice(0,3).includes(r.group)); const ca=core.length?core.reduce((a,b)=>a+lvN(b.level),0)/core.length:null;
      const mg=getMajorRelatedGroups(major||G.studentType); const mr=gs.filter(r=>mg.includes(r.group)); const ma=mr.length?mr.reduce((a,b)=>a+lvN(b.level),0)/mr.length:null;
      f={coreAvg:ca?+ca.toFixed(2):null,majorAvg:ma?+ma.toFixed(2):null,spread:+sp.toFixed(2)}; }
    return compareAllUnivs(G.gradeAvg,major||G.studentType,is2022,f); }catch(e){return null;} },[G,major,is2022]);
  const ranks=G.univRecommendRank||[]; const top=G.topUnivCompare;
  return (<>
    <Head eye="04 · 입시 진단" title="희망학과 분석 · 대학 유불리 비교" sub="내신 숫자만이 아니라 정성평가 기준(관련교과·탐구 깊이·공동체)을 우선해 판단했습니다"/>
    <div className="callout warn"><b>읽는 법 · </b>합격가능성은 서류 기준의 <b>보수적 추정치</b>입니다. 면접이 있는 전형은 결과에 따라 크게 달라질 수 있고, 인용된 합격선에는 특목·자사고 지원자도 섞여 있어 일반고 학생에게는 더 엄격하게 봐야 합니다.</div>

    <Sec n="01" title="희망학과 분석" note="입력한 대학·학과 기준">
      {dept.length?dept.map((d,i)=>(<div className="card" key={i} style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span className="rank-n">{d.rank||i+1}</span><b style={{fontSize:18}}>{d.univ} {d.dept}</b>
          <span className={`tag ${verdictTone(d.overall?.verdict)}`}>{d.overall?.verdict}</span>
          {d.strategy?.전형추천&&<span className="tag brand">추천 전형 · {d.strategy.전형추천}</span>}</div>
        <div className="prose" style={{margin:"10px 0"}}>{rich(d.overall?.summary)}</div>
        <div className="pm"><div className="plus"><h4 style={{color:"var(--mint)"}}>유리한 점</h4><ul>{(d.pros||[]).map((x,j)=><li key={j}>{rich(x)}</li>)}</ul></div>
          <div className="minus"><h4 style={{color:"var(--red)"}}>불리한 점</h4><ul>{(d.cons||[]).map((x,j)=><li key={j}>{rich(x)}</li>)}</ul></div></div>
        <details style={{marginTop:10}}><summary style={{cursor:"pointer",fontSize:13,color:"var(--brand)",fontWeight:800}}>성적·이수·활동·역량 상세, 합격 전략</summary>
          {[["성적",d.gradeAnalysis?.relatedSubjects||d.gradeAnalysis?.trend],["이수",d.creditAnalysis?.detail],["활동·탐구",d.activityFit?.detail],["역량",d.competencyFit?.detail],["전략",d.strategy?.actionPlan]].map(([t,x],j)=>x?<div key={j} style={{marginTop:10}}><span className="tag">{t}</span><Prose t={x}/></div>:null)}
          {(d.strategy?.key3||[]).length>0&&<div className="callout" style={{marginTop:10}}><b>핵심 3가지 · </b>{d.strategy.key3.map((x,j)=><div key={j}>{j+1}. {rich(x)}</div>)}</div>}
        </details></div>))
        :<Empty>희망 대학·학과를 입력하지 않아 이 구간은 비어 있어요. 아래 ‘대학 유불리 비교’는 입력과 무관하게 제공됩니다.</Empty>}
    </Sec>

    <Sec n="02" title="대학 유불리 비교" note="최상위권 → 거점국립대">
      {T.studentLevel&&<div className="callout"><b>현재 위치 · </b>{rich(T.studentLevel)}{T.recommendedTier&&<div style={{marginTop:6}}><b>추천 라인 · </b>{rich(T.recommendedTier)}</div>}</div>}
      <div style={{marginTop:12}}>{(cmp||[]).map((tier,ti)=>{ const ta=(T.tiers||[]).find(t=>t.tier===tier.tier);
        return (<div className="tier" key={ti} style={{borderLeftColor:tier.color}}>
          <div className="tier-h"><h4 style={{color:tier.color}}>{tier.tier}</h4><span style={{fontSize:12,color:"var(--ink3)"}}>{tier.desc}</span>
            {ta&&<span className={`tag ${verdictTone(ta.verdict)}`}>{ta.verdict}</span>}<Pct p={ta?.admissionProbability} color={tier.color}/></div>
          {ta?.reason&&<div className="prose" style={{fontSize:13.5}}>{rich(firstSentence(ta.reason,200))}</div>}
          {ta?.reason&&ta.reason.length>210&&<details style={{margin:"6px 0"}}><summary style={{cursor:"pointer",fontSize:12.5,color:"var(--brand)",fontWeight:700}}>판단 근거 전문</summary><Prose t={ta.reason}/></details>}
          {ta?.strategy&&<div className="callout" style={{marginTop:8}}><b>전형·전략 · </b>{rich(ta.strategy)}</div>}
          <div style={{marginTop:8}}>{tier.univs.map((u,j)=><span key={j} className="sub-chip" title="특목·자사고 지원자가 섞인 전형의 평균 참고컷입니다">{u.name}{!u.artsNote&&<span style={{color:"var(--ink3)",fontWeight:600}}>참고컷 {u.cutShow||u.cut}</span>}{u.artsNote&&<span style={{color:"var(--ink3)",fontWeight:600}}>실기</span>}</span>)}<div className="note" style={{marginTop:6}}>※ 대학별 숫자는 ‘참고 등급컷’일 뿐 판정이 아닙니다. 합격가능성은 위 정성평가 기준의 종합 판단만 사용합니다.</div></div>
        </div>);})}</div>
    </Sec>

    <Sec n="03" title="추천 순위" note="실제로 이 순서로 검토">
      {ranks.length?<div className="card tbl-wrap"><table className="t"><thead><tr><th>순위</th><th>대학 · 학과</th><th>판정</th><th>추정 합격가능성</th><th style={{textAlign:"left"}}>근거</th></tr></thead><tbody>
        {ranks.map((r,i)=>(<tr key={i}><td><span className="rank-n" style={{margin:"0 auto"}}>{r.rank||i+1}</span></td><td style={{textAlign:"left"}}><b>{r.univ}</b><br/><span style={{fontSize:12,color:"var(--ink3)"}}>{r.recommendedDept}</span></td>
          <td><span className={`tag ${verdictTone(r.verdict)}`}>{r.verdict}</span></td><td className="mono">{r.admissionProbability?`${r.admissionProbability.min}~${r.admissionProbability.max}%`:"-"}</td>
          <td style={{textAlign:"left",fontSize:12.5,color:"var(--ink2)",minWidth:240}}>{rich(firstSentence(r.reason,130))}</td></tr>))}</tbody></table></div>:<Empty>추천 순위 데이터가 없어요.</Empty>}
      {top?.univs?.length>0&&<details style={{marginTop:12}}><summary style={{cursor:"pointer",fontSize:13,color:"var(--brand)",fontWeight:800}}>주요 상위 10개 대학 개별 비교 펼치기</summary>
        <div className="grid g2" style={{marginTop:10}}>{top.univs.map((u,i)=>(<div className="card" key={i}><div style={{display:"flex",alignItems:"center",gap:8}}><b>{u.univ}</b><span className={`tag ${verdictTone(u.verdict)}`}>{u.verdict}</span><Pct p={u.admissionProbability} color="var(--ink)"/></div>
          {u.전형추천&&<div style={{margin:"6px 0"}}><span className="tag brand">추천 전형 · {u.전형추천}</span></div>}<div className="prose" style={{fontSize:13}}>{rich(firstSentence(u.summary,150))}</div></div>))}</div>
        {top.advice&&<div className="callout" style={{marginTop:10}}>{rich(top.advice)}</div>}</details>}
    </Sec>
  </>);
}

/* ───────── 5. 종합 리포트 ───────── */
function FinalTab({G,name,total,grd,onExport}){
  const F=G.finalRecommendation||{};
  return (<>
    <Head eye="05 · 최종 결론" title="종합 리포트" sub={`${name} 학생 · ${G.studentType?firstSentence(G.studentType,60):""}`}/>
    <div className="grid g4">
      <div className="stat"><small>종합 역량 점수</small><b>{total}</b><span>{grd}등급 · {GRADE_LABEL[grd]}</span></div>
      <div className="stat"><small>평균 등급</small><b>{G.gradeAvg||"-"}</b><span>{(G.curriculum||"").includes("2022")?"5등급제":"9등급제"}</span></div>
      <div className="stat"><small>탐구 기록</small><b>{(G.activities||[]).length}</b><span>줄기 {(G.inquiryThreads||[]).length}개</span></div>
      <div className="stat"><small>1순위 추천</small><b style={{fontSize:16}}>{F.top10?.[0]?`${F.top10[0].univ}`:"-"}</b><span>{F.top10?.[0]?.dept||""}</span></div>
    </div>

    <Sec n="01" title="이렇게 지원하는 것을 추천합니다" note="대학 · 학과 · 전형">
      {F.interviewCaveat&&<div className="callout warn" style={{marginBottom:12}}>🎤 <b>면접 유의 · </b>{rich(F.interviewCaveat)}</div>}
      {F.top10?.length?<div className="card tbl-wrap"><table className="t"><thead><tr><th>순위</th><th style={{textAlign:"left"}}>대학 · 학과</th><th style={{textAlign:"left"}}>전형</th><th>라인</th><th>추정 합격가능성</th><th style={{textAlign:"left"}}>근거</th></tr></thead><tbody>
        {F.top10.map((r,i)=>(<tr key={i}><td><span className="rank-n" style={{margin:"0 auto"}}>{r.rank||i+1}</span></td>
          <td style={{textAlign:"left"}}><b>{r.univ}</b><br/><span style={{fontSize:12,color:"var(--ink3)"}}>{r.dept}</span></td>
          <td style={{textAlign:"left",fontSize:12.5}}>{r.admissionType}{r.hasInterview&&" 🎤"}</td>
          <td><span className={`tag ${verdictTone(r.tier)}`}>{r.tier}</span></td><td className="mono"><b>{r.admissionProbability?`${r.admissionProbability.min}~${r.admissionProbability.max}%`:"-"}</b></td>
          <td style={{textAlign:"left",fontSize:12.5,color:"var(--ink2)",minWidth:230}}>{rich(firstSentence(r.reason,120))}</td></tr>))}</tbody></table></div>:<Empty>최종 추천 데이터가 없어요.</Empty>}
      <div className="note" style={{marginTop:8}}>🎤 면접 포함 전형 · 확률은 서류 기준 보수적 추정이며 실제 결과는 이보다 낮거나 높을 수 있습니다.</div>
    </Sec>

    {F.avoid?.length>0&&<Sec n="02" title="현재로선 피하는 게 좋은 대학·학과">
      <div className="callout bad">{F.avoid.map((a,i)=><div key={i} style={{marginBottom:6}}><b>{a.univ}{a.dept?` · ${a.dept}`:""}</b> — {rich(a.reason)}</div>)}</div></Sec>}

    <Sec n={F.avoid?.length?"03":"02"} title="상담 편지" note="요약 → 전문">
      {G.summaryLetter?<div className="letter">{rich(G.summaryLetter)}</div>:<Empty>편지 데이터가 없어요.</Empty>}
      {G.reportLetter&&<details style={{marginTop:12}}><summary style={{cursor:"pointer",fontSize:13.5,color:"var(--brand)",fontWeight:800}}>전문 읽기 (상세 상담 편지)</summary><div className="letter" style={{marginTop:10}}>{rich(G.reportLetter)}</div></details>}
    </Sec>
    <div className="no-print" style={{display:"flex",gap:8,marginTop:22}}><button className="mini-btn" onClick={()=>window.print()}>🖨 인쇄 / PDF 저장</button><button className="mini-btn" onClick={onExport}>📝 워드(.doc) 내보내기</button></div>
  </>);
}

export default function Report({G,name,total,grd,inMajor,onReset,onExport}){
  const [tab,setTab]=useState(0);
  const go=(i)=>{setTab(i);window.scrollTo({top:0});};
  const body=[<GradesTab G={G}/>,<LineageTab G={G}/>,<CompTab G={G} total={total} grd={grd}/>,<DiagTab G={G} major={inMajor}/>,<FinalTab G={G} name={name} total={total} grd={grd} onExport={onExport}/>][tab];
  return (<div className="shell">
    <aside className="rail">
      <div className="brand"><span className="brand-dot">RI</span>리포트아이</div>
      <div className="who"><small>{G.schoolName||""}</small><h3>{name}</h3><div className="who-row"><span className="who-score">{total}</span><span className="who-grade">{grd}등급</span></div><p>{firstSentence(G.studentType,70)}</p></div>
      <nav className="nav">{TABS.map(([t],i)=><button key={i} className={tab===i?"on":""} onClick={()=>go(i)}><b>{i+1}</b>{t}</button>)}</nav>
      <div className="rail-foot no-print"><button className="mini-btn" onClick={onExport}>📝 워드로 저장</button><button className="mini-btn" onClick={()=>window.print()}>🖨 인쇄</button><button className="mini-btn" onClick={onReset}>← 새 분석</button></div>
    </aside>
    <main className="main">{body}</main>
    <nav className="dock">{TABS.map(([t],i)=><button key={i} className={tab===i?"on":""} onClick={()=>go(i)}><b>{i+1}</b>{t.split(" ")[0]}</button>)}</nav>
  </div>);
}
