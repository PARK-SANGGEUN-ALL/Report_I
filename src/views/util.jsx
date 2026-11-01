import React from "react";
// 리치 텍스트: **강조** / 《핵심》 / 「키워드」 → 가독성 있는 JSX. 남은 별표는 제거.
export function rich(text){
  if(text==null) return null;
  const s=String(text);
  const parts=[]; let last=0, k=0;
  const re=/(\*\*([^*]+)\*\*|《([^》]+)》|「([^」]+)」)/g; let m;
  while((m=re.exec(s))){
    if(m.index>last) parts.push(s.slice(last,m.index).replace(/\*\*/g,""));
    if(m[2]) parts.push(<strong key={k++}>{m[2]}</strong>);
    else if(m[3]) parts.push(<mark key={k++}>{m[3]}</mark>);
    else parts.push(<span key={k++} className="kw">{m[4]}</span>);
    last=m.index+m[0].length;
  }
  if(last<s.length) parts.push(s.slice(last).replace(/\*\*/g,""));
  return parts;
}
export const firstSentence=(s,n=90)=>{ const t=String(s||"").replace(/\s+/g," ").trim(); const i=t.search(/[.다요]\s/); const cut=i>20&&i<n+40?t.slice(0,i+1):t.slice(0,n); return cut+(cut.length<t.length&&cut===t.slice(0,n)?"…":""); };
export function getMajorRelatedGroups(major){
  const m=String(major||"").toLowerCase();
  if(/공학|컴퓨터|전기|전자|기계|화공|신소재|반도체|로봇|항공|건축|토목|산업/.test(m)) return ["수학","과학"];
  if(/의학|약학|간호|보건|생명|의예|치의|한의|약/.test(m)) return ["수학","과학"];
  if(/수학|물리|화학|지구|천문|통계/.test(m)) return ["수학","과학"];
  if(/경영|경제|회계|금융|상경/.test(m)) return ["수학","사회","영어"];
  if(/법|행정|정치|외교|사회|심리/.test(m)) return ["국어","사회","영어"];
  if(/국어|국문|언어|문학|역사|철학|문화/.test(m)) return ["국어","사회","영어"];
  if(/영어|영문|외국어|국제|글로벌/.test(m)) return ["영어","국어","사회"];
  if(/교육/.test(m)) return ["국어","수학","영어","사회"];
  return ["국어","수학","영어"];
}
export const lvN=n=>parseInt(n)||0;
export const verdictTone=v=>/안정|유리/.test(v||"")?"good":/적정|보통/.test(v||"")?"brand":/소신/.test(v||"")?"warn":"bad";
export const Depth=({n})=> <span className="depth" title={`탐구 깊이 ${n}단계`}>{[1,2,3,4].map(i=><i key={i} className={i<=n?"on":""}/>)}</span>;
