import React from "react";

/* 레이더 — values:[{label,value(0~100),text}] */
export function Radar({values,size=270,color="#0f9a90"}){
  const n=values.length,c=size/2,R=size/2-46; const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const P=(i,r)=>[c+Math.cos(ang(i))*r,c+Math.sin(ang(i))*r];
  const ring=f=>values.map((_,i)=>P(i,R*f).join(",")).join(" ");
  const poly=values.map((v,i)=>P(i,R*Math.max(.04,Math.min(1,v.value/100))).join(",")).join(" ");
  return (<svg viewBox={`0 0 ${size} ${size}`} style={{width:"100%",maxWidth:size,height:"auto"}}>
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color} stopOpacity=".55"/><stop offset="1" stopColor="#f0a931" stopOpacity=".35"/></linearGradient></defs>
    {[.25,.5,.75,1].map(f=><polygon key={f} points={ring(f)} fill={f===1?"rgba(255,255,255,.35)":"none"} stroke="#cfc3b5" strokeWidth={f===1?1.4:1} strokeDasharray={f===1?"":"3 4"}/>)}
    {values.map((_,i)=><line key={i} x1={c} y1={c} x2={P(i,R)[0]} y2={P(i,R)[1]} stroke="#d6cabc"/>)}
    <polygon points={poly} fill="url(#rg)" stroke={color} strokeWidth="2.6" strokeLinejoin="round"/>
    {values.map((v,i)=>{const p=P(i,R*Math.max(.04,Math.min(1,v.value/100)));const l=P(i,R+24);return <g key={i}>
      <circle cx={p[0]} cy={p[1]} r="5" fill="#fff" stroke={color} strokeWidth="2.6"/>
      <text x={l[0]} y={l[1]-2} fontSize="12" fontWeight="800" fill="#14203f" textAnchor="middle">{v.label}</text>
      <text x={l[0]} y={l[1]+12} fontSize="11" fontWeight="700" fill="#8b8478" textAnchor="middle">{v.text}</text></g>;})}
  </svg>);
}

/* 반원 게이지 */
export function Gauge({value,max=100,label,sub}){
  const v=Math.max(0,Math.min(1,value/max)); const W=240,H=140,cx=120,cy=120,R=92;
  const pt=(f)=>{const a=Math.PI*(1-f);return [cx+Math.cos(a)*R,cy-Math.sin(a)*R];};
  const seg=(a,b,col)=>{const [x1,y1]=pt(a),[x2,y2]=pt(b);return <path key={a} d={`M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`} stroke={col} strokeWidth="16" fill="none" strokeLinecap="butt"/>;};
  const [nx,ny]=pt(v);
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W}}>
    {[[0,.6,"#e9b4b8"],[.6,.7,"#f3cf8f"],[.7,.8,"#bfe3c9"],[.8,.9,"#69c3b0"],[.9,1,"#0f9a90"]].map(([a,b,c])=>seg(a,b,c))}
    <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#14203f" strokeWidth="4" strokeLinecap="round"/><circle cx={cx} cy={cy} r="8" fill="#14203f"/>
    <text x={cx} y={cy-26} fontSize="34" fontWeight="900" fill="#14203f" textAnchor="middle" fontFamily="DM Mono,monospace">{label}</text>
    <text x={cx} y={cy+20} fontSize="11.5" fontWeight="800" fill="#8b8478" textAnchor="middle">{sub}</text>
    <text x="22" y="136" fontSize="10" fill="#8b8478">0</text><text x="208" y="136" fontSize="10" fill="#8b8478">{max}</text>
  </svg>);
}

/* 확률 범위 바 */
export function RangeBar({min,max,color="#0f9a90"}){
  if(min==null) return <span className="note">-</span>;
  return (<div><div className="rb"><i style={{left:min+"%",width:Math.max(3,max-min)+"%",background:color}}/></div>
    <div className="rb-t"><span>0</span><b style={{color}}>{min}~{max}%</b><span>100</span></div></div>);
}

/* 가산·감산 폭포 바 */
export function Waterfall({score,max,plus=[],minus=[],color}){
  const num=s=>{const m=String(s??"").replace("−","-").match(/-?\d+(\.\d+)?/);return m?parseFloat(m[0]):0;};
  const P=plus.reduce((a,x)=>a+Math.abs(num(x.points)),0), M=minus.reduce((a,x)=>a+Math.abs(num(x.points)),0);
  const base=Math.max(0,(score||0)-P+M); const pc=v=>Math.max(0,Math.min(100,v/max*100));
  return (<div style={{margin:"10px 0 4px"}}>
    <div style={{position:"relative",height:22,borderRadius:99,boxShadow:"var(--sh-in)",overflow:"hidden",background:"rgba(255,255,255,.25)"}}>
      <div style={{position:"absolute",left:0,top:3,bottom:3,width:pc(base)+"%",background:color,borderRadius:99,opacity:.9}}/>
      <div style={{position:"absolute",left:pc(base)+"%",top:3,bottom:3,width:pc(P)+"%",background:"#2f9e6f",opacity:.9}}/>
      <div style={{position:"absolute",left:pc(base+P-M)+"%",top:3,bottom:3,width:pc(M)+"%",background:"repeating-linear-gradient(45deg,#d2495a,#d2495a 4px,#f0b3ba 4px,#f0b3ba 8px)",borderRadius:4}}/>
      <div style={{position:"absolute",left:pc(score)+"%",top:0,bottom:0,width:3,background:"#14203f"}}/>
    </div>
    <div style={{display:"flex",gap:12,fontSize:11,color:"var(--ink3)",marginTop:5,flexWrap:"wrap",fontWeight:700}}>
      <span><i style={{display:"inline-block",width:9,height:9,borderRadius:3,background:color,marginRight:4}}/>기본 {base}</span>
      <span><i style={{display:"inline-block",width:9,height:9,borderRadius:3,background:"#2f9e6f",marginRight:4}}/>＋{P}</span>
      <span><i style={{display:"inline-block",width:9,height:9,borderRadius:3,background:"#d2495a",marginRight:4}}/>－{M}</span>
      <span style={{marginLeft:"auto",color:"var(--ink)"}}>최종 {score} / {max}</span></div></div>);
}

/* 합격선 지도 — 티어별 참고컷 분포 위에 내 위치 */
export function PositionMap({tiers,student,is5}){
  const lo=1,hi=is5?4:6; const W=720,rowH=44,H=tiers.length*rowH+60,px=116,rx=W-30;
  const X=v=>px+(Math.min(hi,Math.max(lo,v))-lo)/(hi-lo)*(rx-px);
  const ticks=Array.from({length:hi-lo+1},(_,i)=>lo+i); const sx=student!=null?X(student):null;
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
    {sx!=null&&<><rect x={px} y="14" width={sx-px} height={tiers.length*rowH+4} fill="rgba(210,73,90,.07)"/><rect x={sx} y="14" width={rx-sx} height={tiers.length*rowH+4} fill="rgba(15,154,144,.08)"/></>}
    {ticks.map(t=><g key={t}><line x1={X(t)} x2={X(t)} y1="14" y2={tiers.length*rowH+18} stroke="#d9cfc3" strokeDasharray="3 4"/><text x={X(t)} y={tiers.length*rowH+36} fontSize="12" fontWeight="800" fill="#8b8478" textAnchor="middle">{t}등급</text></g>)}
    {tiers.map((t,i)=>{const y=14+i*rowH+rowH/2;return <g key={i}>
      <text x="8" y={y+4} fontSize="12.5" fontWeight="900" fill={t.color}>{t.tier}</text>
      <line x1={px} x2={rx} y1={y} y2={y} stroke="#e1d7cb" strokeWidth="6" strokeLinecap="round"/>
      {t.univs.filter(u=>!u.artsNote&&(u.cutShow||u.cut)).map((u,j)=><g key={j}><circle cx={X(u.cutShow||u.cut)} cy={y} r="7" fill={t.color} stroke="#fff" strokeWidth="2"/><title>{u.name} · 참고컷 {u.cutShow||u.cut}</title></g>)}</g>;})}
    {sx!=null&&<g><line x1={sx} x2={sx} y1="8" y2={tiers.length*rowH+20} stroke="#14203f" strokeWidth="3"/>
      <rect x={sx-40} y="-2" width="80" height="20" rx="10" fill="#14203f"/><text x={sx} y="12" fontSize="11.5" fontWeight="900" fill="#fff" textAnchor="middle">내 평균 {Number(student).toFixed(2)}</text></g>}
    <text x={px+4} y={H-6} fontSize="11" fill="#d2495a" fontWeight="800">◀ 내 등급보다 높은 컷(도전)</text>
    <text x={rx-4} y={H-6} fontSize="11" fill="#0b7a77" fontWeight="800" textAnchor="end">내 등급보다 낮은 컷(여유) ▶</text>
  </svg>);
}

/* 학기별 탐구 깊이 막대 */
export function DepthBars({cols,acts}){
  const W=620,H=170,px=34,bw=44,gap=(W-px-10)/cols.length; const mx=Math.max(3,...cols.map(c=>acts.filter(a=>a.key===c).length));
  const col=["#cdbfae","#7cc5bb","#0f9a90","#f0a931"];
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
    {[0,.5,1].map(f=><line key={f} x1={px} x2={W-6} y1={H-30-(H-60)*f} y2={H-30-(H-60)*f} stroke="#dfd5c9" strokeDasharray="3 4"/>)}
    {cols.map((c,i)=>{const list=acts.filter(a=>a.key===c);let y=H-30;const x=px+i*gap+gap/2-bw/2;
      return <g key={c}>{[1,2,3,4].map(d=>{const k=list.filter(a=>a.depthN===d).length;const h=k/mx*(H-60);y-=h;return k?<rect key={d} x={x} y={y} width={bw} height={h-2} rx="6" fill={col[d-1]}><title>{d}단계 {k}건</title></rect>:null;})}
        <text x={x+bw/2} y={H-12} fontSize="12" fontWeight="800" fill="#44506b" textAnchor="middle">{c.replace("-","·")}학기</text>
        <text x={x+bw/2} y={y-6} fontSize="12" fontWeight="900" fill="#14203f" textAnchor="middle">{list.length||"0"}</text></g>;})}
    {col.map((c,i)=><g key={i}><rect x={W-230+i*57} y="2" width="10" height="10" rx="3" fill={c}/><text x={W-216+i*57} y="11" fontSize="10.5" fill="#8b8478" fontWeight="700">{i+1}단계</text></g>)}
  </svg>);
}

/* 대학 그룹 수준 사다리 — 점수 대신 «어느 그룹 수준인지»를 표시 */
export function TierLadder({ idx, sub, steps }) {
  return (<div className="ladder">
    {steps.map((t, i) => (<div key={i} className={`step${i === idx ? " on" : ""}${i < idx ? " above" : ""}`}>
      <b>{t.short}</b>{i === idx && sub ? <em>{sub}</em> : null}</div>))}
    <div className="ladder-ex">{steps[idx]?.ex}</div></div>);
}

/* 도넛 링 — 이수 충족률 */
export function Ring({ pct, label, sub, color = "#0f9a90", size = 124 }) {
  const r = 44, circ = 2 * Math.PI * r, has = pct != null; const dash = has ? Math.max(0, Math.min(100, pct)) / 100 * circ : 0;
  const col = !has ? "#cdbfae" : pct >= 90 ? "#2f9e6f" : pct >= 70 ? color : pct >= 50 ? "#f0a931" : "#d2495a";
  return (<div style={{ textAlign: "center", width: size }}><svg viewBox="0 0 110 110" style={{ width: size, height: size }}>
    <circle cx="55" cy="55" r={r} fill="none" stroke="#eadfce" strokeWidth="11" />
    <circle cx="55" cy="55" r={r} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 55 55)" />
    <text x="55" y={has ? 58 : 60} fontSize={has ? 25 : 14} fontWeight="900" fill="#14203f" textAnchor="middle" fontFamily="DM Mono,monospace">{has ? pct + "%" : "지정 없음"}</text></svg>
    <div style={{ fontSize: 13, fontWeight: 900, marginTop: -4 }}>{label}</div><div style={{ fontSize: 11.5, color: "#8b8478" }}>{sub}</div></div>);
}

/* 합격 등급 범위 막대 — 50%컷~70%컷 구간과 내 평균등급 위치 (보고서용 선명한 표현) */
export function GradeBand({ c50, c70, lo, hi, student, max = 9 }) {
  const W = 560, H = 78, px = 18, rx = W - 18; const X = v => px + (Math.min(max, Math.max(1, v)) - 1) / (max - 1) * (rx - px);
  const a = c50 != null ? X(c50) : null, b = c70 != null ? X(c70) : null;
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 640, height: "auto", display: "block" }}>
    <line x1={px} x2={rx} y1="40" y2="40" stroke="#14203f" strokeWidth="1.5" />
    {Array.from({ length: max }, (_, i) => i + 1).map(v => <g key={v}><line x1={X(v)} x2={X(v)} y1="35" y2="45" stroke="#14203f" /><text x={X(v)} y="62" fontSize="12" fill="#44506b" textAnchor="middle" fontWeight="700">{v}</text></g>)}
    {lo != null && hi != null && <line x1={X(lo)} x2={X(hi)} y1="40" y2="40" stroke="#7a859c" strokeWidth="5" strokeLinecap="butt" opacity=".55" />}
    {a != null && b != null && <rect x={Math.min(a, b)} y="28" width={Math.max(3, Math.abs(b - a))} height="24" fill="#cdd8ee" stroke="#14203f" strokeWidth="1.5" />}
    {student != null && <g><polygon points={`${X(student)},46 ${X(student) - 7},62 ${X(student) + 7},62`} fill="#b42d3f" /><line x1={X(student)} x2={X(student)} y1="14" y2="46" stroke="#b42d3f" strokeWidth="2" />
      <text x={X(student)} y="11" fontSize="12" fontWeight="900" fill="#b42d3f" textAnchor="middle">내 평균 {Number(student).toFixed(2)}</text></g>}
    {c50 != null && <text x={Math.min(a, b ?? a)} y="24" fontSize="11" fill="#14203f" textAnchor="start" fontWeight="700"></text>}
  </svg>);
}
