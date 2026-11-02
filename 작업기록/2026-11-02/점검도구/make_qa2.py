"""v0.59 전체 QA: 기획자가 지금까지 정한 규칙을 모든 화면에서 기계로 검사하는 파일을 만듦.
PC 밝은 화면(최고관리자), PC 어두운 화면, 휴대폰(402px), 영업 역할 몇 화면. 사용: python -I make_qa2.py <scratchpad>"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
base = sys.argv[1]
sweep = json.load(open(base + "/check_sweep.json", encoding="utf-8"))
urls = []
for ck in sweep[1:]:
    if ck["url"] not in urls and "login" not in ck["url"]:
        urls.append(ck["url"])

QA = r"""(() => {
  const vis = e => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const out = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push('HSCROLL ' + de.scrollWidth + '>' + de.clientWidth);
  const sh = document.querySelector('.sheet'); const sr = sh && sh.getBoundingClientRect();
  const sheet = sr ? Math.round(sr.left) + '/' + Math.round(sr.width) : '-';
  // 글자 검사
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = e => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; const m = b.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.5)) return b; } return getComputedStyle(document.body).backgroundColor; };
  const bad = { date: new Set(), name: new Set(), plat: new Set(), undef: new Set(), font: new Set(), con: new Set() };
  let dot = 0;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, cnt = 0;
  while ((n = tw.nextNode())) {
    const t = n.textContent; if (!t.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, .sr-only, .demo-bar, .watermark, noscript') || !vis(el)) continue;
    if (/\d{4}\.\s?\d{1,2}\.\s?\d{1,2}/.test(t)) bad.date.add(t.trim().slice(0, 24));
    if (/climb/i.test(t) && !el.closest('[class*="brand"]')) bad.name.add(t.trim().slice(0, 30));
    if (/플랫폼/.test(t)) bad.plat.add(t.trim().slice(0, 30));
    dot += (t.match(/·/g) || []).length;
    if (/\bundefined\b|\bNaN\b|\bnull\b|\[object/.test(t)) bad.undef.add(t.trim().slice(0, 30));
    const cs = getComputedStyle(el);
    const ff = cs.fontFamily.split(',')[0].replace(/"/g, '').trim();
    if (ff !== 'Noto Sans KR' && !el.closest('[class*="brand"], code, pre')) bad.font.add(ff + ':' + el.tagName + (el.className && el.className.baseVal === undefined ? '.' + el.className : ''));
    if (cnt++ < 4000 && !el.closest(':disabled, [aria-disabled="true"], .is-disabled, .is-skipped, [disabled]')) {
      const L1 = lum(cs.color), L2 = lum(bgOf(el));
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
      if (ratio < need) bad.con.add(ratio.toFixed(2) + ' ' + el.tagName + '.' + String(el.className).split(' ')[0] + ' "' + t.trim().slice(0, 12) + '"');
    }
  }
  for (const k of ['date', 'name', 'plat', 'undef', 'font', 'con']) if (bad[k].size) out.push(k.toUpperCase() + '(' + bad[k].size + ') ' + [...bad[k]].slice(0, 4).join(' ; '));
  if (dot) out.push('DOT ' + dot);
  // 제목 위계
  const sizes = sel => [...document.querySelectorAll(sel)].filter(vis).map(e => parseFloat(getComputedStyle(e).fontSize));
  const mx = a => a.length ? Math.max(...a) : 0, mn = a => a.length ? Math.min(...a) : 0;
  const page = mn(sizes('.page-title')), panel = mn(sizes('.panel-title, .section-title')), sub = mn(sizes('.block-subtitle, .box-subtitle, .round-title, .chart-title, .release-part h2')),
        cell = mx(sizes('.cell-title')), label = mx(sizes('.field-label')), count = mx(sizes('.step-count'));
  if (page && panel && page <= panel) out.push('HIER page' + page + '<=panel' + panel);
  if (panel && sub && panel <= sub) out.push('HIER panel' + panel + '<=sub' + sub);
  if (sub && cell && sub <= cell) out.push('HIER sub' + sub + '<=cell' + cell);
  if (panel && label && panel <= label) out.push('HIER panel' + panel + '<=label' + label);
  if (panel && count && count > panel) out.push('HIER count' + count + '>panel' + panel);
  // 표: 머리글 가운데, 금액 오른쪽, 한 줄 세로 줄맞춤
  let thBad = 0, amtBad = new Set(), rowBad = [], rows = 0;
  // 머리글은 그 칸 내용과 같은 정렬(v0.59): 첫 줄 칸과 비교(합친 칸이 없는 표만)
  document.querySelectorAll('table.tbl').forEach(tb => {
    const hr = tb.tHead && tb.tHead.rows[tb.tHead.rows.length - 1]; const br = [...(tb.tBodies[0] ? tb.tBodies[0].rows : [])].find(r => [...r.cells].every(c => c.colSpan === 1 && c.rowSpan === 1) && r.cells.length === (hr ? hr.cells.length : -1));
    if (!hr || !br || tb.tHead.rows.length > 1) return;
    [...hr.cells].forEach((th, i) => { const td = br.cells[i]; if (!vis(th) || !vis(td) || !td.textContent.trim()) return; const n = a => a === 'end' ? 'right' : a === 'justify' || a === 'start' ? 'left' : a; if (n(getComputedStyle(th).textAlign) !== n(getComputedStyle(td).textAlign)) thBad++; });
  });
  document.querySelectorAll('td, .amount-total-value, dd').forEach(td => {
    if (!vis(td)) return; const t = td.textContent.trim();
    if (/^-?[\d,]+\s?원(\s|$)/.test(t) && !/^(right|end)$/.test(getComputedStyle(td).textAlign)) amtBad.add(td.tagName + '.' + td.className + ' "' + t.slice(0, 14) + '"');
  });
  document.querySelectorAll('table:not(.approval-box)').forEach(tb => { // 결재란은 칸마다 여러 줄을 세로 가운데로 두는 설계라 뺌
    [...tb.querySelectorAll('tbody tr')].filter(vis).slice(0, 8).forEach(tr => {
      const mids = [];
      [...tr.children].forEach(td => {
        const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT, { acceptNode: x => x.textContent.trim() && vis(x.parentElement) && !x.parentElement.closest('.sr-only') ? 1 : 3 });
        const t = w.nextNode(); if (!t) return;
        const badge = t.parentElement.closest('.badge, .wait-long');
        let b;
        if (badge) b = badge.getBoundingClientRect(); else { const r = document.createRange(); r.selectNodeContents(t); b = r.getClientRects()[0]; }
        if (b) mids.push(b.top + b.height / 2);
      });
      if (mids.length > 1) { rows++; const d = Math.max(...mids) - Math.min(...mids); if (d > 1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize) / 10) rowBad.push(d.toFixed(1) + ':' + tr.textContent.trim().slice(0, 10)); }
    });
  });
  if (thBad) out.push('THALIGN ' + thBad);
  if (amtBad.size) out.push('AMOUNT(' + amtBad.size + ') ' + [...amtBad].slice(0, 3).join(' ; '));
  if (rowBad.length) out.push('ROWALIGN ' + rowBad.length + '/' + rows + ' ' + rowBad.slice(0, 3).join(' ; '));
  // 회색 안내 상자
  document.querySelectorAll('.page-intro, .section-desc').forEach(e => { if (vis(e) && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(e).backgroundColor)) out.push('NOGRAY ' + e.className); });
  // 메뉴 한 줄(PC) / 휴대폰 탭 막대
  const phone = innerWidth <= 600;
  if (!phone) { const hi = [...document.querySelectorAll('.user-line .hdr-icon')].filter(vis).map(e => e.classList[1]).join(','); if (hi !== 'acc-btn,search-btn') out.push('PC_HDR_ICONS ' + hi); }
  if (!phone && document.querySelector('.gnb-list').scrollWidth > document.querySelector('.gnb-list').clientWidth + 1) out.push('GNB_OVERFLOW');
  if (!phone) { const tops = [...document.querySelectorAll('.gnb-list > li')].filter(vis).map(li => li.offsetTop); if (tops.length && new Set(tops).size > 1) out.push('MENU2LINES'); }
  else {
    if (vis(document.querySelector('.gnb'))) out.push('PHONE_GNB_VISIBLE');
    if (!vis(document.querySelector('.menu-btn'))) out.push('NO_MENU_BTN'); // v0.60: 탭 막대 대신 ≡ 메뉴
    const hi = [...document.querySelectorAll('.user-line .hdr-icon')].filter(vis).map(e => e.classList[1]).join(',');
    if (hi !== 'acc-btn,search-btn,menu-btn') out.push('HDR_ICONS ' + hi); // v0.61: 계정, 검색, 전체 메뉴 순서
    const small = new Set();
    document.querySelectorAll('a, button, input:not([type=hidden]), select, textarea').forEach(e => {
      if (!vis(e) || e.closest('.sr-only, .demo-bar, .choice, .tab-sheet') || e.matches('.choice input')) return;
      const cs = getComputedStyle(e); if (cs.display === 'inline') return;
      const r = e.getBoundingClientRect(); if (r.height && r.height < 43.5) small.add(e.tagName + '.' + String(e.className).split(' ')[0] + ' ' + Math.round(r.height));
    });
    if (small.size) out.push('TOUCH(' + small.size + ') ' + [...small].slice(0, 4).join(' ; '));
  }
  return 'sheet=' + sheet + (out.length ? ' | ' + out.join(' | ') : ' | OK');
})()"""

checks = [dict(url="index.html", js="localStorage.setItem('climb.demoRole','SUPER'); localStorage.removeItem('climb.theme'); 'SUPER'")]
for u in urls:
    checks.append(dict(url=u, js=QA))
for u in urls:
    checks.append(dict(url=u, dark=True, js=QA))
for u in urls:
    checks.append(dict(url=u, w=402, h=874, js=QA))
checks.append(dict(url="index.html", js="localStorage.setItem('climb.demoRole','SALES'); 'SALES'"))
for u in ["index.html", "new-contract.html", "my-contracts.html", "contracts.html", "progress.html", "expiring.html", "quotes.html", "quote.html", "quote.html?no=QT2610-001&ver=2"]:
    checks.append(dict(url=u, js=QA))
    checks.append(dict(url=u, w=402, h=874, js=QA))
checks.append(dict(url="index.html", js="localStorage.setItem('climb.demoRole','SUPER'); 'SUPER'"))
json.dump(checks, open(base + "/check_qa2.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(checks), "건,", len(urls), "화면")
