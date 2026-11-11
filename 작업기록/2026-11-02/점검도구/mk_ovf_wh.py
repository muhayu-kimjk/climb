"""휴대폰(402px)에서 옆으로 밀리는 곳을 화면마다 찾음. 사용: python -I mk_phoneovf.py <sweep JSON> <출력 JSON>"""
import json, sys
src = json.load(open(sys.argv[1], encoding='utf-8'))
urls = []
for ck in src:
    u = ck['url']
    if u not in urls:
        urls.append(u)
JS = r"""(async () => { await new Promise(r => setTimeout(r, 300)); const out = []; const vw = document.documentElement.clientWidth;
if (document.documentElement.scrollWidth > vw + 1) out.push('PAGE ' + (document.documentElement.scrollWidth - vw));
const seen = new Set();
document.querySelectorAll('main *').forEach(e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return; const cs = getComputedStyle(e); if (!/(auto|scroll)/.test(cs.overflowX)) return; if (e.scrollWidth > e.clientWidth + 1) { const t = e.querySelector('table'); const key = (t ? 'TABLE.' + (t.className || '-') : e.tagName + '.' + (e.className || '-')); if (!seen.has(key)) { seen.add(key); out.push('SCROLL ' + key + ' +' + (e.scrollWidth - e.clientWidth)); } } });
return out.join(' ; ') || 'ok'; })()"""
spec = [{'url': u, 'w': int(sys.argv[3]), 'h': int(sys.argv[4]), 'js': JS} for u in urls]
json.dump(spec, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))

