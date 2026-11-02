"""워크플로 결과 요약: 못 한 것, 채운 빈틈, 확인된 문제, 고친 것.
사용: python -I wave_summary.py <출력 파일>"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
r = json.load(open(sys.argv[1], encoding='utf-8'))['result']


def show(title, items):
    if items:
        print('## ' + title)
        for x in items:
            print('-', x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)[:600])


groups = (r.get('impl') or r.get('all') or [])
for g in groups:
    if not g:
        continue
    print('=== ' + str(g.get('key')) + ': ' + (g.get('summary') or '')[:300])
    show('not_done', g.get('not_done'))
    show('gaps', g.get('gaps_filled'))
for k in ('cross', 'overview'):
    if r.get(k):
        print('=== ' + k + ': ' + (r[k].get('summary') or '')[:400])
        show('not_done', r[k].get('not_done'))
for k in ('docD', 'docOther'):
    if r.get(k):
        print('=== ' + k + ': ' + str(r[k])[:1500])
if r.get('docs'):
    for d in r['docs']:
        print('=== docs: ' + str(d)[:1500])
show('confirmed findings', r.get('confirmed'))
if r.get('fix'):
    print('=== fix: ' + (r['fix'].get('summary') or '')[:800])
    show('fix not_done', r['fix'].get('not_done'))
