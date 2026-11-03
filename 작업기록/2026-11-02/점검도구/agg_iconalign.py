"""mk_iconalign 결과를 부품별로 모음. 사용: python -I agg_iconalign.py <결과 txt>"""
import collections
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
agg = collections.OrderedDict()
for line in open(sys.argv[1], encoding='utf-8'):
    if not line.startswith('##'):
        print(line.strip()[:200])
        continue
    url = line.split('|')[0][3:].strip()
    res = line.split('|', 2)[2].strip()
    try:
        d = json.loads(res)
    except Exception:
        print('BAD', url, res[:100])
        continue
    for k, v in d.items():
        a = agg.setdefault(k, {'d': 0, 'n': 0, 'pages': [], 'sample': v['sample']})
        if abs(v['d']) > abs(a['d']):
            a['d'] = v['d']
        a['n'] += v['n']
        a['pages'].append(url.split('?')[0])
for k, a in sorted(agg.items(), key=lambda x: -abs(x[1]['d'])):
    print(f"{a['d']:+.2f}px x{a['n']:3d} {k} | {a['sample']} | {','.join(a['pages'][:3])}{'...' if len(a['pages']) > 3 else ''}")
