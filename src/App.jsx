import { useState, useRef, useEffect, useCallback } from "react";
import { buildPhase1Prompt, buildPhase2Prompt, buildPhase3Prompt, buildPhase4Prompt, buildPhase5Prompt, restorePII, RAW_TEXT_LIMIT } from "./criteria.js";
import { parseStudentRecord, parseAllFromHtml } from "./parser.js";
import { diagnoseUnivFit, SUPPORTED_UNIVS } from "./univCriteria.js";
import { getRecommendedForDept, UNIV_RECOMMENDED_2028, searchUnivDept } from "./univRecommended.js";
import { getBooksForDept, searchBooks } from "./recommendedBooks.js";
import { compareAllUnivs, UNIV_TIERS, isArtsPhysical, ARTS_ADMISSION_INFO, getArtsType, GYOGWA_CUT_2026, estimateProbability, rankRecommendedUnivs, DEPT_VARIANCE_WARNING } from "./prediction2028.js";
import { getJonghapCut } from "./ipgyeol2025.js";
import "./styles.css";
import Intake from "./views/Intake.jsx";
import Report from "./views/Report.jsx";
import { DEMO_G } from "./demoData.js";
import { applyQuant, tierOf, fitWord } from "./scoring.js";
import { computeCoreFit, coreFitText } from "./coreFit.js";
import { achievement2022 } from "./achievement2022.js";

const UNIVS = ["강원대학교","건국대학교","경기대학교","경북대학교","경희대학교","고려대학교","광운대학교","국민대학교","단국대학교","덕성여자대학교","동국대학교","부산대학교","서강대학교","서울과학기술대학교","서울대학교","서울시립대학교","성균관대학교","세종대학교","숙명여자대학교","숭실대학교","아주대학교","연세대학교","이화여자대학교","인하대학교","중앙대학교","한국외국어대학교","한양대학교","홍익대학교"];

// 분석 대기 중 전광판에 흐르는 활용법 안내
const MARQUEE_TIPS = [
  "💡 분석이 끝나면 좌측 메뉴에서 영역별 결과를 확인할 수 있어요",
  "📊 교과 성적은 학기별 추이와 성취도 분포까지 분석됩니다",
  "🎯 추천 학과 TOP 5는 본인 이수 과목·세특을 토대로 역으로 추천해요",
  "🌱 고1·고2는 '성장 로드맵'으로 앞으로 채울 것을 안내받아요",
  "🏛 47개 대학 2028 공식 권장과목과 본인 이수 과목을 비교합니다",
  "🔑 키워드 분석으로 본인을 한 문장으로 정의하는 핵심어를 찾아드려요",
  "📄 종합 리포트는 상담사가 쓴 편지 형식으로 제공됩니다",
  "🎤 면접 예상 질문과 모범 답변 방향까지 준비해드려요",
  "⚡ 학업·탐구·진로·공동체·성장 5개 역량을 100점 만점으로 채점해요",
  "📚 희망 학과에 맞춘 추천 도서와 탐구 연계법을 안내합니다",
];

const COMP=[{k:"academic",n:"학업역량",max:40,c:"#4c6ef5"},{k:"inquiry",n:"탐구역량",max:25,c:"#0c8599"},{k:"career",n:"진로역량",max:15,c:"#d97706"},{k:"community",n:"공동체역량",max:10,c:"#6741d9"},{k:"growth",n:"성장역량",max:10,c:"#2b8a3e"}];
const GC={S:"#2b8a3e",A:"#1971c2",B:"#d97706",C:"#c92a2a",D:"#868e96"};
const GL={S:"최우수",A:"우수",B:"양호",C:"보통",D:"미흡"};
const TC=["#4c6ef5","#0c8599","#d97706","#6741d9","#c92a2a","#2b8a3e"];

// 중요 문구 하이라이트 — **볼드**, 《하이라이트》, [[강조]] 패턴을 시각 강조로 변환
function hl(text){
  if(!text||typeof text!=="string") return text;
  // 패턴: **볼드** | 《하이라이트》 | 「강조」
  const parts=[];
  let last=0;
  const re=/(\*\*([^*]+)\*\*|《([^》]+)》|「([^」]+)」)/g;
  let m,key=0;
  while((m=re.exec(text))!==null){
    if(m.index>last) parts.push(text.slice(last,m.index));
    if(m[2]!==undefined){ // **볼드**
      parts.push(<strong key={key++} style={{color:"#1a1d2e",fontWeight:800}}>{m[2]}</strong>);
    }else if(m[3]!==undefined){ // 《하이라이트》
      parts.push(<mark key={key++} style={{background:"linear-gradient(120deg,#fef08a 0%,#fde047 100%)",padding:"1px 4px",borderRadius:3,fontWeight:700,color:"#713f12"}}>{m[3]}</mark>);
    }else if(m[4]!==undefined){ // 「강조」
      parts.push(<span key={key++} style={{color:"#2745a8",fontWeight:700}}>{m[4]}</span>);
    }
    last=m.index+m[0].length;
  }
  if(last<text.length) parts.push(text.slice(last));
  return parts.length?parts:text;
}

// 키워드 망사그래프 — 원형 배치 + 연결선 (SVG, 의존성 없음)
function KeywordNetwork({network}){
  if(!network?.nodes?.length) return null;
  const W=620, H=420, cx=W/2, cy=H/2;
  const GCOL={학업:"#2745a8",탐구:"#c92a2a",진로:"#d97706",공동체:"#2b8a3e",성장:"#6741d9"};
  const nodes=network.nodes.slice(0,14);
  const center=network.centerKeyword;
  // 중심 노드는 가운데, 나머지는 원형 배치
  const centerIdx=nodes.findIndex(n=>n.id===center);
  const others=nodes.filter((_,i)=>i!==centerIdx);
  const pos={};
  if(centerIdx>=0) pos[nodes[centerIdx].id]={x:cx,y:cy,center:true};
  others.forEach((n,i)=>{
    const ang=(i/others.length)*Math.PI*2 - Math.PI/2;
    const r=Math.min(W,H)*0.36;
    pos[n.id]={x:cx+Math.cos(ang)*r, y:cy+Math.sin(ang)*r};
  });
  // 중심 노드 없으면 첫 노드를 중심처럼
  if(centerIdx<0 && nodes[0]) pos[nodes[0].id]={x:cx,y:cy,center:true};

  return (
    <div className="card print-section" style={{overflow:"hidden"}}>
      <div className="card-eye" style={{color:"#6741d9"}}>🕸 키워드 관계망 (망사그래프)</div>
      <div style={{fontSize:12,color:"var(--ink3)",marginBottom:10}}>키워드 간 연관 관계를 시각화했어요. 중심에 가까울수록 핵심 정체성입니다.</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",maxHeight:440}}>
        {/* 연결선 */}
        {(network.links||[]).map((l,i)=>{
          const s=pos[l.source], t=pos[l.target];
          if(!s||!t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#cbd2e0" strokeWidth="1.5" opacity="0.7"/>;
        })}
        {/* 노드 */}
        {nodes.map((n,i)=>{
          const p=pos[n.id]; if(!p) return null;
          const col=GCOL[n.group]||"#2745a8";
          const r=p.center?34:(14+(n.size||3)*3);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r} fill={col} opacity={p.center?1:0.85}/>
              {p.center && <circle cx={p.x} cy={p.y} r={r+5} fill="none" stroke={col} strokeWidth="2" opacity="0.4"/>}
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={p.center?14:11} fontWeight={p.center?800:600}>{n.id}</text>
            </g>
          );
        })}
      </svg>
      {/* 범례 */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:10,justifyContent:"center"}}>
        {Object.entries(GCOL).map(([g,c])=>(
          <span key={g} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--ink3)"}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:c}}/>{g}
          </span>
        ))}
      </div>
    </div>
  );
}

const NAV=[
  {g:"성적·이수",items:[{id:"s1",ico:"📊",lbl:"교과 성적"},{id:"s2",ico:"🏆",lbl:"이수 기반 추천학과"}]},
  {g:"활동 분석",items:[{id:"s3",ico:"✦",lbl:"강점·보완점"},{id:"s4",ico:"📅",lbl:"활동 타임라인"},{id:"s5",ico:"🔑",lbl:"키워드 분석"}]},
  {g:"역량 분석",items:[{id:"s6",ico:"⚡",lbl:"역량 채점"}]},
  {g:"입시 진단",items:[{id:"s14",ico:"🎯",lbl:"희망 학과 분석"},{id:"s15",ico:"🏛",lbl:"대학 유불리 비교"}]},
  {g:"리포트",items:[{id:"s10",ico:"💡",lbl:"탐구 주제"},{id:"s13",ico:"📚",lbl:"추천 도서"},{id:"s11",ico:"🎤",lbl:"면접 질문"},{id:"s12",ico:"📄",lbl:"종합 리포트"}]},
];

// 그래프 탭 정의 (교과 성적 화면 내부 탭)
const GRAPH_TABS = [
  {id:"all", lbl:"전체 교과", filter:null, group:"종합"},
  {id:"kme", lbl:"국·영·수", filter:["국어","영어","수학"], group:"종합"},
  {id:"kmes", lbl:"국·영·수·사", filter:["국어","영어","수학","사회"], group:"종합"},
  {id:"kmesi", lbl:"국·영·수·과", filter:["국어","영어","수학","과학"], group:"종합"},
  {id:"major", lbl:"전공 연계", filter:"_major_", group:"종합"},
  // 교과별 (특정 교과 추이)
  {id:"subj_kor", lbl:"국어만", filter:["국어"], group:"교과별"},
  {id:"subj_math", lbl:"수학만", filter:["수학"], group:"교과별"},
  {id:"subj_eng", lbl:"영어만", filter:["영어"], group:"교과별"},
  {id:"subj_soc", lbl:"사회만", filter:["사회"], group:"교과별"},
  {id:"subj_sci", lbl:"과학만", filter:["과학"], group:"교과별"},
];

// 희망 전공에 따른 연계 교과군 자동 매핑
function getMajorRelatedGroups(major) {
  const m = String(major||'').toLowerCase();
  if (/공학|컴퓨터|전기|전자|기계|화공|신소재|반도체|로봇|항공|건축|토목|산업/.test(m)) return ["수학","과학"];
  if (/의학|약학|간호|보건|생명|의예|치의|한의|약/.test(m)) return ["수학","과학"];
  if (/수학|물리|화학|지구|천문|통계/.test(m)) return ["수학","과학"];
  if (/경영|경제|회계|금융|상경/.test(m)) return ["수학","사회","영어"];
  if (/법|행정|정치|외교|사회|심리/.test(m)) return ["국어","사회","영어"];
  if (/국어|국문|언어|문학|역사|철학|문화/.test(m)) return ["국어","사회","영어"];
  if (/영어|영문|외국어|국제|글로벌/.test(m)) return ["영어","국어","사회"];
  if (/교육/.test(m)) return ["국어","수학","영어","사회"];
  if (/예술|미술|음악|체육|디자인/.test(m)) return ["예체능","국어","영어"];
  return ["국어","수학","영어"]; // 기본
}

export default function App() {
  const [phase,setPhase]=useState("landing");
  const [pdfB64,setPdfB64]=useState(""); const [fileName,setFileName]=useState("");
  const [htmlContent,setHtmlContent]=useState(""); // 🆕 나이스 대국민서비스 등 HTML(.htm/.html) 학생부 지원
  const [prog,setProg]=useState(0); const [step,setStep]=useState(""); const [err,setErr]=useState("");
  const [truncWarning,setTruncWarning]=useState(""); // 🆕 원문이 너무 길어 일부만 반영될 때 안내
  const [G,setG]=useState(null); const [drag,setDrag]=useState(false); const [busy,setBusy]=useState(false);
  const [sec,setSec]=useState("s1"); const [univTab,setUnivTab]=useState(0); const [reportTab,setReportTab]=useState("summary");
  const [graphTab,setGraphTab]=useState("all"); // 교과 성적 그래프 탭
  const [editMode,setEditMode]=useState(false); // 성적표 수동 편집 모드
  const [editingRow,setEditingRow]=useState(null); // 편집 중인 행 인덱스
  const [inName,setInName]=useState(""); const [inMajor,setInMajor]=useState(""); const [inGrade,setInGrade]=useState(""); const [inCurr,setInCurr]=useState("auto");
  const [inSchoolType,setInSchoolType]=useState(""); // 🆕 고교유형 — 일반고/자사고/특목고 등에 따라 등급 데이터 해석이 달라짐
  // 학년 선택 시 교육과정 자동 결정: 고3 = 2015개정, 고1·고2 = 2022개정
  const syncCurrFromGrade = (g) => {
    setInGrade(g);
    if (g === "3") setInCurr("2015");
    else if (g === "1" || g === "2") setInCurr("2022");
  };
  const [u0,setU0]=useState(""); const [d0,setD0]=useState("");
  const [u1,setU1]=useState(""); const [d1,setD1]=useState("");
  const [u2,setU2]=useState(""); const [d2,setD2]=useState("");
  const [t0,setT0]=useState(""); const [t1,setT1]=useState(""); const [t2,setT2]=useState("");
  const [sg0,setSg0]=useState([]); const [op0,setOp0]=useState(false);
  const [sg1,setSg1]=useState([]); const [op1,setOp1]=useState(false);
  const [sg2,setSg2]=useState([]); const [op2,setOp2]=useState(false);
  // 🆕 통합 자유검색: 각 순위별 검색어 + 드롭다운 열림 상태
  const [q0,setQ0]=useState(""); const [qop0,setQop0]=useState(false);
  const [q1,setQ1]=useState(""); const [qop1,setQop1]=useState(false);
  const [q2,setQ2]=useState(""); const [qop2,setQop2]=useState(false);
  const rTrend=useRef(); const rGroup=useRef();
  const formRef=useRef(); const resRef=useRef();
  const ranks=[{u:u0,d:d0,t:t0},{u:u1,d:d1,t:t1},{u:u2,d:d2,t:t2}];

  const processPdf=useCallback(async file=>{
    if(!file) return;
    const isHtml = file.type==="text/html" || /\.(html?|htm)$/i.test(file.name||"");
    const isPdf = file.type==="application/pdf" || /\.pdf$/i.test(file.name||"");
    if(!isHtml && !isPdf){
      setErr("PDF 또는 HTML(.html/.htm) 파일만 업로드할 수 있습니다.");
      return;
    }
    if(isHtml){
      const text = await file.text();
      setHtmlContent(text); setPdfB64(""); setFileName(file.name); setErr("");
      return;
    }
    // PDF
    const arr=await file.arrayBuffer(); const bytes=new Uint8Array(arr);
    let bin=""; for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]);
    setPdfB64(btoa(bin)); setHtmlContent(""); setFileName(file.name); setErr("");
  },[]);
  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)processPdf(f);},[processPdf]);

  const run=useCallback(async()=>{
    if(!pdfB64 && !htmlContent){setErr("학생부 PDF 또는 HTML 파일을 먼저 업로드하세요");return;}
    setBusy(true); setErr(""); setProg(5); setStep("생기부 텍스트 파싱 중...");
    try{
      // ─── 1단계: 로컬 파싱 (PDF 또는 HTML) ───
      let parsed = htmlContent
        ? await parseAllFromHtml(htmlContent)
        : await parseStudentRecord(pdfB64);
      // 🆕 이미지로 스캔된 PDF(텍스트 레이어 없음) 감지 — 조용히 실패하지 않고 명확히 안내
      if(!htmlContent && (!parsed || !parsed.rawText || parsed.rawText.trim().length < 50)){
        setBusy(false);
        setErr("이 PDF에서 텍스트를 추출하지 못했습니다. 스캔된 이미지 PDF일 가능성이 높습니다 — 나이스 대국민서비스에서 '텍스트 포함' PDF나 HTML(.htm)로 다시 발급받아 업로드해주세요.");
        return;
      }
      if(!parsed || !parsed.rawText || parsed.rawText.length < 300){
        setStep("PDF 원문을 정밀 분석합니다...");
        parsed = parsed || {};
        parsed.rawText = parsed.rawText || "";
        parsed.grades = parsed.grades || [];
        parsed.achievementSubjects = parsed.achievementSubjects || [];
        parsed.activities = parsed.activities || [];
        parsed.studentInfo = parsed.studentInfo || {};
        parsed.gradeAvg = parsed.gradeAvg || "0";
        parsed.pageCount = parsed.pageCount || 0;
        parsed.behaviorOpinion = parsed.behaviorOpinion || {};
      }
      if(parsed.studentInfo?.name && !inName) setInName(parsed.studentInfo.name);
      // 🔥 판독 품질 안내: 원문이 매우 길어 일부만 AI에 전달될 경우 사용자에게 투명하게 고지
      const rtLen = (parsed.rawText||"").length;
      if (rtLen > RAW_TEXT_LIMIT) {
        setTruncWarning(`학생부 원문이 매우 깁니다(약 ${Math.round(rtLen/1000)}천자). 분량이 방대해 일부(약 ${Math.round(RAW_TEXT_LIMIT/1000)}천자 이후)는 이번 분석에 반영되지 않을 수 있습니다.`);
      } else {
        setTruncWarning("");
      }
      // 🆕 사용자가 선택한 고교 유형을 parsed에 실어서 모든 Phase 프롬프트에 전달
      parsed.schoolType = inSchoolType || "";

      // 🆕 교육과정 결정: 사용자 입력(학년) 우선, 없으면 PDF 자동 감지
      let finalCurr = inCurr;
      if (!finalCurr || finalCurr === "auto") {
        finalCurr = parsed.curriculum || "2015";
        console.log(`[App] 교육과정 자동 감지 사용: ${finalCurr} (사용자 미입력)`);
      } else {
        console.log(`[App] 교육과정 사용자 입력 사용: ${finalCurr} (PDF 감지: ${parsed.curriculum})`);
      }

      // 🆕 분석 단계 결정: 학년 입력값 + 파서 감지 통합
      // 사용자가 학년 입력했으면 그것 우선, 파서의 마지막 학기 정보로 보정
      let finalStage = parsed.stage || "complete";
      let finalStageLabel = parsed.stageLabel || "완성기";
      if (inGrade === "1") {
        finalStage = "planning"; finalStageLabel = "설계기 (고1)";
      } else if (inGrade === "2") {
        finalStage = "planning"; finalStageLabel = "설계기 (고2)";
      } else if (inGrade === "3") {
        // 고3 입력 → 파서가 3학년 데이터 감지했는지로 완성/마무리 구분
        const has3 = parsed.grades?.some(g => parseInt(g.gN) === 3) || parsed.achievementSubjects?.some(a => parseInt(a.gN) === 3);
        if (has3) { finalStage = "complete"; finalStageLabel = "완성기 (고3 최종)"; }
        else { finalStage = "finishing"; finalStageLabel = "마무리기 (고3, 3-1 미입력)"; }
      }
      parsed.stage = finalStage;
      parsed.stageLabel = finalStageLabel;
      console.log(`[App] 분석 단계: ${finalStageLabel} (stage=${finalStage})`);

      // ─── 2단계: 지원 희망 대학별 권장과목 사전 매칭 ───
      setProg(15); setStep("대학별 권장과목 매칭 중...");
      const univFitData = ranks
        .filter(r => r.u && r.d)
        .map(r => {
          // 대학명 정규화 (예: "고려대학교" → "고려대")
          const univShort = r.u.replace(/학교$/, '').replace(/대$/, '대');
          const cleaned = r.u.replace(/대학교$/, '대').replace(/대학$/, '대');
          // SUPPORTED_UNIVS에서 가장 잘 매칭되는 키 찾기
          const matchKey = SUPPORTED_UNIVS.find(k => 
            k === cleaned || k === univShort || r.u.includes(k) || k.includes(cleaned)
          ) || cleaned;
          const base = diagnoseUnivFit(matchKey, r.d, parsed.grades, parsed.achievementSubjects);
          
          // 🆕 2028 권장과목 공식 데이터 추가 — 2022 개정(고1·2)만 적용. 고3(2015)은 제외
          if (finalCurr === "2022") {
            const official2028 = getRecommendedForDept(r.u, r.d);
            if (official2028 && official2028.length > 0) {
              base.official2028 = official2028;  // 공식 권장과목 (핵심+권장)
            }
          }
          return base;
        });

      // ─── 3단계: Phase 1 프롬프트 생성 (구조 데이터 추출) ───
      setProg(25); setStep("성적·활동·역량 정밀 추출 중... (40~60초)");
      const phase1Prompt = buildPhase1Prompt(parsed, inName||parsed.studentInfo?.name, inMajor, finalCurr, ranks, univFitData);

      // 강력한 파싱 함수 — analyze.js의 parseResponse와 동일 로직
      const safeParse = (raw, label) => {
        if (!raw || typeof raw !== 'string') return {};
        let cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
        if (cleaned.charCodeAt(0) === 0xFEFF) cleaned = cleaned.slice(1);
        // JSON_START / JSON_END 마커 추출
        const sM = cleaned.indexOf('JSON_START');
        const eM = cleaned.lastIndexOf('JSON_END');
        if (sM >= 0 && eM > sM) cleaned = cleaned.slice(sM+'JSON_START'.length, eM).trim();
        // 1차 시도
        try { return JSON.parse(cleaned); } catch(e1) {}
        // 2차: { } 구간 추출
        const fb = cleaned.indexOf('{'), lb = cleaned.lastIndexOf('}');
        if (fb >= 0 && lb > fb) {
          const sub = cleaned.slice(fb, lb+1);
          try { return JSON.parse(sub); } catch(e2) {
            // 3차: sanitize
            try {
              const fixed = sub
                .replace(/\\([^"\\/bfnrtu])/g, '$1')
                .replace(/("(?:[^"\\]|\\.)*?")|[\r\n]+/g, (m,p)=>p?p:' ')
                .replace(/,(\s*[}\]])/g, '$1');
              return JSON.parse(fixed);
            } catch(e3) {
              // 4차: 잘림 복구
              let depth=0, inStr=false, esc=false, lastComma=-1;
              for (let i=0; i<sub.length; i++) {
                const c=sub[i];
                if(esc){esc=false;continue;}
                if(c==='\\' && inStr){esc=true;continue;}
                if(c==='"'){inStr=!inStr;continue;}
                if(inStr) continue;
                if(c==='{'||c==='[') depth++;
                else if(c==='}'||c===']') depth--;
                if(c===',' && depth>=1) lastComma=i;
              }
              if (depth>0 && lastComma>0) {
                let trunc = sub.slice(0, lastComma);
                let stack=[], d=0, inS=false, eS=false;
                for (let i=0; i<trunc.length; i++) {
                  const c=trunc[i];
                  if(eS){eS=false;continue;}
                  if(c==='\\' && inS){eS=true;continue;}
                  if(c==='"'){inS=!inS;continue;}
                  if(inS) continue;
                  if(c==='{') stack.push('}');
                  else if(c==='[') stack.push(']');
                  else if(c==='}'||c===']') stack.pop();
                }
                trunc += stack.reverse().join('');
                try { return JSON.parse(trunc); } catch(e4) {}
              }
            }
          }
        }
        console.error(`[${label}] 파싱 실패. 첫 500자:`, cleaned.slice(0,500));
        return {};
      };

      // 🆕 자동 재시도 헬퍼 (Phase 실패 시 1번 더 시도)
      const callPhaseWithRetry = async (phaseName, prompt, label, extra) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            // Phase 1만 parsed 데이터 추가 전송 (성적표 등 구조화 데이터). 나머지는 프롬프트 자체에 모든 내용 포함.
            const body = phaseName === "phase1" ? {
              prompt,
              phase: phaseName,
              parsed:{
                grades:parsed.grades,
                achievementSubjects:parsed.achievementSubjects,
                gradeAvg:parsed.gradeAvg,
                studentInfo:parsed.studentInfo,
                behaviorOpinion:parsed.behaviorOpinion
              }
            } : {
              prompt,
              phase: phaseName,
              ...(extra || {})
            };

            const resp = await fetch("/api/analyze",{
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify(body)
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(()=>({error:`status ${resp.status}`}));
              console.warn(`[${label}] 시도 ${attempt} 실패:`, errData.error);
              if (attempt < 2) continue;
              throw new Error(errData.error || `${label} 서버 오류`);
            }
            const data = await resp.json();
            const raw = data.content?.find(b=>b.type==="text")?.text || "{}";
            const parsed_ = safeParse(raw, label);
            const keys = Object.keys(parsed_);
            console.log(`[App] ${label} 시도 ${attempt}: ${keys.length}개 키`, keys);
            if (keys.length === 0 && attempt < 2) {
              console.warn(`[${label}] 빈 응답, 재시도`);
              continue;
            }
            return parsed_;
          } catch(e) {
            console.warn(`[${label}] 시도 ${attempt} 예외:`, e.message);
            if (attempt >= 2) {
              if (phaseName === "phase1") throw e;
              return {};
            }
          }
        }
        return {};
      };

      // ═══════════════════════════════════════════════════
      // 5개 Phase 분석 — 각 응답 작아서 안 잘림
      // ═══════════════════════════════════════════════════

      // ─── Phase 1: 성적·이수·교육과정 (재시도 포함) ───
      setProg(20); setStep("📊 1/5: 성적·이수·교육과정 분석 중... (30~50초)");
      let json = await callPhaseWithRetry("phase1", phase1Prompt, "Phase 1");
      if (Object.keys(json).length === 0) {
        throw new Error("Phase 1 응답 파싱 실패. 콘솔 로그를 확인하세요.");
      }

      // 🆕 분석 단계 정보 저장 (화면 표시용)
      json.stage = parsed.stage;
      json.stageLabel = parsed.stageLabel;

      // ═══════════════════════════════════════════════════════
      // Phase 2~5 병렬 실행 (Phase 1 결과 기반, 서로 독립적으로 동시 실행)
      // 분량 그대로 유지하면서 총 분석 시간 약 5분 → 2분으로 단축
      // ═══════════════════════════════════════════════════════
      setProg(40); setStep("정밀 분석 가동 — 4개 분석 엔진 동시 실행 중... (60~90초)");
      const nameForPrompt = inName||parsed.studentInfo?.name;

      // 🆕 「그들이 좋아하는 탐구」 기반 탐구 수준 지식(희망 학과군별 적정 수준) — 분석 시점에만 로드
      let levelText = "", levelInfo = null;
      try {
        const lb = await import("./levelBlock.js");
        const tg = ranks.filter(r => r.u && r.d);
        levelText = lb.buildLevelBlock({ targets: tg, major: inMajor });
        levelInfo = lb.levelInfoFor({ targets: tg, major: inMajor });
      } catch (e) { console.warn("[levelBlock] 로드 실패 — 기본 기준만 사용", e?.message); }
      // 🆕 지원 학과 핵심·권장과목 이수 충족 현황(코드 산정) — 진로역량·희망학과 분석 근거
      try {
        const cf0 = computeCoreFit({ grades: [...(json.grades || []), ...(parsed.grades || [])], achievementSubjects: [...(json.achievementSubjects || []), ...(parsed.achievementSubjects || [])], curriculum: finalCurr }, ranks.filter(r => r.u && r.d), finalCurr);
        const ct = coreFitText(cf0, finalCurr); if (ct) levelText = levelText + "\n\n" + ct;
      } catch (e) { console.warn("[coreFit]", e?.message); }
      const phase2Prompt = buildPhase2Prompt(parsed, json, nameForPrompt, inMajor, finalCurr, ranks, univFitData, levelText);
      const phase3Prompt = buildPhase3Prompt(parsed, json, {}, nameForPrompt, inMajor, finalCurr, ranks, univFitData, levelText);
      const phase4Prompt = buildPhase4Prompt(parsed, json, {}, {}, nameForPrompt, inMajor, finalCurr, ranks, univFitData);
      // 🆕 업로드 자료 기반 실제 2028 전형 현황·학과별 입결 블록 (분석 시점에만 로드)
      let extraBlock = "";
      try {
        const pb = await import("./planBlock.js");
        extraBlock = pb.buildExtra({ targets: ranks.filter(r => r.u && r.d), is2022: (finalCurr||"").includes("2022"), gradeAvg: json.gradeAvg });
      } catch (e) { console.warn("[planBlock] 로드 실패 — 기본 근거만 사용", e?.message); }
      const phase5Prompt = buildPhase5Prompt(parsed, json, {}, {}, nameForPrompt, ranks, univFitData, extraBlock + "\n\n" + levelText);

      // 🆕 Phase5용 웹 검색 대상 — 사용자가 입력한 지원 희망 대학·학과(1~3순위)를 중복 제거해서 전달
      const searchTargets = ranks
        .filter(r => r.u && r.d)
        .map(r => ({ univ: r.u, dept: r.d }))
        .filter((t, i, arr) => arr.findIndex(x => x.univ===t.univ && x.dept===t.dept) === i);

      // 진행률을 시간 기반으로 부드럽게 증가
      let tick = 40;
      const progTimer = setInterval(() => {
        tick = Math.min(tick + 1, 88);
        setProg(tick);
      }, 1200);

      // 4개 Phase 동시 실행
      const [phase2Json, phase3Json, phase4Json, phase5Json] = await Promise.all([
        callPhaseWithRetry("phase2", phase2Prompt, "Phase 2"),
        callPhaseWithRetry("phase3", phase3Prompt, "Phase 3"),
        callPhaseWithRetry("phase4", phase4Prompt, "Phase 4"),
        callPhaseWithRetry("phase5", phase5Prompt, "Phase 5", { searchTargets }),
      ]);
      clearInterval(progTimer);

      // Phase 2 결과 병합 (강점·활동·키워드)
      if (phase2Json.strengths) json.strengths = phase2Json.strengths;
      if (phase2Json.weaknesses) json.weaknesses = phase2Json.weaknesses;
      if (phase2Json.activities) json.activities = phase2Json.activities;
      if (phase2Json.activityInsight) json.activityInsight = phase2Json.activityInsight;
      if (phase2Json.inquiryThreads) json.inquiryThreads = phase2Json.inquiryThreads;
      if (phase2Json.connectionAnalysis) json.connectionAnalysis = phase2Json.connectionAnalysis;
      if (phase2Json.keywords) json.keywords = phase2Json.keywords;
      if (phase2Json.keywordAnalysis) json.keywordAnalysis = phase2Json.keywordAnalysis;
      if (phase2Json.methodAnalysis) json.methodAnalysis = phase2Json.methodAnalysis;
      // Phase 3 결과 병합 (역량·추천학과)
      if (phase3Json.competencies) json.competencies = phase3Json.competencies;
      if (phase3Json.recommendedMajors) json.recommendedMajors = phase3Json.recommendedMajors;
      if (phase3Json.scoreSummary) json.scoreSummary = phase3Json.scoreSummary;
      // 🔧 중요: 상단 히어로에 표시되는 총점(totalScore)은 Phase1이 독자적으로(채점 앵커 없이)
      // 생성한 값이 아니라, 반드시 SCORING_RUBRIC의 엄격한 앵커가 적용된 Phase3 5개 역량
      // 점수의 실제 합계로 재계산한다. 그래야 "총점만 후하게 나옴" 문제가 재발하지 않는다.
      if (phase3Json.competencies) {
        const compSum = Object.values(phase3Json.competencies).reduce((s,c)=> s + (Number(c?.score) || 0), 0);
        if (compSum > 0) json.totalScore = Math.round(compSum);
      }
      // Phase 4 결과 병합 (탐구·면접·종합리포트)
      if (phase4Json.topics) json.topics = phase4Json.topics;
      if (phase4Json.interviewQs) json.interviewQs = phase4Json.interviewQs;
      if (phase4Json.reportLetter) json.reportLetter = phase4Json.reportLetter;
      if (phase4Json.summaryLetter) json.summaryLetter = phase4Json.summaryLetter;
      if (phase4Json.readingStrategy) json.readingStrategy = phase4Json.readingStrategy;
      // Phase 5 결과 병합 (희망학과·대학비교)
      if (phase5Json.deptReports) json.deptReports = phase5Json.deptReports;
      if (phase5Json.topUnivCompare) json.topUnivCompare = phase5Json.topUnivCompare;
      if (phase5Json.tierAnalysis) json.tierAnalysis = phase5Json.tierAnalysis;
      if (phase5Json.univRecommendRank) json.univRecommendRank = phase5Json.univRecommendRank;
      if (phase5Json.deptRecommendRank) json.deptRecommendRank = phase5Json.deptRecommendRank;
      if (phase5Json.finalRecommendation) json.finalRecommendation = phase5Json.finalRecommendation;
      if (phase5Json.executiveSummary) json.executiveSummary = phase5Json.executiveSummary;
      // 🆕 정량 채점: 학업·탐구역량은 코드 계산 기본점수 ±3으로 확정, 총점 재합산
      // 🆕 AI가 뽑은 성적표에 로컬 파서의 성취도·분포비율·수강자수를 합치고(과목 단위), 빠진 과목은 채운다
      try {
        const gk = (r) => `${r.grade}|${r.semester}|${String(r.subject||"").replace(/\s+/g,"")}`; const pm = new Map((parsed.grades||[]).map(r => [gk(r), r]));
        json.grades = (json.grades || []).map(r => { const q = pm.get(gk(r)); return q ? { ...r, achievement: r.achievement || q.achievement, distribution: r.distribution || q.distribution, students: r.students || q.students, rawScore: r.rawScore || q.rawScore, avg: r.avg || q.avg, sd: r.sd || q.sd } : r; });
        const have = new Set(json.grades.map(gk)); (parsed.grades||[]).forEach(r => { if (!have.has(gk(r))) json.grades.push(r); });
        const ak = (r) => `${r.grade}|${r.semester}|${String(r.subject||"").replace(/\s+/g,"")}`; const haveA = new Set((json.achievementSubjects||[]).map(ak));
        (parsed.achievementSubjects||[]).forEach(r => { if (!haveA.has(ak(r))) (json.achievementSubjects = json.achievementSubjects || []).push(r); });
        json._ach2022 = achievement2022(json);
      } catch (e) { console.warn("[ach2022]", e?.message); }
      try { json._coreFit = computeCoreFit({ grades: [...(json.grades || []), ...(parsed.grades || [])], achievementSubjects: [...(json.achievementSubjects || []), ...(parsed.achievementSubjects || [])], curriculum: finalCurr }, ranks.filter(r => r.u && r.d), finalCurr); } catch (e) { console.warn('[coreFit]', e?.message); }
      try { applyQuant(json, inMajor || (ranks.find(r => r.d) || {}).d); } catch (e) { console.warn('[quant]', e?.message); }
      json._levelInfo = levelInfo;
      try { const pb2 = await import("./planBlock.js"); (json.finalRecommendation?.top10 || []).forEach(r => { try { r._cut = pb2.cutInfoFor(r.univ, r.dept, r.admissionType); } catch (e) {} }); (json.deptReports || []).forEach(d => { try { const tg = ranks.find(x => x.u === d.univ && x.d === d.dept); d._cut = pb2.cutInfoFor(d.univ, d.dept, (tg && tg.t) || d.strategy?.전형추천 || "학생부종합"); } catch (e) {} }); } catch (e) { console.warn("[cutInfo]", e?.message); }

      setProg(90); setStep("결과 후처리 중...");

      // 🔒 개인정보 최소화 복원 — AI에게는 "학생"/"OO고등학교" 플레이스홀더로만 전달했으므로,
      // 화면에 보여줄 때만 로컬(브라우저)에서 실제 이름/학교로 치환한다. 서버·AI로는 다시 보내지 않음.
      const realNameForRestore = inName || parsed.studentInfo?.name || "";
      const realSchoolForRestore = parsed.studentInfo?.school || "";
      const restoreDeep = (val) => {
        if (typeof val === "string") return restorePII(val, realNameForRestore, realSchoolForRestore);
        if (Array.isArray(val)) return val.map(restoreDeep);
        if (val && typeof val === "object") {
          const out = {};
          for (const k in val) out[k] = restoreDeep(val[k]);
          return out;
        }
        return val;
      };
      json = restoreDeep(json);
      // 🔒 안전망: AI가 실수로 내부 자료명(예: "(REAL_ADMISSION_EVIDENCE: ...)",
      // "UNIV_EVAL_INSIGHTS" 등 영문 대문자+언더스코어 변수명)을 텍스트에 그대로 노출했다면
      // 화면에 보이기 전에 여기서 마지막으로 걸러낸다.
      const INTERNAL_NAME_KEYWORDS = /REAL_ADMISSION_EVIDENCE|REAL_CASE_STUDIES_2026|UNIV_EVAL_INSIGHTS|SCORING_RUBRIC|QUALITATIVE_EVAL_SIGNALS|GRADE_SYSTEM_NOTE|TRENDS_2028|JSON_START|JSON_END/;
      const stripInternalNames = (val) => {
        if (typeof val === "string") {
          if (!INTERNAL_NAME_KEYWORDS.test(val)) return val;
          // 알려진 내부 변수명이 포함된 괄호 구절만 제거 (일반 텍스트는 건드리지 않음)
          return val.replace(/\([^()]*(?:REAL_ADMISSION_EVIDENCE|REAL_CASE_STUDIES_2026|UNIV_EVAL_INSIGHTS|SCORING_RUBRIC|QUALITATIVE_EVAL_SIGNALS|GRADE_SYSTEM_NOTE|TRENDS_2028)[^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
        }
        if (Array.isArray(val)) return val.map(stripInternalNames);
        if (val && typeof val === "object") {
          const out = {};
          for (const k in val) out[k] = stripInternalNames(val[k]);
          return out;
        }
        return val;
      };
      json = stripInternalNames(json);
      if(json.studentName && !inName) setInName(json.studentName);

      // ─── 6단계: 로컬 폴백 보강 ───
      // 🔧 AI가 grades 배열을 "일부만" 추출해 특정 과목(예: 3학년 1학기 확률과 통계)이
      // 누락되는 문제가 있어, 이제 전부 없을 때만 대체하는 게 아니라 "합집합으로 병합"한다.
      // 로컬 파서(parser.js)가 원문에서 직접 뽑은 과목 중 AI 목록에 없는 것을 채워 넣는다.
      const gradeKey = (r) => `${r.grade}|${r.semester}|${String(r.subject||"").replace(/\s+/g,"")}`;
      if (parsed.grades?.length > 0) {
        const existing = new Set((json.grades || []).map(gradeKey));
        const missing = parsed.grades.filter(r => !existing.has(gradeKey(r)));
        if (missing.length > 0) {
          json.grades = [...(json.grades || []), ...missing];
        }
        if (!json.grades || json.grades.length === 0) json.grades = parsed.grades;
      }
      if (parsed.achievementSubjects?.length > 0) {
        const existingA = new Set((json.achievementSubjects || []).map(gradeKey));
        const missingA = parsed.achievementSubjects.filter(r => !existingA.has(gradeKey(r)));
        if (missingA.length > 0) {
          json.achievementSubjects = [...(json.achievementSubjects || []), ...missingA];
        }
        if (!json.achievementSubjects || json.achievementSubjects.length === 0) json.achievementSubjects = parsed.achievementSubjects;
      }
      if((!json.gradeAvg || json.gradeAvg==="0" || json.gradeAvg==="") && parsed.gradeAvg && parsed.gradeAvg!=="0"){
        json.gradeAvg = parsed.gradeAvg;
      }
      // 🔒 학교명은 AI가 임의로 추정/환각할 수 있으므로(개인정보 보호를 위해 원문에서
      // 학교명을 가림) 항상 클라이언트에서 로컬로 파싱한 실제 값을 최우선으로 사용한다.
      if(parsed.studentInfo?.school){
        json.schoolName = parsed.studentInfo.school;
      } else if(!json.schoolName){
        json.schoolName = "";
      }

      // ─── 7단계: 권장과목 매칭 결과 주입 (AI가 빠뜨렸을 때 보장) ───
      const isStudent2015 = finalCurr === "2015";
      if(!json.creditStatus || !json.creditStatus.byUniv || json.creditStatus.byUniv.length === 0){
        json.creditStatus = json.creditStatus || {};
        json.creditStatus.byUniv = univFitData.map(f => ({
          univ: f.univ, dept: f.dept,
          rate: f.rate || 0,
          matched: f.matched || [],
          missing: f.missing || [],
          analysis: isStudent2015
            ? `${f.univ} ${f.dept}: 2015 개정 교육과정은 대학의 공식 권장과목 제도가 없어, 이수한 과목이 전공과 관련 있는지로 판단합니다. 관련 교과를 ${(f.matched||[]).length}개 이수했습니다.`
            : (f.hasCriteria
              ? `${f.univ} ${f.dept} 권장 과목 ${(f.matched||[]).length + (f.missing||[]).length}개 중 ${(f.matched||[]).length}개 이수. 충족률 ${f.rate}%.`
              : f.note),
          recommend: isStudent2015
            ? '2015 개정은 필수 이수 리스트가 없으므로, 관심 있는 심화 과목을 더 들으면 도움이 됩니다.'
            : (f.missing && f.missing.length > 0
              ? `${f.missing.slice(0,3).join(', ')} 등의 과목을 추가 이수하면 충족률이 향상됩니다.`
              : '권장 과목을 충실히 이수했습니다.')
        }));
        json.creditStatus.summary = isStudent2015
          ? '2015 개정 교육과정은 대학 공식 권장과목 제도가 없어, 이수 과목과 전공의 관련성을 정성적으로 평가합니다.'
          : '지원 희망 대학별 권장과목 충족 현황을 확인하세요.';
      }
      // 권장과목 데이터 원본도 첨부 (UI에서 활용)
      json._univFitRaw = univFitData;

      setG(json); setProg(100); setStep("✅ 분석 완료!");
      setPhase("result");
      setTimeout(()=>{resRef.current?.scrollIntoView({behavior:"smooth"});setProg(0);setStep("");},600);
    }catch(e){setErr(String(e.message||e).slice(0,200));setProg(0);setStep("");}
    setBusy(false);
  },[pdfB64,htmlContent,inName,inMajor,inCurr,inSchoolType,u0,d0,t0,u1,d1,t1,u2,d2,t2]);

  const name=G?.studentName||inName||"학생";
  const total=G?.totalScore||0;
  const grd=total>=90?"S":total>=80?"A":total>=70?"B":total>=60?"C":"D";

  // 🆕 워드(.doc) 내보내기 — 종합 리포트를 디자인된 HTML로 생성, Word에서 열어 수정 가능
  const exportWord = () => {
    if(!G) return;
    const esc=(s)=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const fmt=(s)=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/《([^》]+)》/g,'<b style="background:#fde68a;">$1</b>').replace(/「([^」]+)」/g,'<b style="color:#0b7a77;">$1</b>').replace(/\n/g,'<br/>');
    const ov=(G._tiers&&G._tiers.overall)||tierOf(total,100); const MX={academic:40,inquiry:25,career:15,community:10,growth:10};
    const NM={academic:"학업역량",inquiry:"탐구역량",career:"진로역량",community:"공동체역량",growth:"성장역량"};
    const h2=(t)=>`<h2 style="font-size:15pt;border-bottom:1.5pt solid #14203f;padding-bottom:3pt;margin:20pt 0 8pt;color:#14203f;">${t}</h2>`;
    const th=(t)=>`<th style="background:#f6f2ea;border:0.5pt solid #cfc6b8;padding:4pt 6pt;font-size:10pt;text-align:left;">${t}</th>`;
    const td=(t)=>`<td style="border:0.5pt solid #e2d8c8;padding:4pt 6pt;font-size:10pt;vertical-align:top;">${t}</td>`;
    let b=`<div style="border-bottom:2pt solid #14203f;padding-bottom:8pt;margin-bottom:14pt;"><div style="font-size:9pt;color:#0b7a77;letter-spacing:2pt;">REPORT·I</div>
      <div style="font-size:22pt;font-weight:bold;color:#14203f;">학생부 정밀 진단 보고서</div>
      <div style="font-size:10pt;color:#555;margin-top:4pt;">${esc(G.schoolName||"")} · ${esc(name)} 학생 · ${esc(G.stageLabel||"")} · 평균등급 ${esc(G.gradeAvg||"-")} · ${new Date().toLocaleDateString("ko-KR")}</div></div>`;
    b+=`<div style="background:#f6f2ea;border-top:3pt solid #0f9a90;padding:8pt 12pt;font-size:11pt;"><b>종합 수준 판정 · ${esc(ov.label)}</b> (${esc(ov.ex)})<br/>${fmt(G.executiveSummary?.headline||G.scoreSummary||"")}</div>`;
    if(G.competencies){ b+=h2("1. 역량별 수준과 근거"); b+=`<table style="width:100%;border-collapse:collapse;"><tr>${th("역량")}${th("수준")}${th("플러스(＋) 근거")}${th("마이너스(－) 근거")}</tr>`+
      Object.keys(NM).map(k=>{const c=G.competencies[k]||{};const t=(G._tiers&&G._tiers[k])||tierOf(c.score,MX[k]);const bd=c.scoreBreakdown||{};
        return `<tr>${td("<b>"+NM[k]+"</b>")}${td(esc(t.shortLabel))}${td((bd.plusFactors||[]).map(x=>"· "+fmt(x.reason)).join("<br/>"))}${td((bd.minusFactors||[]).map(x=>"· "+fmt(x.reason)).join("<br/>"))}</tr>`;}).join("")+`</table>`; }
    if(G.strengths?.length) b+=h2("2. 핵심 강점")+G.strengths.map(s=>`<p style="font-size:11pt;line-height:1.8;margin:0 0 6pt;"><b>${esc(s.title||"")}</b> — ${fmt(s.content||"")}</p>`).join("");
    if(G.weaknesses?.length) b+=h2("3. 보완점")+G.weaknesses.map(s=>`<p style="font-size:11pt;line-height:1.8;margin:0 0 6pt;"><b>${esc(s.title||"")}</b> — ${fmt(s.content||"")}</p>`).join("");
    if(G.recommendedMajors?.length) b+=h2("4. 탐구가 가리키는 추천학과")+`<table style="width:100%;border-collapse:collapse;"><tr>${th("순위")}${th("학과")}${th("적합도")}${th("근거")}</tr>`+G.recommendedMajors.slice(0,5).map((m,i)=>`<tr>${td(i+1)}${td("<b>"+esc(m.major)+"</b>")}${td(esc(fitWord(m.score)))}${td(fmt(m.reason||""))}</tr>`).join("")+`</table>`;
    const F=G.finalRecommendation; if(F?.top10?.length) b+=h2("5. 지원 추천")+`<table style="width:100%;border-collapse:collapse;"><tr>${th("순위")}${th("대학·학과")}${th("전형")}${th("라인")}${th("추정 합격가능성")}${th("근거")}</tr>`+F.top10.map((r,i)=>`<tr>${td(r.rank||i+1)}${td("<b>"+esc(r.univ)+"</b><br/>"+esc(r.dept))}${td(esc(r.admissionType)+(r.hasInterview?" (면접)":""))}${td(esc(r.tier))}${td(r.admissionProbability?r.admissionProbability.min+"~"+r.admissionProbability.max+"%":"-")}${td(fmt(r.reason||""))}</tr>`).join("")+`</table>`+(F.interviewCaveat?`<p style="font-size:10pt;color:#8a5a00;">※ ${fmt(F.interviewCaveat)}</p>`:"");
    if(F?.avoid?.length) b+=h2("6. 현재로선 피하는 것이 좋은 대학·학과")+F.avoid.map(a=>`<p style="font-size:11pt;margin:0 0 5pt;"><b>${esc(a.univ)}${a.dept?" · "+esc(a.dept):""}</b> — ${fmt(a.reason)}</p>`).join("");
    if(G.summaryLetter) b+=h2("7. 상담 의견")+`<p style="font-size:11.5pt;line-height:1.95;font-family:'바탕',serif;">${fmt(G.summaryLetter)}</p>`;
    if(G.reportLetter) b+=`<p style="font-size:11pt;line-height:1.9;font-family:'바탕',serif;">${fmt(G.reportLetter)}</p>`;
    b+=`<div style="font-size:8.5pt;color:#999;margin-top:18pt;padding-top:6pt;border-top:0.5pt solid #ddd;">리포트아이(Report-I) · 본 보고서는 참고용이며 실제 입시 결과와 차이가 있을 수 있습니다.</div>`;
    const html=`<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>보고서</title><style>@page{size:A4;margin:2cm;} body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;color:#1c2538;}</style></head><body>${b}</body></html>`;
    const blob=new Blob(['\ufeff'+html],{type:'application/msword'}); const url=URL.createObjectURL(blob);
    const el=document.createElement('a'); el.href=url; el.download=`${name}_학생부진단보고서.doc`; document.body.appendChild(el); el.click(); document.body.removeChild(el); URL.revokeObjectURL(url);
  };

  // ── 새 화면용 보조 함수 ──
  const targets=[{u:u0,d:d0,t:t0},{u:u1,d:d1,t:t1},{u:u2,d:d2,t:t2}];
  const addTarget=(u,d,t="")=>{
    const sets=[[setU0,setD0,setQ0,setT0],[setU1,setD1,setQ1,setT1],[setU2,setD2,setQ2,setT2]];
    const idx=targets.findIndex(x=>!x.u); if(idx<0) return;
    sets[idx][0](u); sets[idx][1](d); sets[idx][2](`${u} ${d}`); sets[idx][3](t||"");
    if(!inMajor) setInMajor(d);
  };
  const removeTarget=(i)=>{ const sets=[[setU0,setD0,setQ0,setT0],[setU1,setD1,setQ1,setT1],[setU2,setD2,setQ2,setT2]]; sets[i][0]("");sets[i][1]("");sets[i][2]("");sets[i][3](""); };
  const loadDemo=async()=>{
    const is22 = typeof window!=="undefined" && /[?&]demo=2022/.test(window.location.search);
    let li=null; try{ const lb=await import("./levelBlock.js"); li=lb.levelInfoFor({targets:[{d:"사학과"}],major:"사학과"}); }catch(e){}
    let G0={...DEMO_G,_levelInfo:li};
    if(is22){ const A=["A","A","B","A","B"], R=[18,22,45,60,32]; G0={...G0,curriculum:"2022",is2022:true,gradeAvg:"2.95",grades:DEMO_G.grades.map((r,i)=>({...r,level:Math.min(5,Math.max(1,Math.ceil(r.level*0.8))),achievement:A[i%5],distribution:`A:${R[i%5]}% B:30% C:20% D:10% E:5%`,students:"120",rawScore:String(95-(i%5)*4),avg:String(72-(i%4)*3)}))}; G0._ach2022=achievement2022(G0); }
    G0._coreFit=computeCoreFit(G0,[{u:"서울대",d:"사학과"},{u:"한양대",d:"사학과"}],G0.curriculum);
    try{ const pb=await import("./planBlock.js"); (G0.finalRecommendation?.top10||[]).forEach(r=>{ try{ r._cut=pb.cutInfoFor(r.univ,r.dept,r.admissionType);}catch(e){} }); (G0.deptReports||[]).forEach(d=>{ try{ d._cut=pb.cutInfoFor(d.univ,d.dept,d.strategy?.전형추천||'학생부종합'); }catch(e){} }); }catch(e){}
    setG(applyQuant(G0,"사학과")); setInMajor("사학과"); setPhase("result"); };
  useEffect(()=>{ if(typeof window!=="undefined" && /[?&]demo=(1|2022)/.test(window.location.search)) loadDemo(); },[]);
  const reset=()=>{ setPhase("landing"); setG(null); window.scrollTo({top:0}); };

  return (
    <div className="app">
      {phase==="result" && G
        ? <Report G={G} name={name} total={total} grd={grd} inMajor={inMajor} onReset={reset} onExport={exportWord}/>
        : <Intake pdfB64={pdfB64} htmlContent={htmlContent} fileName={fileName} drag={drag} setDrag={setDrag} onDrop={onDrop} processFile={processPdf}
            inGrade={inGrade} syncCurrFromGrade={syncCurrFromGrade} inSchoolType={inSchoolType} setInSchoolType={setInSchoolType}
            inName={inName} setInName={setInName} inMajor={inMajor} setInMajor={setInMajor}
            targets={targets} addTarget={addTarget} removeTarget={removeTarget}
            run={run} busy={busy} prog={prog} step={step} err={err} truncWarning={truncWarning} onDemo={loadDemo}/>}
    </div>
  );
}
