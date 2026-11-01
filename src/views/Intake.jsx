import React, { useState } from "react";
import { searchUnivDept } from "../univRecommended.js";

const SCHOOL_TYPES=[["일반고","일반고"],["자율형사립고","자사고"],["특목고(과학고)","과학고"],["특목고(외고·국제고)","외고·국제고"],["영재학교","영재학교"],["특성화고","특성화고"],["검정고시","검정고시"]];

export default function Intake(p){
  const [q,setQ]=useState(""); const [open,setOpen]=useState(false);
  const results = q.trim() ? searchUnivDept(q,8) : [];
  const full = p.targets.filter(t=>t.u).length>=3;
  const ready = !!(p.pdfB64||p.htmlContent);
  const pickFree=()=>{ // 목록에 없을 때 "대학 학과" 직접 입력
    const parts=q.trim().split(/\s+/); if(parts.length<2) return;
    p.addTarget(parts[0],parts.slice(1).join(" ")); setQ(""); setOpen(false);
  };
  return (
  <div className="intake">
    <section className="intake-hero">
      <div className="brand"><span className="brand-dot">RI</span>리포트아이</div>
      <h1 className="hero-title">생기부 한 장으로<br/>입학사정관의 눈으로 <em>냉정하게</em> 읽어드려요</h1>
      <p className="hero-sub">성적·이수과목, 탐구의 줄기, 역량 점수, 대학 유불리까지. 후하게 말하지 않고 근거와 함께 보수적으로 진단합니다.</p>
      <div className="hero-steps">
        <div className="hero-step"><b>1</b><div><strong>성적 · 이수과목</strong>학기별 추이와 전공 관련 교과 이수를 한눈에</div></div>
        <div className="hero-step"><b>2</b><div><strong>탐구 계보 · 추천학과</strong>어떤 관심이 어디까지 깊어졌는지, 그 줄기가 가리키는 학과</div></div>
        <div className="hero-step"><b>3</b><div><strong>역량 분석</strong>플러스·마이너스 요인으로 점수의 근거까지</div></div>
        <div className="hero-step"><b>4</b><div><strong>입시 진단 · 종합 리포트</strong>대학 유불리와 “어느 대학·학과·전형인가” 최종 결론</div></div>
      </div>
      <button className="demo-btn" onClick={p.onDemo}>예시 리포트 먼저 보기 →</button>
    </section>

    <section className="intake-form">
      <div className="form-card">
        <div className="f-block">
          <div className="f-label"><i>1</i>학생부 파일<small>PDF · HTML(.htm)</small></div>
          <label className={`drop${p.drag?" drag":""}${p.fileName?" done":""}`}
            onDragOver={e=>{e.preventDefault();p.setDrag(true)}} onDragLeave={()=>p.setDrag(false)} onDrop={p.onDrop}>
            <input type="file" accept="application/pdf,.pdf,text/html,.html,.htm" onChange={e=>{const f=e.target.files[0];if(f)p.processFile(f);}}/>
            <span className="ic">{p.fileName?"✓":"📄"}</span>
            <b>{p.fileName||"파일을 끌어놓거나 눌러서 선택"}</b>
            <span>{p.fileName?"준비 완료 · 다시 누르면 교체":"정부24·나이스 대국민서비스에서 받은 파일 그대로"}</span>
          </label>
          <div className="note">스캔한 이미지 PDF는 글자를 읽을 수 없어요. 그럴 땐 나이스에서 HTML(.htm)로 받아 올려주세요.</div>
        </div>

        <div className="f-block">
          <div className="f-label"><i>2</i>학년 · 학교 유형<small>학년은 비워두면 자동 판별</small></div>
          <div className="chips">
            {[["1","고1"],["2","고2"],["3","고3"]].map(([v,l])=>
              <button key={v} className={`chip${p.inGrade===v?" on":""}`} onClick={()=>p.syncCurrFromGrade(p.inGrade===v?"":v)}>{l}</button>)}
          </div>
          <div className="chips">
            {SCHOOL_TYPES.map(([v,l])=>
              <button key={v} className={`chip${p.inSchoolType===v?" on":""}`} onClick={()=>p.setInSchoolType(p.inSchoolType===v?"":v)}>{l}</button>)}
          </div>
          <div className="note">고교 유형에 따라 같은 등급도 다르게 해석돼요(특목·자사고는 등급이 박하게 나옴).</div>
        </div>

        <div className="f-block">
          <div className="f-label"><i>3</i>지원 희망 대학·학과<small>선택 · 최대 3개</small></div>
          {p.targets.filter(t=>t.u).length>0 && (
            <div className="chips">
              {p.targets.map((t,i)=>t.u?(
                <span key={i} className="target-chip"><i>{i+1}</i>{t.u} {t.d}<button onClick={()=>p.removeTarget(i)} aria-label="삭제">✕</button></span>
              ):null)}
            </div>
          )}
          {!full && (
            <div className="search-wrap">
              <input className="inp" value={q} placeholder="예) 고려 경영, 서울대 사학" autoComplete="off"
                onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)}
                onKeyDown={e=>{ if(e.key==="Enter"){ if(results[0]){p.addTarget(results[0].univ,results[0].dept);setQ("");setOpen(false);} else pickFree(); } }}/>
              {open && q.trim() && (
                <div className="dd">
                  {results.length>0 ? (<>
                    <div className="dd-h">2028 공식 데이터 · 눌러서 추가</div>
                    {results.map((r,i)=>(
                      <div key={i} className="dd-i" onMouseDown={()=>{p.addTarget(r.univ,r.dept);setQ("");setOpen(false);}}>
                        <b>{r.univ}</b><span>{r.dept}</span>{r.college&&<small>{r.college}</small>}
                      </div>))}
                  </>) : (
                    <div className="dd-i" onMouseDown={pickFree}><span>목록에 없어요 — <b>“{q.trim()}”</b> 그대로 추가 (Enter)</span></div>
                  )}
                </div>
              )}
            </div>
          )}
          <input className="inp" value={p.inMajor} onChange={e=>p.setInMajor(e.target.value)} placeholder="대학은 미정이면 희망 전공만 입력 (예: 사학과)" autoComplete="off"/>
        </div>

        <div className="f-block">
          <div className="f-label"><i>4</i>이름<small>선택 · 비우면 파일에서 자동 인식</small></div>
          <input className="inp" value={p.inName} onChange={e=>p.setInName(e.target.value)} placeholder="홍길동" autoComplete="off"/>
        </div>

        {p.err && <div className="err">⚠ {p.err}</div>}
        {!p.err && p.truncWarning && <div className="warn">ℹ️ {p.truncWarning}</div>}
        {p.step && (
          <div className="prog">
            <div className="prog-bar"><i style={{width:p.prog+"%"}}/></div>
            <div className="prog-t"><span>{p.step}</span><span className="mono">{p.prog}%</span></div>
          </div>
        )}
        <button className="cta" disabled={!ready||p.busy} onClick={p.run}>{p.busy?"분석 중입니다…":"분석 시작하기"}</button>
        <div className="note">입력하신 정보는 분석을 위해서만 쓰이며 실명·학교명은 AI에 전달하기 전에 가려집니다.</div>
      </div>
    </section>
  </div>);
}
