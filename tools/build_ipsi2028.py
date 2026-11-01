# -*- coding: utf-8 -*-
"""2028학년도 대학입학전형시행계획(전체대학, 2026-05-07 기준) 엑셀 → src/data/ipsi2028.json
수시 계열 전형(교과·종합·논술·실기·기타)의 대학별 목록, 모집단위별 인원, 선발방법·반영비율, 수능최저 유무를 담는다."""
import openpyxl, re, json, sys, collections
path = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/보안-2028학년도_대학입학전형시행계획_출력_전체대학__2026_05_07_기준___6_.xlsx'
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = lambda r: re.sub(r'\s+', ' ', str(r or '')).strip()
def norm(u, campus):
    u = ws(u).replace('대학교', '대').replace('여자대', '여대')
    for a, b in [('서울과학기술대', '서울과기대'), ('한국외국어대', '한국외대'), ('교육대', '교대'), ('한국과학기술원', 'KAIST'), ('포항공과대', 'POSTECH'), ('국립', ''), ('대학', '대학')]:
        u = u.replace(a, b)
    if u == '단국대': u = '단국대(죽전)' if campus == '본교' else '단국대(천안)'
    return u
TY = {'학생부위주(교과)': '교과', '학생부위주(종합)': '종합', '논술위주': '논술', '실기/실적위주': '실기', '기타': '기타'}
# 1) 전형별 모집인원
base = collections.OrderedDict()
for r in wb['전형별 모집인원'].iter_rows(min_row=3, values_only=True):
    if not r or not r[0] or '소계' in str(r[0]) or r[5] not in ('수시', '전형기간자율') or r[6] not in TY: continue
    key = (r[0], r[2], r[4], r[5], ws(r[9]))
    units = {}
    for part in str(r[10] or '').replace('\n', ',').split(','):
        if ':' in part:
            k, v = part.rsplit(':', 1)
            try: units[ws(k)] = int(re.sub(r'\D', '', v) or 0)
            except: pass
    e = base.setdefault(key, {'u': norm(r[0], r[2]), 'cp': r[2] if r[2] != '본교' else '', 'ar': ws(r[1]), 'tm': r[5], 'ty': TY[r[6]], 'nm': ws(r[9]), 'big': ws(r[7]), 'mid': ws(r[8]), 'in': r[4], 'n': 0, 'un': {}})
    try: e['n'] += int(r[15] or 0)
    except: pass
    for k, v in units.items(): e['un'][k] = e['un'].get(k, 0) + v
# 2) 선발방법·반영비율·최저
meth = collections.defaultdict(list)
for r in wb['전형별 전형요소 반영비율'].iter_rows(min_row=3, values_only=True):
    if not r or not r[0] or r[4] not in ('수시', '전형기간자율'): continue
    key = (r[0], r[2], r[5], r[4], ws(r[9]))
    f = lambda v: None if v in (None, '') else v
    meth[key].append({'step': ws(r[13]), 'pct': f(r[14]), 'hs': f(r[15]), 'su': f(r[16]), 'iv': f(r[17]), 'es': f(r[18]), 's1': f(r[19]), 'sg': f(r[20]), 'doc': f(r[21]), 'min': ws(r[12])})
def mtext(rows):
    out = []; mn = False
    for m in rows:
        if m['min'].startswith('있음'): mn = True
        parts = [f"{k}{int(v) if float(v).is_integer() else v}" for k, v in [('학생부', m['hs']), ('서류', m['doc']), ('면접', m['iv']), ('논술', m['es']), ('1단계', m['s1']), ('실기', m['sg']), ('수능', m['su'])] if v]
        s = m['step']
        if s.startswith('1단계'): out.append(f"1단계 {(float(m['pct'])/100):g}배수 ({'+'.join(parts)})" if m['pct'] else '1단계 ' + '+'.join(parts))
        elif s.startswith('2단계'): out.append('2단계 ' + '+'.join(parts))
        else: out.append('일괄합산 ' + '+'.join(parts))
    seen = []; [seen.append(x) for x in out if x not in seen]
    return ' → '.join(seen), mn
res = collections.defaultdict(list)
for key, e in base.items():
    t, mn = mtext(meth.get(key, [])); e['me'] = t; e['mn'] = 1 if mn else 0
    iv = bool(re.search(r'면접', t)); e['iv'] = 1 if iv else 0
    u = e.pop('u'); res[u].append(e)
json.dump(res, open('src/data/ipsi2028.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
n = sum(len(v) for v in res.values()); print('univs', len(res), 'entries', n, 'comprehensive', sum(1 for v in res.values() for e in v if e['ty'] == '종합'))
