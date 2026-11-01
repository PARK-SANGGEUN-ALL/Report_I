// 탐구의 종적 연결(학기를 건너 깊어짐)·횡적 연결(같은 시기 다른 교과가 같은 주제)을 코드가 직접 센다.
const SEM = k => { const [g, s] = String(k).split("-").map(Number); return g * 10 + s; };
const labelOf = a => a.subjectName || a.subject || a.type || "";
export function connectionMetrics(G) {
  const acts = (G.activities || []).map((a, i) => { const g = +a.gN || parseInt(a.year) || 1; let s = +a.sN || parseInt(a.semester) || 1; if (s !== 1 && s !== 2) s = 1;
    return { ...a, i, g, s, key: `${g}-${s}`, d: Math.min(4, Math.max(1, parseInt(a.depth) || 1)), topic: (a.topicKey || "").trim(), subj: labelOf(a) }; });
  const vertical = [], horizontal = [], seenH = new Set();
  const addH = (topic, key, subjects, depths) => { const id = topic + "|" + key; if (subjects.length >= 2 && !seenH.has(id)) { seenH.add(id); horizontal.push({ topic, key, subjects, depths }); } };
  // 종적: AI가 정의한 줄기(inquiryThreads) 우선, 없으면 topicKey 묶음
  (G.inquiryThreads || []).forEach(t => { const st = (t.steps || []).map(s => ({ key: String(s.when || ""), subj: s.subject, d: +s.depth || 1, title: s.title })).filter(s => s.key);
    const sems = [...new Set(st.map(s => s.key))]; if (sems.length < 2) return; st.sort((a, b) => SEM(a.key) - SEM(b.key));
    const bySem = sems.sort((a, b) => SEM(a) - SEM(b)).map(k => Math.max(...st.filter(s => s.key === k).map(s => s.d)));
    const subjects = st.map(s => s.subj); const moves = subjects.filter((x, i) => i > 0 && x !== subjects[i - 1]).length;
    vertical.push({ topic: t.theme, path: st, sems, depths: bySem, trend: bySem[bySem.length - 1] > bySem[0] ? "상승" : bySem[bySem.length - 1] < bySem[0] ? "하락" : "유지", lastDrop: bySem.length >= 2 && bySem[bySem.length - 1] < bySem[bySem.length - 2], moves, years: new Set(sems.map(k => k.split("-")[0])).size });
    sems.forEach(k => addH(t.theme, k, [...new Set(st.filter(s => s.key === k).map(s => s.subj))], st.filter(s => s.key === k).map(s => s.d)));
  });
  const by = {}; acts.forEach(a => { if (a.topic) (by[a.topic] = by[a.topic] || []).push(a); });
  Object.entries(by).forEach(([t, list]) => { const bySem = {}; list.forEach(a => (bySem[a.key] = bySem[a.key] || []).push(a));
    Object.entries(bySem).forEach(([k, l]) => addH(t, k, [...new Set(l.map(a => a.subj))], l.map(a => a.d)));
    const sems = Object.keys(bySem).sort((a, b) => SEM(a) - SEM(b));
    if (!(G.inquiryThreads || []).length && sems.length >= 2) { const dd = sems.map(k => Math.max(...bySem[k].map(a => a.d)));
      vertical.push({ topic: t, path: list.sort((a, b) => SEM(a.key) - SEM(b.key)).map(a => ({ key: a.key, subj: a.subj, d: a.d, title: a.title })), sems, depths: dd, trend: dd[dd.length - 1] > dd[0] ? "상승" : dd[dd.length - 1] < dd[0] ? "하락" : "유지", lastDrop: dd.length >= 2 && dd[dd.length - 1] < dd[dd.length - 2], moves: 0, years: new Set(sems.map(k => k.split("-")[0])).size }); } });
  const inThread = new Set(); vertical.forEach(v => v.path.forEach(p => inThread.add(p.key + "|" + p.subj)));
  const isolated = acts.filter(a => !inThread.has(a.key + "|" + a.subj));
  const coverage = acts.length ? 1 - isolated.length / acts.length : 0;
  const rising = vertical.filter(v => v.trend === "상승").length; const reachesLast = vertical.some(v => v.sems.some(k => SEM(k) >= 31));
  const vV = !vertical.length ? "미흡" : (vertical.length >= 2 && rising >= 1 && coverage >= 0.5 && reachesLast) ? "우수" : rising >= 1 ? "양호" : "보통";
  const hSems = new Set(horizontal.map(h => h.key)).size; const vH = !horizontal.length ? "미흡" : (horizontal.length >= 2 && hSems >= 2) ? "우수" : "양호";
  return { acts, vertical, horizontal, isolated, coverage, verdict: { vertical: vV, horizontal: vH } };
}

/* ── 탐구 계보도용 연결선: 같은 주제어를 공유하는 기록을 학기 순으로 잇고, 연결 종류와 이유를 코드가 산정 ── */
export function buildLinks(G) {
  const acts = (G.activities || []).map((a, i) => { const g = +a.gN || parseInt(a.year) || 1; let s = +a.sN || parseInt(a.semester) || 1; if (s !== 1 && s !== 2) s = 1;
    return { ...a, i, g, s, key: `${g}-${s}`, d: Math.min(4, Math.max(1, parseInt(a.depth) || 1)), topic: (a.topicKey || "").trim(), subj: labelOf(a), methodsArr: a.methods || [] }; });
  const links = []; const by = {}; acts.forEach(a => { if (a.topic) (by[a.topic] = by[a.topic] || []).push(a); });
  Object.entries(by).forEach(([t, list]) => { list.sort((a, b) => SEM(a.key) - SEM(b.key) || a.i - b.i);
    for (let k = 1; k < list.length; k++) { const p = list[k - 1], n = list[k]; if (p.key === n.key) continue;
      const moved = p.subj !== n.subj; const newM = n.methodsArr.filter(m => !p.methodsArr.includes(m));
      const type = n.d > p.d ? "심화" : moved ? "확장" : newM.length ? "전환" : "반복";
      const parts = [`같은 주제 「${t}」를 ${moved ? `${p.subj}에서 ${n.subj}로 옮겨` : `${n.subj}에서 이어`} 다룸`];
      parts.push(n.d > p.d ? `깊이가 ${p.d}단계에서 ${n.d}단계로 상승함` : n.d < p.d ? `깊이가 ${p.d}단계에서 ${n.d}단계로 낮아짐` : `깊이가 ${n.d}단계로 유지됨`);
      if (newM.length) parts.push(`새로 쓴 방법은 ${newM.slice(0, 3).join(", ")}임`);
      if (type === "반복") parts.push("새 방법이 없어 되풀이로 읽힘");
      links.push({ from: p.i, to: n.i, topic: t, type, reason: parts.join(". ") + ".", ai: n.linkReason || "" }); } });
  return { acts, links };
}
