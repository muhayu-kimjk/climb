"""아이콘과 옆 글자(입력 칸이면 입력한 글자)의 실제 그림 가운데를 재어 세로로 어긋난 곳을 찾음.
사용: python -I mk_iconalign.py <출력 JSON> [w]
  글자: 캔버스로 그 글자의 실제 잉크 위아래를 재고, 기준선은 글자 뒤에 넣은 0px 표시로 잼(입력 칸은 계산)
  아이콘: svg 안 그림의 경계 상자 가운데
  결과: 화면마다 0.75px보다 많이 어긋난 곳을 부품(부모 클래스)별로 묶어 최대 차이와 함께"""
import json
import sys

JS = r"""(async () => {
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 펼쳐야 보이는 것: 머리글 검색 판
const sb = document.querySelector('.user-line .search-btn'); if (sb && sb.offsetParent) { sb.click(); await sleep(250); }
const ctx = document.createElement('canvas').getContext('2d');
const fontOf = cs => cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
const vis = e => e && e.offsetParent !== null && e.getClientRects().length;
function iconInk(svg) {
  const r = svg.getBoundingClientRect(); const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.height) return r.top + r.height / 2;
  let bb; try { bb = svg.getBBox(); } catch (e) { return r.top + r.height / 2; }
  const s = Math.min(r.width / vb.width, r.height / vb.height);
  const offY = (r.height - vb.height * s) / 2;
  return r.top + offY + (bb.y + bb.height / 2 - vb.y) * s;
}
function textInk(node, text) {
  const el = node.parentElement, cs = getComputedStyle(el);
  // 글자를 잠깐 span으로 감싸고 그 안 끝에 0px 표시를 넣어 기준선을 잼(부모가 flex여도 span 안은 글줄이라 기준선이 맞음)
  const wrap = document.createElement('span'); node.parentNode.insertBefore(wrap, node); wrap.appendChild(node);
  const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline';
  wrap.appendChild(m); const base = m.getBoundingClientRect().top; m.remove();
  wrap.parentNode.insertBefore(node, wrap); wrap.remove();
  ctx.font = fontOf(cs); const t = ctx.measureText(text);
  return base - (t.actualBoundingBoxAscent - t.actualBoundingBoxDescent) / 2;
}
function inputInk(inp, text) {
  const cs = getComputedStyle(inp), r = inp.getBoundingClientRect();
  ctx.font = fontOf(cs); const t = ctx.measureText(text);
  const fA = t.fontBoundingBoxAscent, fD = t.fontBoundingBoxDescent;
  const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
  const h = r.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const lh = cs.lineHeight === 'normal' ? fA + fD : parseFloat(cs.lineHeight);
  const base = top + (h - lh) / 2 + (lh - (fA + fD)) / 2 + fA;
  return base - (t.actualBoundingBoxAscent - t.actualBoundingBoxDescent) / 2;
}
const out = {};
document.querySelectorAll('svg.icon').forEach(svg => {
  if (!vis(svg) || svg.closest('[hidden], .sr-only')) return;
  const box = svg.parentElement; if (!box) return;
  let ink = null, kind = '';
  const inp = box.querySelector('input:not([type=checkbox]):not([type=radio]), textarea');
  if (inp && vis(inp) && inp.type !== 'hidden') { ink = inputInk(inp, '검색 Ag'); kind = 'input'; }
  else {
    const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: x => x.textContent.trim() && vis(x.parentElement) && !x.parentElement.closest('.sr-only, svg') ? 1 : 3 });
    const n = w.nextNode(); if (!n) return;
    const nb = n.parentElement.getBoundingClientRect(), ib = svg.getBoundingClientRect();
    if (nb.bottom < ib.top - 4 || nb.top > ib.bottom + 4) return; // 같은 줄이 아니면 뺌
    ink = textInk(n, n.textContent.trim().slice(0, 6)); kind = 'text';
  }
  const d = Math.round((ink - iconInk(svg)) * 100) / 100;
  if (Math.abs(d) <= 0.75) return;
  const key = kind + ' ' + (box.className && box.className.baseVal === undefined ? String(box.className).split(' ').slice(0, 2).join('.') : box.tagName) + ' / ' + (svg.getAttribute('class') || '') ;
  if (!out[key] || Math.abs(out[key].d) < Math.abs(d)) out[key] = { d, n: (out[key] ? out[key].n : 0) + 1, sample: (box.textContent || '').trim().slice(0, 14) };
  else out[key].n++;
});
return JSON.stringify(out);
})()"""

urls = []
sweep = json.load(open(sys.argv[1].rsplit('/', 1)[0] + '/check_sweep.json', encoding='utf-8'))
for ck in sweep:
    u = ck['url'].split('?')[0]
    if u not in urls and 'login' not in u:
        urls.append(u)
for extra in ('discount-review.html', 'opp-recon.html', 'seal-recon.html', 'remediation.html', 'config-review.html', 'company-settings.html'):
    if extra not in urls:
        urls.append(extra)
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
spec = [{"url": u + '?role=SUPER', "js": JS, "w": w, "h": 1300} for u in urls]
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
