import React, { useState, useMemo, useRef, useEffect } from "react";
import UNIV_DEPTS_JSON from "../data/univDepts.json";
import { UNIV_RECOMMENDED_2028 } from "../univRecommended.js";

const SCHOOL_TYPES=[["일반고","일반고"],["자율형사립고","자사고"],["특목고(과학고)","과학고"],["특목고(외고·국제고)","외고·국제고"],["영재학교","영재학교"],["특성화고","특성화고"],["검정고시","검정고시"]];
const PRIORITY=["서울대","연세대","고려대","성균관대","서강대","한양대","중앙대","경희대","한국외대","서울시립대","이화여대","건국대","동국대","홍익대","숙명여대","국민대","숭실대","세종대","단국대(죽전)","가천대"];

/* 검색 가능한 드롭박스 */
function Select({value,placeholder,options,onPick,disabled,freeLabel}){
  const [open,setOpen]=useState(false); const [q,setQ]=useState(""); const ref=useRef();
  useEffect(()=>{ if(!open) return; const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[open]);
  const list=useMemo(()=>{ const s=q.replace(/\s/g,""); const r=s?options.filter(o=>o.replace(/\s/g,"").includes(s)):options; return r.slice(0,150); },[q,options]);
  const pick=v=>{ onPick(v); setOpen(false); setQ(""); };
  return (<div className="sel" ref={ref}>
    <button type="button" className={`sel-btn${value?" has":""}`} disabled={disabled} onClick={()=>setOpen(!open)}><span>{value||placeholder}</span></button>
    {open&&<div className="sel-pop">
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="검색…" onKeyDown={e=>{ if(e.key==="Enter"){ if(list[0]) pick(list[0]); else if(freeLabel&&q.trim()) pick(q.trim()); } }}/>
      <div className="sel-list">
        {list.map(o=><button type="button" key={o} className="sel-opt" onClick={()=>pick(o)}>{o}</button>)}
        {!list.length&&freeLabel&&q.trim()&&<button type="button" className="sel-opt" onClick={()=>pick(q.trim())}>“{q.trim()}” {freeLabel}</button>}
        {!list.length&&!(freeLabel&&q.trim())&&<div className="note" style={{padding:10}}>결과가 없어요</div>}
      </div></div>}
  </div>);
}

export default function Intake(p){
  const [univ,setUniv]=useState("");
  const deptMap=useMemo(()=>{ const m={}; Object.entries(UNIV_DEPTS_JSON).forEach(([u,ds])=>{m[u]=new Set(ds);});
    Object.entries(UNIV_RECOMMENDED_2028||{}).forEach(([u,arr])=>{ const k=m[u]?u:(Object.keys(m).find(x=>x.startsWith(u))||u); (m[k]=m[k]||new Set()); (arr||[]).forEach(r=>r.dept&&m[k].add(r.dept)); });
    return m; },[]);
  const univList=useMemo(()=>{ const all=Object.keys(deptMap); const pri=PRIORITY.filter(x=>all.includes(x)); return [...pri,...all.filter(x=>!pri.includes(x)).sort((a,b)=>a.localeCompare(b,"ko"))]; },[deptMap]);
  const deptList=useMemo(()=>univ&&deptMap[univ]?[...deptMap[univ]].sort((a,b)=>a.localeCompare(b,"ko")):[],[univ,deptMap]);
  const full=p.targets.filter(t=>t.u).length>=3; const ready=!!(p.pdfB64||p.htmlContent);
  return (<>
  <header className="topbar">
    <div className="logo-pill"><span className="brand-dot">RI</span>리포트아이 <small>학생부 정밀 진단</small></div>
    <button className="demo-btn" onClick={p.onDemo}>예시 리포트 보기</button>
  </header>
  <div className="intake">
    <section>
      <div className="hero-pill"><i/>리포트아이 · 학생부종합전형 진단 스튜디오</div>
      <h1 className="hero-title emb">생기부 한 장을<br/>입학사정관의 눈으로<br/><span style={{color:"var(--teal2)"}}>냉정하게</span> 읽다</h1>
      <p className="hero-sub">성적과 이수과목, 탐구의 줄기와 깊이, 역량 점수의 가감 근거, 대학·전형별 현실적인 합격 라인까지. 후하게 말하지 않고 근거와 함께 보수적으로 진단합니다.</p>
      <div className="kpis">
        <div className="kpi"><b>5</b><span>핵심 분석 탭</span></div>
        <div className="kpi"><b>206</b><span>대학 2028 전형</span></div>
        <div className="kpi"><b>14,188</b><span>학과별 입결</span></div>
        <div className="kpi"><b>4단계</b><span>탐구 깊이 판독</span></div>
      </div>
      <div className="hero-steps">
        <div className="hero-step"><b>1</b><div><strong>성적 · 이수과목</strong> — 학기별 추이와 원점수 기준 실제 위치</div></div>
        <div className="hero-step"><b>2</b><div><strong>탐구 계보를 통한 추천학과</strong> — 관심이 어디까지 깊어졌는지</div></div>
        <div className="hero-step"><b>3</b><div><strong>역량 · 입시 진단 · 종합 리포트</strong> — 점수 근거와 대학·학과·전형 결론</div></div>
      </div>
    </section>

    <section className="form-card">
      <div className="f-block">
        <div className="f-label"><i>1</i>학생부 파일<small>PDF · HTML(.htm)</small></div>
        <label className={`drop${p.drag?" drag":""}${p.fileName?" done":""}`} onDragOver={e=>{e.preventDefault();p.setDrag(true)}} onDragLeave={()=>p.setDrag(false)} onDrop={p.onDrop}>
          <input type="file" accept="application/pdf,.pdf,text/html,.html,.htm" onChange={e=>{const f=e.target.files[0];if(f)p.processFile(f);}}/>
          <span className="ic">{p.fileName?"✓":"📄"}</span><b>{p.fileName||"파일을 끌어놓거나 눌러서 선택"}</b>
          <span>{p.fileName?"준비 완료 · 다시 누르면 교체":"정부24·나이스 대국민서비스에서 받은 파일 그대로"}</span>
        </label>
        <div className="note">스캔한 이미지 PDF는 글자를 읽을 수 없어요. 그럴 땐 나이스에서 HTML(.htm)로 받아 올려주세요.</div>
      </div>

      <div className="f-block">
        <div className="f-label"><i>2</i>학년 · 학교 유형<small>학년은 비우면 자동 판별</small></div>
        <div className="chips">{[["1","고1"],["2","고2"],["3","고3"]].map(([v,l])=><button key={v} className={`chip${p.inGrade===v?" on":""}`} onClick={()=>p.syncCurrFromGrade(p.inGrade===v?"":v)}>{l}</button>)}</div>
        <div className="chips">{SCHOOL_TYPES.map(([v,l])=><button key={v} className={`chip${p.inSchoolType===v?" on":""}`} onClick={()=>p.setInSchoolType(p.inSchoolType===v?"":v)}>{l}</button>)}</div>
        <div className="note">특목·자사고는 같은 등급도 다르게 해석돼요(등급이 박하게 나옴).</div>
      </div>

      <div className="f-block">
        <div className="f-label"><i>3</i>지원 희망 대학·학과<small>선택 · 최대 3개</small></div>
        {p.targets.filter(t=>t.u).length>0&&<div className="chips">{p.targets.map((t,i)=>t.u?<span key={i} className="target-chip"><i>{i+1}</i>{t.u} {t.d}<button onClick={()=>p.removeTarget(i)} aria-label="삭제">✕</button></span>:null)}</div>}
        {!full&&<div className="dd-row">
          <Select value={univ} placeholder="대학 선택" options={univList} onPick={u=>setUniv(u)} freeLabel="직접 입력"/>
          <Select value="" placeholder={univ?"학과 선택":"먼저 대학을 선택"} options={deptList} disabled={!univ} freeLabel="직접 입력" onPick={d=>{p.addTarget(univ,d);setUniv("");}}/>
        </div>}
        <input className="inp" value={p.inMajor} onChange={e=>p.setInMajor(e.target.value)} placeholder="대학이 미정이면 희망 전공만 입력 (예: 사학과)" autoComplete="off"/>
      </div>

      <div className="f-block">
        <div className="f-label"><i>4</i>이름<small>선택 · 비우면 파일에서 자동 인식</small></div>
        <input className="inp" value={p.inName} onChange={e=>p.setInName(e.target.value)} placeholder="홍길동" autoComplete="off"/>
      </div>

      {p.err&&<div className="err">⚠ {p.err}</div>}
      {!p.err&&p.truncWarning&&<div className="warn">ℹ️ {p.truncWarning}</div>}
      {p.step&&<div className="prog"><div className="prog-bar"><i style={{width:p.prog+"%"}}/></div><div className="prog-t"><span>{p.step}</span><span className="mono">{p.prog}%</span></div></div>}
      <button className="cta" disabled={!ready||p.busy} onClick={p.run}>{p.busy?"분석 중입니다…":"분석 시작하기"}</button>
      <div className="note">실명·학교명은 AI에 전달하기 전에 가려집니다.</div>
    </section>
  </div></>);
}
