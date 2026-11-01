# -*- coding: utf-8 -*-
"""업로드된 4개 HTML(전진협·경북진학지원단·서울 진학탐색기)에서 앱용 데이터(JSON)를 생성한다.
사용: python3 tools/build_plan_data.py <uploads_dir>   → src/data/plan2028.json, src/data/deptAdmit.json"""
import re, json, sys, collections, statistics
base = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/'
def rd(f): return open(base + f, encoding='utf-8', errors='ignore').read()
def big_script(t): return sorted(re.findall(r'<script[^>]*>(.*?)</script>', t, re.S), key=len, reverse=True)[0]
def to_int(x):
    m = re.search(r'\d[\d,]*', str(x or ''))
    return int(m.group(0).replace(',', '')) if m else 0
ws = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
def norm(u):
    u = ws(u).replace('대학교', '대').replace('학교', '') if u.endswith('학교') or '대학교' in u else ws(u)
    return u

# 1) 전진협: 대학별 전형 현황
t = rd("전진협_2028수시전형분석_전형검색기능추가___1_.html"); sc = big_script(t)
i = sc.find('window.__BOARD_DATA__ =') + len('window.__BOARD_DATA__ =')
board, _ = json.JSONDecoder().raw_decode(sc[i:].lstrip())
plan = {}
for univ, v in board['universities'].items():
    g = collections.OrderedDict()
    for r in v['rows']:
        k = (r.get('gubun') or '', r.get('jeonhyeong') or '')
        o = g.setdefault(k, {'cap': 0, 'csat': collections.Counter(), 'eval': collections.Counter(), 'grad': r.get('grad'), 'limit': r.get('limit'), 'note': r.get('note')})
        o['cap'] += to_int(r.get('cap'))
        if r.get('csat'): o['csat'][ws(r['csat'])[:80]] += 1
        if r.get('eval'): o['eval'][ws(r['eval'])[:110]] += 1
    rows = []
    for (gub, jh), o in g.items():
        rows.append([gub, jh, o['cap'], (o['eval'].most_common(1) or [['']])[0][0], (o['csat'].most_common(1) or [['']])[0][0], ws(o['grad'])[:12], ws(o['limit'])[:10]])
    plan[univ] = {'region': v.get('region'), 'cap': v.get('totalCap'), 'rows': rows}

# 2) 경북진학지원단: 2028 주요 변동사항 텍스트 (admchg 요약이 없으면 sec의 전/후 비교표로 대체)
ALIAS = [('여자대', '여대'), ('서울과학기술대', '서울과기대'), ('한국외국어대', '한국외대'), ('교육대', '교대'), ('차의과학대', '차의과대'),
         ('한국에너지공과대', '한국에너지공대'), ('포항공과대', 'POSTECH'), ('한국과학기술원', 'KAIST'), ('국립', '')]
def norm2(u):
    u = norm(u)
    for a, b in ALIAS: u = u.replace(a, b)
    return u
def paras_of(items):
    out = []
    for it in items or []:
        if isinstance(it, list) and len(it) > 1 and it[0] == 'p': out.append(ws(it[1]))
    return out
kb = json.loads(big_script(rd("2028_대입시행계획_변경사항_중심_-경북진학지원단__1_.html")).strip())
chg = {}
for u in kb:
    txt = ''
    for blk in (u.get('admchg') or [])[:1]:
        txt = ' / '.join(p for p in paras_of(blk) if p)
    if len(txt) < 40:
        parts = []
        for s in (u.get('sec') or []):
            for b in s.get('b', []):
                if b and b[0] == 'p' and len(b) > 1: parts.append(ws(b[1]))
                if b and b[0] == 'cmp':
                    for it in b[1]:
                        bf = ' '.join(paras_of(it.get('before'))); af = ' '.join(paras_of(it.get('after')))
                        if bf or af: parts.append(f"{s.get('t')}·{it.get('label')}: {bf[:70]} → {af[:90]}")
        txt = ' / '.join(parts)
    if txt: chg[norm2(u['n'])] = txt[:900]

# 3) 서울 진학탐색기: 2028 핵심 변경 + 학과별 입결
t = rd("서울_고1_2_진학_탐색기__20261023_.html"); d = json.loads(big_script(t).strip())
key = {}
for x in d.get('r2028', []):
    key[x['univ']] = {'key': [ws(k)[:140] for k in (x.get('key_changes') or [])[:3]],
                      'types': [[j.get('type'), j.get('name'), j.get('n2028'), ws(j.get('method'))[:90], ws(j.get('minimum'))[:50], ws(j.get('grad'))[:20], ws(j.get('change_note'))[:140]] for j in (x.get('jeonhyeong') or [])[:8]],
                      'js': ws(x.get('jeongsi_hakseng'))[:220]}
Y = [int(y) % 100 for y in d['years']]
rows = []
for r in d['rows']:
    if d['elig'][r[11]] != 'open': continue
    ys = []
    for i, a in enumerate(r[8]):
        if not a or Y[i] < 25: continue
        if a[0] is None and a[1] is None: continue
        ys.append([Y[i]] + [None if x is None else round(x, 2 if j < 2 else 1) for j, x in enumerate(a)])
    if ys: rows.append([d['univs'][r[0]], d['types'][r[1]][0], d['jhs'][r[2]], r[3], d['grs'][r[9]], ys])
json.dump({'plan': plan, 'chg': chg, 'key': key}, open('src/data/plan2028.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(rows, open('src/data/deptAdmit.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('plan univs', len(plan), 'chg', len(chg), 'key', len(key), 'dept rows', len(rows))
