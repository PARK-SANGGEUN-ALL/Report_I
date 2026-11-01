# -*- coding: utf-8 -*-
"""[모두의 진학] 그들이 좋아하는 탐구 (시즌2 계열·학과편, 시즌3 과목편) → src/data/inquiryLevel.json
분석 페이지(탐구 수준 정밀 진단 / 적정 탐구 수준 / 상담 포인트)와 '포함 모집단위' 목록을 추출한다."""
import pdfplumber, re, json, sys, collections
up = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/'
S2 = up + '_모두의_진학__그들이_좋아하는_탐구_학생부종합전형_시즌2_계열학과편__6___1_.pdf'
S3 = up + '_모두의_진학__그들이_좋아하는_탐구_학생부종합전형_시즌3_과목편__3_.pdf'
ws = lambda s: re.sub(r'\s+', ' ', s or '').strip()

def pages_text(path):
    out = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            w, h = p.width, p.height
            body = p.crop((0, 0, w * 0.83, h)).extract_text() or ''
            out.append(body)
    return out

def join_lines(t):
    # 줄바꿈으로 끊긴 문장 복원
    return ws(t.replace('\n', ' '))

LABELS = ['세특 설계', '단원별 탐구 설계', '추천 탐구 예시', '수준 조절', '주의할 점', '면접 대비', '세특 기록 포인트', '학과별 확장 방향', '추천 탐구', '예시']
def sections(txt):
    """번호 소제목(1.~4.)과 상담포인트 라벨 단위로 분리"""
    t = txt
    t = re.sub(r'\[모두의 진학\][^\n]*\n', '', t)
    t = re.sub(r'(INDEX|계열·학과 목차|과목 목차|◀[^\n]*)\n', '\n', t)
    d = {}
    m = re.search(r'◆\s*(.+?)\n\s*\n?\s*(?=\d\.\s)', t, re.S)
    if m: d['headline'] = join_lines(m.group(1))
    marks = [(mm.start(), mm.group(0)) for mm in re.finditer(r'^\s*\d\.\s+[^\n]+$', t, re.M)]
    for i, (pos, title) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(t)
        body = t[pos + len(title):end]
        key = ws(title)
        d[key] = body
    return d

def parse_counsel(body):
    """선생님 상담 포인트 영역 → 라벨별 텍스트"""
    i = body.find('상담 포인트')
    if i < 0: return {}
    c = body[i + 6:]
    out = {}
    # 라벨은 줄 단독 혹은 문장 앞에 놓임 — 알려진 라벨 위치로 분할
    pos = []
    for lab in ['세특 설계', '단원별', '추천 탐구', '수준 조절', '주의할 점', '면접 대비', '세특 기록', '학과별']:
        for mm in re.finditer(re.escape(lab), c):
            pos.append((mm.start(), lab))
    pos.sort()
    # 같은 라벨 중복 제거(처음 것)
    seen = set(); pp = []
    for p_, l in pos:
        if l not in seen: seen.add(l); pp.append((p_, l))
    for i, (p_, l) in enumerate(pp):
        e = pp[i + 1][0] if i + 1 < len(pp) else len(c)
        out[l] = join_lines(c[p_ + len(l):e])
    return out

def analyze(path, mode):
    pg = pages_text(path)
    groups = collections.OrderedDict()
    heads = {}
    for i, t in enumerate(pg):
        m = re.search(r'([^\n›]+) › ([^\n›]+) › 그들이 좋아하는 탐구', t)
        if m:
            g = ws(m.group(2)); groups.setdefault(g, {'fam': ws(m.group(1)).split()[-1], 'text': ''})
            groups[g]['text'] += '\n' + t
        # 학과군 첫 페이지 헤더: '질문받은 탐구 90건 │ 18개 대학' + 포함 모집단위
        mm = re.search(r'질문받은 탐구\s*(\d+)건', t)
        if mm and ('포함 모집단위' in t or mode == 3):
            nm = re.search(r'^[^\n›]*›\s*\n?([^\n]+)\n질문받은', t, re.M)
            heads[i] = t
    res = {}
    for g, v in groups.items():
        sec = sections(v['text'])
        item = {'fam': v['fam']}
        if 'headline' in sec: item['headline'] = sec['headline']
        for k, body in sec.items():
            if k.startswith('1.') or k.startswith('2.'): item['s' + k[0]] = join_lines(body)[:420]
            if k.startswith('3.'): item['mix'] = join_lines(body.split('상담 포인트')[0])[:560]
            if k.startswith('4.'):
                prop = body.split('상담 포인트')[0]
                item['proper'] = join_lines(prop)[:520]
                item.update({kk: vv[:300] for kk, vv in parse_counsel(body).items() if kk != '면접 대비'})
        for k in ('s1','s2'): item.pop(k,None)
        for k in list(item):
            if isinstance(item[k], str):
                item[k] = re.sub(r'\s*예시\s*(?=·)', ' ', item[k]).replace(' 예시 ·',' ·')
                item[k] = re.sub(r'\s*(과목\s*)?선생님\s*$', '', item[k]).strip()
        res[g] = item
    return res, pg

# ── 시즌2: 학과군 ──
g2, pg2 = analyze(S2, 2)
# 포함 모집단위 + 건수 (헤더 페이지는 넓게 crop)
depts = {}
with pdfplumber.open(S2) as pdf:
    for p in pdf.pages[:260]:
        t = p.crop((0, 0, p.width * 0.9, p.height)).extract_text() or ''
        m = re.search(r'\n(\S+) ›\n([^\n]+)\n질문받은 탐구\s*(\d+)건', t)
        mm = re.search(r'포함 모집단위:\s*(.+?)\n[^\n]*— 질문받은 탐구 전체 목록', t, re.S)
        if m and mm:
            lst = [ws(x) for x in re.split(r'[·,]', ws(mm.group(1)).rstrip(' 등')) if ws(x)]
            depts[ws(m.group(2))] = {'n': int(m.group(3)), 'depts': lst}
for g, it in g2.items():
    for k, v in depts.items():
        if k.replace(' ', '') in g.replace(' ', '') or g.replace(' ', '') in k.replace(' ', ''):
            it['depts'] = v['depts']; it['n'] = v['n']; break

# ── 시즌3: 과목 ──
g3, pg3 = analyze(S3, 3)
json.dump({'groups': g2, 'subjects': g3}, open('src/data/inquiryLevel.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('groups', len(g2), 'subjects', len(g3))
for g in list(g2)[:3]: print(g, {k: (v[:60] if isinstance(v, str) else v) for k, v in g2[g].items() if k != 'depts'}, len(g2[g].get('depts', [])))
print(list(g3)[:20])
