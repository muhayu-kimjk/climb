"""로고 심볼과 climb 글자의 잉크 가운데를 재는 검사 JSON. 사용: python -I mk_logo.py <출력 JSON> <접두어>"""
import json, sys
JS = "(() => { const t = document.querySelector('.header-top .brand-title'), b = t.getBoundingClientRect(), m = t.querySelector('.brand-mark').getBoundingClientRect(), n = t.querySelector('.brand-name').getBoundingClientRect(), ht = document.querySelector('.header-top').getBoundingClientRect(), en = document.querySelector('.header-top .brand-en'), e = en && en.offsetParent ? en.getBoundingClientRect() : null, ul = document.querySelector('.header-top .user-line').getBoundingClientRect(), d = devicePixelRatio, r = x => Math.round(x * 10) / 10; return JSON.stringify({w: innerWidth, root: getComputedStyle(document.documentElement).fontSize, nameFs: getComputedStyle(t.querySelector('.brand-name')).fontSize, markH: r(m.height), headerTopH: r(ht.height), gnbTop: r(document.querySelector('.gnb') ? document.querySelector('.gnb').getBoundingClientRect().top : 0), titleTop: r(b.top - ht.top), enBottom: e ? r(e.bottom - ht.top) : null, userLine: [r(ul.top - ht.top), r(ul.bottom - ht.top)], markX: Math.round((m.left - b.left) * d) + ':' + Math.round((m.right - b.left) * d), nameX: Math.round((n.left - b.left) * d) + ':' + Math.round((n.right - b.left) * d)}); })()"
pre = sys.argv[2]
spec = []
for tag, w, h, dpr in [('pc', 1000, 800, 1), ('pc2', 1000, 800, 2), ('phone', 402, 874, 3)]:
    for page in ['index.html?role=SUPER', 'quote.html?role=SALES']:
        spec.append({'url': page, 'w': w, 'h': h, 'dpr': dpr, 'js': JS, 'shot': pre + '_' + tag + '_' + page.split('.')[0], 'sel': '.header-top .brand-title'})
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
