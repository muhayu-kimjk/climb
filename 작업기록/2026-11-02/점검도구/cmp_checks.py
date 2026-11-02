"""전체 점검 결과를 지난번(93)과 견줌: 오류 난 화면, 흑백 아닌 색, 값이 달라진 줄.
사용: python -I cmp_checks.py <scratchpad> <꼬리표>"""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
S, TAG = sys.argv[1], sys.argv[2]
PAIRS = [('sweep', 'sweep93.txt', 'sweep_%s.txt'), ('qa', 'qa93.txt', 'qa2_%s.txt'), ('gray', 'gray93.txt', 'gray_%s.txt')]


def lines(path):
    if not os.path.exists(path):
        return None
    return [l.rstrip('\n') for l in open(path, encoding='utf-8-sig') if l.startswith('##')]


for name, old, new in PAIRS:
    a, b = lines(os.path.join(S, old)), lines(os.path.join(S, new % TAG))
    if b is None:
        print(name, ': 결과 없음')
        continue
    errs = [l for l in b if 'errors= []' not in l]
    notgray = [l for l in b if re.search(r'notgray=([1-9]\d*)', l)]
    print('%s: loads %d, with errors %d, notgray %d' % (name, len(b), len(errs), len(notgray)))
    for l in errs[:20]:
        print('  ERR', l[:400])
    for l in notgray[:10]:
        print('  GRAY', l[:300])
    if a:
        changed = [(x, y) for x, y in zip(a, b) if x != y]
        print('  changed vs 93: %d (old %d lines, new %d lines)' % (len(changed), len(a), len(b)))
        for x, y in changed[:40]:
            print('   -', x[:300])
            print('   +', y[:300])
