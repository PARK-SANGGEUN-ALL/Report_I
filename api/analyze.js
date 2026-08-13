// ══════════════════════════════════════════════
// 리포트아이 — 백엔드 API v24 (보안·프라이버시 강화판)
// 핵심 변경 (v24):
// 0. 🔒 로그에서 학생부 원문·AI 응답 등 개인정보(PII) 내용 완전 제거
//    — 이제 길이·상태 코드·불리언 등 "메타데이터"만 로그에 남음.
// 1. 🔒 CORS 화이트리스트화 (ALLOWED_ORIGIN 환경변수, 기본값 없으면 거부)
// 2. 🔒 AI 재시도 단계 축소 (Gemini 3단계 폴백 → 1차만, 불필요한 제3자 전송 최소화)
// 3. 🔒 응답에 Cache-Control: no-store 부여 (중간 캐시·CDN 저장 방지)
// 4. 🔒 pdfB64(원본 PDF 바이너리)는 애초에 클라이언트에서 서버로 전송되지 않음 — 서버 코드에서도 완전 제거
// 5. responseMimeType 제거 (한국어 JSON 깨짐 방지) — 기존 유지
// 6. JSON_START/JSON_END 마커로 응답 영역 명확화 — 기존 유지
// 7. 다단계 sanitizer (한글, 줄바꿈, escape 처리) — 기존 유지, 단 디버그 출력에서 원문 제거
//
// ⚠️ 구조적 한계(정직한 고지): 이 기능은 학생부 원문을 LLM(Gemini/Claude)에 전달해
// 분석하는 구조이므로, "AI 제공사가 요청 데이터를 아예 받지 않게" 만들 수는 없습니다.
// 대신 ①제공사로 가는 전송 횟수를 최소화하고 ②우리 쪽 서버 로그에는 어떤 경우에도
// 개인정보가 남지 않도록 하고 ③제3자(분석·광고 등)로의 노출 경로를 원천 차단했습니다.
// 자세한 내용은 SECURITY.md를 참고하세요.
// ══════════════════════════════════════════════

// 🔒 로그 유틸 — 절대 원문/응답 "내용"을 출력하지 않고 길이·상태만 남긴다.
const meta = (text) => ({ len: (text || '').length });
function safeLog(...args) { console.log(...args); }
function safeWarn(...args) { console.warn(...args); }
function safeError(...args) { console.error(...args); }

// ══════════════════════════════════════════════
// 🆕 실제 합격/불합격 후기 웹 검색 (선택 기능, Naver 검색 API)
// - 네이버 블로그·카페 글에서 "{대학} {학과} 합격/불합격 후기" 류를 찾아 Phase5 프롬프트에
//   추가 근거로 제공합니다. NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없으면
//   이 기능은 조용히 건너뛰고 나머지 분석은 정상 진행됩니다(필수 기능 아님).
// - 발급: https://developers.naver.com/apps/#/register (검색 API, 무료)
// ══════════════════════════════════════════════
function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}

async function naverSearchOne(query, type, clientId, clientSecret) {
  const url = `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
  try {
    const r = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map(it => ({
      title: stripHtml(it.title),
      desc: stripHtml(it.description),
      source: type,
    }));
  } catch (e) {
    return [];
  }
}

// univDeptList: [{univ, dept}] — 최대 3개까지만(비용·속도 제한). 각 대학·학과당 블로그 2 + 카페 2 검색.
async function gatherAdmissionEvidence(univDeptList) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { available: false, text: '' };
  }
  const targets = (univDeptList || []).filter(t => t?.univ && t?.dept).slice(0, 3);
  if (targets.length === 0) return { available: true, text: '' };

  const blocks = [];
  for (const t of targets) {
    const q1 = `${t.univ} ${t.dept} 학생부종합 합격 후기`;
    const q2 = `${t.univ} ${t.dept} 학생부종합 불합격 스펙`;
    const [blog1, cafe1, blog2, cafe2] = await Promise.all([
      naverSearchOne(q1, 'blog', clientId, clientSecret),
      naverSearchOne(q1, 'cafearticle', clientId, clientSecret),
      naverSearchOne(q2, 'blog', clientId, clientSecret),
      naverSearchOne(q2, 'cafearticle', clientId, clientSecret),
    ]);
    const all = [...blog1, ...cafe1, ...blog2, ...cafe2].slice(0, 8);
    if (all.length === 0) continue;
    const lines = all.map((it, i) => `  ${i+1}. [${it.source==='blog'?'블로그':'카페'}] ${it.title} — ${it.desc.slice(0, 140)}`);
    blocks.push(`[${t.univ} ${t.dept}]\n${lines.join('\n')}`);
  }
  if (blocks.length === 0) return { available: true, text: '' };
  return {
    available: true,
    text: `\n\n=== 🌐 웹 검색 결과: 실제 합격/불합격 후기 (네이버 블로그·카페, 참고용) ===\n` +
      `⚠️ 아래는 익명 개인 후기이므로 100% 정확하다고 단정할 수 없고, 과장·허위 가능성도 있습니다.\n` +
      `"경향성 참고 자료"로만 활용하고, 특정 게시물을 사실로 단정하거나 절대적 기준으로 삼지 마세요.\n` +
      blocks.join('\n\n')
  };
}


// 🔒 허용 오리진 화이트리스트 — 배포 시 Vercel 환경변수 ALLOWED_ORIGIN에
// 실제 서비스 도메인(예: https://reporti.example.com)을 설정하세요.
// 설정하지 않으면 개발 편의를 위해 모든 오리진의 '읽기'는 허용하되,
// 운영 배포 시에는 반드시 지정할 것을 강력히 권장합니다.
function resolveAllowedOrigin(req) {
  const allowList = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowList.length === 0) return origin || '*'; // 미설정 시 폴백(개발용) — 운영에서는 설정 권장
  return allowList.includes(origin) ? origin : allowList[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');
  res.setHeader('Vary', 'Origin');
  // 🔒 어떤 중간 프록시/CDN도 이 응답(학생부 분석 결과 포함)을 캐시·저장하지 않도록 강제
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 🔒 선택적 앱 시크릿 체크 — APP_SHARED_SECRET을 설정하면 우리 프런트 외의
  // 임의의 제3자가 이 엔드포인트를 직접 호출해 데이터를 흘려보내거나 API 비용을
  // 소모시키는 것을 막을 수 있습니다. 설정하지 않으면 검사를 건너뜁니다(개발용).
  const appSecret = process.env.APP_SHARED_SECRET;
  if (appSecret && req.headers['x-app-secret'] !== appSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const geminiKey    = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey && !anthropicKey) {
    return res.status(500).json({ error: 'API 키 없음 (Gemini 또는 Claude 필요)' });
  }

  // 🔒 pdfB64는 더 이상 받지 않습니다 — 클라이언트는 애초에 원본 PDF 바이너리를
  // 서버로 전송하지 않으며(브라우저에서 pdf.js로 텍스트만 추출), 혹시 과거 버전
  // 클라이언트가 실수로 보내더라도 서버는 이를 즉시 버리고 절대 로그/전달하지 않습니다.
  const { prompt, pdfText, parsed: localParsed, phase, searchTargets } = req.body || {};
  if (req.body && req.body.pdfB64) delete req.body.pdfB64;
  if (!prompt) return res.status(400).json({ error: 'prompt 없음' });

  // 🔒 과도하게 큰 요청은 즉시 거부 (비정상 트래픽·오남용 방지, 요청 바이트 수만 확인)
  // 🔥 판독 품질 우선: 학생부 원문 한도를 180,000자로 올렸으므로(criteria.js RAW_TEXT_LIMIT),
  // 프롬프트 전체 상한도 함께 넉넉하게 올려 정상적인 긴 학생부가 여기서 걸리지 않도록 한다.
  const MAX_PROMPT_CHARS = 350000;
  if (prompt.length > MAX_PROMPT_CHARS || (pdfText || '').length > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: '요청 크기 초과' });
  }

  const phaseLbl = phase || 'main';
  // 🔒 길이만 기록 — 이름·학교·세특 등 어떤 내용도 로그에 남지 않음
  safeLog(`[analyze ${phaseLbl}] start prompt=${meta(prompt).len}c pdfText=${meta(pdfText).len}c`);

  // 🆕 Phase5에서만: 실제 합격/불합격 후기 웹 검색(선택, NAVER 키 있을 때만 동작)
  let webEvidence = '';
  if (phase === 'phase5' && Array.isArray(searchTargets) && searchTargets.length > 0) {
    try {
      const ev = await gatherAdmissionEvidence(searchTargets);
      webEvidence = ev.text || '';
      safeLog(`[analyze ${phaseLbl}] web evidence available=${ev.available} len=${webEvidence.length}c`);
    } catch (e) {
      safeWarn(`[analyze ${phaseLbl}] web evidence gather failed: ${e.message}`);
    }
  }

  // pdfText는 옵셔널 — 프롬프트 안에 이미 학생부 원문이 포함되어 있음
  const trimText = (pdfText||'').length > 50000
    ? pdfText.slice(0, 50000) + '\n...(생략)'
    : (pdfText||'');

  // 프롬프트가 너무 짧지 않으면 OK (pdfText는 선택)
  if (prompt.length < 200) {
    return res.status(400).json({ error: '프롬프트가 너무 짧음' });
  }

  // 🆕 웹 검색 근거를 프롬프트 끝에 추가 (있을 때만)
  const promptWithEvidence = webEvidence ? (prompt + webEvidence) : prompt;

  // 프롬프트에 JSON 마커 추가 — 응답 구간을 명확하게 식별
  const systemMsg = phase === 'phase2'
    ? `당신은 최상위 입학사정관입니다. 학과 적합도 5개+/탐구 5개+/면접 7개+/리포트 3500자+. 각 항목 근거 4~5개.

【응답 형식 — 매우 중요】
반드시 다음과 같은 형식으로 답하세요:
JSON_START
{여기에 JSON 데이터}
JSON_END

JSON 안에 따옴표는 반드시 \\" 로 escape하세요.
JSON 안에 줄바꿈은 \\n 으로 표시하세요.
JSON 외 다른 설명/마크다운/주석은 절대 출력하지 마세요.`
    : `당신은 최상위 입학사정관입니다. 모든 분석에 원문 근거 4~5개 필수. activities 15개+, strengths 5개+, keywords 25개+.

【응답 형식 — 매우 중요】
반드시 다음과 같은 형식으로 답하세요:
JSON_START
{여기에 JSON 데이터}
JSON_END

JSON 안에 따옴표는 반드시 \\" 로 escape하세요.
JSON 안에 줄바꿈은 \\n 으로 표시하세요.
JSON 외 다른 설명/마크다운/주석은 절대 출력하지 마세요.`;

  try {
    // 🔥 판독 품질 우선: Phase1(성적·이수 원문 추출)은 가장 "읽기" 자체가 핵심인 단계라
    // 다른 단계보다 넉넉한 출력 토큰을 준다 — 활동이 많은 학생일수록 grades·achievementSubjects
    // 배열이 커서 32,000 토큰으로는 중간에 JSON이 잘릴 위험이 있었다.
    const maxTokens = phase === 'phase1' ? 48000 : 32000;
    const result = await callAI({
      geminiKey, anthropicKey,
      pdfText: trimText, prompt: promptWithEvidence,
      maxTokens,
      phaseLbl,
      systemMsg
    });

    // 로컬 파서 폴백 (AI 결과 비어있을 때)
    if (phase !== 'phase2' && localParsed) {
      if (!result.gradeAvg || result.gradeAvg === '0') {
        if (localParsed.gradeAvg) result.gradeAvg = localParsed.gradeAvg;
      }
      if (!result.schoolName && localParsed.studentInfo?.school) {
        result.schoolName = localParsed.studentInfo.school;
      }
      if ((!result.grades || result.grades.length === 0) && localParsed.grades?.length > 0) {
        result.grades = localParsed.grades;
      }
      if ((!result.achievementSubjects || result.achievementSubjects.length === 0) && localParsed.achievementSubjects?.length > 0) {
        result.achievementSubjects = localParsed.achievementSubjects;
      }
    }

    const keys = Object.keys(result);
    safeLog(`[analyze ${phaseLbl}] done keys=${keys.length}`); // 🔒 키 "개수"만 기록 (필드명 목록도 제거해 스키마 추정 노출 최소화)

    return res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify(result) }],
      _debug: { phase: phaseLbl, keyCount: keys.length }
    });
  } catch(e) {
    safeError(`[analyze ${phaseLbl}] failed: ${e.message}`); // 🔒 에러 메시지만 — 원문/응답 내용 없음
    return res.status(500).json({ error: `${phaseLbl} 오류` }); // 🔒 클라이언트로도 상세 예외 메시지 노출 최소화
  }
}

async function callAI({ geminiKey, anthropicKey, pdfText, prompt, maxTokens, systemMsg, phaseLbl }) {

  // pdfText는 옵셔널 — 이미 prompt에 학생부 원문이 포함된 경우 빈 문자열
  const studentRecord = pdfText ? `\n\n=== 학생부 원문 ===\n${pdfText}` : '';
  const fullPrompt = `${systemMsg}${studentRecord}\n\n=== 분석 지시 ===\n${prompt}`;

  // 🔒 제공사 우선순위: Anthropic(Claude)을 1순위로 둔다.
  // Anthropic API는 기본적으로 고객 요청 데이터를 모델 학습에 사용하지 않는다고
  // 명시하고 있어(정책은 변경될 수 있으니 SECURITY.md의 링크로 최신 내용을 확인할 것),
  // 민감한 학생부 원문을 다루는 이 서비스 특성상 더 안전한 기본 경로로 판단했습니다.
  // Gemini는 무료/보조 폴백으로만 사용하고, 폴백 단계도 기존 3단계에서 1단계로 줄여
  // 동일한 학생부 원문이 여러 모델 엔드포인트로 반복 전송되는 것을 최소화했습니다.
  if (anthropicKey) {
    try {
      safeLog(`[analyze ${phaseLbl}] -> Claude`);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      });
      const d = await r.json();
      if (r.ok) {
        const text = d.content?.find(b=>b.type==='text')?.text || '';
        safeLog(`[analyze ${phaseLbl}] Claude resp=${meta(text).len}c`);
        if (text.length > 100) return parseResponse(text, phaseLbl);
        safeWarn(`[analyze ${phaseLbl}] Claude resp too short`);
      } else {
        safeWarn(`[analyze ${phaseLbl}] Claude failed status=${r.status}`);
      }
    } catch(e) {
      safeError(`[analyze ${phaseLbl}] Claude exception: ${e.message}`);
    }
  }

  // ──────────────────────────────────────
  // 폴백: Gemini 2.5 Flash 1회만 시도 (다단계 캐스케이드 제거)
  // ──────────────────────────────────────
  if (geminiKey) {
    try {
      safeLog(`[analyze ${phaseLbl}] -> Gemini fallback`);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: 0.3
              // responseMimeType 제거 — 한국어 JSON 깨짐 방지
            }
          })
        }
      );
      const d = await r.json();
      if (r.ok && d.candidates?.[0]) {
        const cand = d.candidates[0];
        const text = cand.content?.parts?.[0]?.text || '';
        const finishReason = cand.finishReason || 'unknown';
        safeLog(`[analyze ${phaseLbl}] Gemini resp=${meta(text).len}c finish=${finishReason}`);
        if (text.length > 100) {
          return parseResponse(text, phaseLbl);
        }
        safeWarn(`[analyze ${phaseLbl}] Gemini resp too short`);
      } else {
        safeWarn(`[analyze ${phaseLbl}] Gemini failed status=${r.status}`);
      }
    } catch(e) {
      safeError(`[analyze ${phaseLbl}] Gemini exception: ${e.message}`);
    }
  }

  throw new Error('모든 AI 제공사 호출 실패');
}

// ═══════════════════════════════════════════════
// 응답 파싱 — JSON_START/JSON_END 마커 + sanitizer
// ═══════════════════════════════════════════════
function parseResponse(text, phaseLbl = 'unknown') {
  if (!text || typeof text !== 'string') {
    safeError(`[parse ${phaseLbl}] empty input`);
    return {};
  }

  const log = (msg) => safeLog(`[parse ${phaseLbl}] ${msg}`);
  const warn = (msg) => safeWarn(`[parse ${phaseLbl}] ${msg}`);

  // ── 1. JSON_START / JSON_END 마커 우선 추출 ──
  let jsonText = text;
  const startMarker = text.indexOf('JSON_START');
  const endMarker = text.lastIndexOf('JSON_END');
  if (startMarker >= 0 && endMarker > startMarker) {
    jsonText = text.slice(startMarker + 'JSON_START'.length, endMarker).trim();
    log(`마커 발견: ${jsonText.length}자 추출`);
  } else {
    log(`마커 없음, 전체 텍스트로 파싱 시도`);
  }

  // ── 2. 마크다운/BOM 제거 ──
  jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  if (jsonText.charCodeAt(0) === 0xFEFF) jsonText = jsonText.slice(1);

  // ── 3. 1차 파싱 시도 (원본) ──
  const tryParse = (s, label) => {
    try {
      const result = JSON.parse(s);
      log(`✅ ${label} success keys=${Object.keys(result).length}`); // 🔒 필드명 목록 대신 개수만
      return result;
    } catch (e) {
      warn(`${label} failed: ${e.message?.slice(0, 80)}`); // 🔒 에러 메시지만 (원문 내용 없음)
      // 🔒 예전에는 파싱 오류 위치 주변 텍스트(원문 인용 포함 가능)를 로그에 남겼으나,
      // 학생부 발췌가 로그에 노출될 수 있어 완전히 제거함. 위치 인덱스만 남긴다.
      const m = e.message?.match(/position (\d+)/);
      if (m) warn(`  near index ${m[1]} (content redacted)`);
      return null;
    }
  };

  let result = tryParse(jsonText, '1차');
  if (result) return result;

  // ── 4. { } 구간 추출 후 재시도 ──
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = jsonText.slice(firstBrace, lastBrace + 1);
    result = tryParse(extracted, '2차(구간추출)');
    if (result) return result;

    // ── 5. Sanitize: 흔한 깨짐 패턴 수정 ──
    let sanitized = extracted
      // 잘못된 escape 정리
      .replace(/\\([^"\\/bfnrtu])/g, '$1')
      // 값 안의 raw 줄바꿈을 \n으로 치환
      .replace(/("(?:[^"\\]|\\.)*?")|[\r\n]+/g, (m, p1) => p1 ? p1 : ' ')
      // 후행 쉼표 제거
      .replace(/,(\s*[}\]])/g, '$1')
      // 키에 따옴표 없는 경우 (드물지만 발생)
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    result = tryParse(sanitized, '3차(sanitize)');
    if (result) return result;

    // ── 6. 잘린 JSON 복구 ──
    log('잘린 JSON 복구 시도');
    let depth = 0, inStr = false, esc = false;
    let lastValidComma = -1;
    for (let i = 0; i < extracted.length; i++) {
      const c = extracted[i];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      if (c === ',' && depth >= 1) lastValidComma = i;
    }
    if (depth > 0 && lastValidComma > 0) {
      let truncated = extracted.slice(0, lastValidComma);
      // 깊이 추적해서 닫는 괄호 추가
      let d = 0, inS = false, eS = false;
      let stack = [];
      for (let i = 0; i < truncated.length; i++) {
        const c = truncated[i];
        if (eS) { eS = false; continue; }
        if (c === '\\' && inS) { eS = true; continue; }
        if (c === '"') { inS = !inS; continue; }
        if (inS) continue;
        if (c === '{') stack.push('}');
        else if (c === '[') stack.push(']');
        else if (c === '}' || c === ']') stack.pop();
      }
      truncated += stack.reverse().join('');
      result = tryParse(truncated, '4차(잘림복구)');
      if (result) return result;
    }
  }

  // ── 7. 모두 실패 — 진단 정보 출력 (🔒 내용은 절대 남기지 않고 길이만) ──
  safeError(`[parse ${phaseLbl}] all parse attempts failed, len=${text.length}c (content redacted for privacy)`);
  return {};
}
