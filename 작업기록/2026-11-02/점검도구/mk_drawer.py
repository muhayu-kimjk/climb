import json, sys
open_js = "document.querySelector('.menu-btn').click(); await new Promise(r => setTimeout(r, 400));"
info = "const d = document.querySelector('.drawer'), r = x => Math.round(x * 10) / 10; const t = d.querySelector('.drawer-theme'), c = d.querySelector('.drawer-close'), tb = t.getBoundingClientRect(), cb = c.getBoundingClientRect(); const lvl1 = [...d.querySelectorAll('.drawer-list[data-level=\"1\"] > li')].map(li => li.textContent.trim()); const foot = [...d.querySelectorAll('.drawer-foot li')].map(li => li.textContent.trim()); const st = () => ({theme: document.documentElement.getAttribute('data-theme'), pressed: t.getAttribute('aria-pressed'), icon: t.querySelector('svg circle') ? 'sun' : 'moon', saved: localStorage.getItem('climb.demoTheme')});"
js1 = "(async () => { localStorage.removeItem('climb.demoTheme'); " + open_js + info + " const before = st(); t.click(); await new Promise(r => setTimeout(r, 200)); const after = st(); const focusOk = document.activeElement === t; return JSON.stringify({lvl1, foot, theme: [r(tb.left), r(tb.right), r(tb.width), r(tb.height)], close: [r(cb.left), r(cb.right)], label: t.getAttribute('aria-label'), before, after, focusOk}); })()"
js2 = "(async () => { " + open_js + info + " const s = st(); return JSON.stringify(s); })()"
js3 = "(async () => { " + open_js + info + " t.click(); await new Promise(r => setTimeout(r, 200)); return JSON.stringify(st()); })()"
acc = "(async () => { const v = [...document.querySelectorAll('[name=theme]')].find(x => x.checked); " + open_js + " document.querySelector('.drawer-theme').click(); await new Promise(r => setTimeout(r, 200)); const v2 = [...document.querySelectorAll('[name=theme]')].find(x => x.checked); return 'account before ' + (v && v.value) + ' after ' + (v2 && v2.value) + ' theme ' + document.documentElement.getAttribute('data-theme'); })()"
spec = [
 {'url': 'quote.html?role=SUPER', 'w': 402, 'h': 874, 'dpr': 2, 'js': js1, 'shot': 'drawer_dark'},
 {'url': 'quote.html?role=SUPER', 'w': 402, 'h': 874, 'dpr': 2, 'js': js2},
 {'url': 'quote.html?role=SUPER', 'w': 402, 'h': 874, 'dpr': 2, 'js': js3, 'shot': 'drawer_light'},
 {'url': 'account.html?role=SUPER', 'w': 402, 'h': 874, 'js': acc},
 {'url': 'help.html?role=SUPER', 'w': 402, 'h': 874, 'js': "(async () => { " + open_js + " const a = document.querySelector('.drawer-list[data-level=\"1\"] a[href=\"help.html\"]'); return a.getAttribute('aria-current') + ' ' + a.className; })()"},
]
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
