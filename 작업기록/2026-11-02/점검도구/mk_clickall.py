"""화면마다 보이는 단추를 차례로 눌러 스크립트 오류를 찾는 검사 JSON.
사용: python -I mk_clickall.py <sweep JSON> <출력 JSON> [w]
  링크 이동은 막고(window 클릭 가로채기), 인쇄와 새 창은 막음. 창이 열리면 Esc와 닫기로 닫음. 단추는 화면마다 최대 60개"""
import json
import sys

src = json.load(open(sys.argv[1], encoding='utf-8'))
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
urls = []
for ck in src:
    u = ck['url']
    if u not in urls and not u.startswith('login'):
        urls.append(u)
JS = r"""(async () => {
  const errs = [];
  window.addEventListener('error', e => errs.push('E ' + (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => errs.push('R ' + String(e.reason && e.reason.message || e.reason)));
  window.print = () => {}; window.open = () => null;
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (a) e.preventDefault(); }, true);
  document.addEventListener('submit', e => e.preventDefault(), false);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(300);
  const vis = el => !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const seen = new Set(); let clicked = 0; const names = [];
  for (let round = 0; round < 60; round++) {
    const list = [...document.querySelectorAll('main button, main [role=button], main summary, [role=dialog] button')].filter(b => vis(b) && !b.disabled);
    const b = list.find(x => !seen.has(x));
    if (!b) break;
    seen.add(b);
    const label = (b.textContent || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (/로그아웃|시연 기록 지우기/.test(label)) continue;
    try { b.click(); } catch (e) { errs.push('C ' + label + ': ' + e.message); }
    clicked++; names.push(label);
    await wait(120);
    const dlg = [...document.querySelectorAll('[role=dialog]')].find(d => vis(d) && !d.closest('.drawer'));
    if (dlg && !dlg.contains(b)) {
      // 창 안의 단추도 한 번씩(확인 단추는 빼고) 누른 뒤 닫음
      const inner = [...dlg.querySelectorAll('button')].filter(x => vis(x) && !x.disabled && !/^(저장|확인|승인|반려|기안|지우기|끝내기|내리기|올리기|보내기)/.test(x.textContent.trim()) && !x.matches('[data-act=close], [data-act=cancel]'));
      for (const x of inner.slice(0, 6)) { try { x.click(); } catch (e) { errs.push('C dlg ' + e.message); } await wait(80); }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
      const close = [...document.querySelectorAll('[role=dialog] [data-act=close], [role=dialog] [data-act=cancel]')].find(vis);
      if (close) { close.click(); await wait(80); }
    }
  }
  return JSON.stringify({ clicked, errs: errs.slice(0, 8) });
})()"""
spec = []
for u in urls:
    spec.append({'url': u, 'w': w, 'h': 900, 'js': JS})
json.dump(spec, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
