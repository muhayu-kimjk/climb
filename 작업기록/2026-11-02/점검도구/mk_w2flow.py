"""둘째 묶음(2026-11-02 A, B, C-14, C-15, E-2, E-3, E-12)의 화면을 열고 버튼과 창을 확인하는 검사 JSON을 만듦.
사용: python -I mk_w2flow.py <출력 JSON> [discover|act]
  discover: 각 화면의 보이는 버튼, 찾는 글자, 넘침, 지정한 버튼을 눌러 뜬 창의 글자
  act: 창을 채워 실제로 처리해 보고 다음 상태를 읽음(처음에 시연 상태를 지움)"""
import json
import sys

LIB = r"""
const wait = ms => new Promise(r => setTimeout(r, ms));
const vis = e => e && e.offsetParent !== null;
const txt = () => document.body.innerText;
const btn = t => [...document.querySelectorAll('button, a.btn')].find(b => vis(b) && !b.disabled && b.textContent.replace(/\s+/g, ' ').trim().includes(t));
const dlg = () => [...document.querySelectorAll('[role=dialog]')].find(d => vis(d) && !d.classList.contains('drawer-panel'));
async function fill(d) {
  const groups = new Set();
  for (const r of d.querySelectorAll('input[type=radio]')) { if (!groups.has(r.name)) { groups.add(r.name); r.click(); } }
  for (const c of d.querySelectorAll('input[type=checkbox]')) if (!c.checked && !c.disabled) c.click();
  for (const t of d.querySelectorAll('textarea, input[type=text], input:not([type])')) if (!t.value && !t.disabled && !t.readOnly) {
    const isDate = t.getAttribute('min') || /달력/.test((t.closest('.field') || {}).textContent || '');
    t.value = isDate ? (window.W2DATE || t.getAttribute('min') || '2026-10-18') : '시연 확인';
    t.dispatchEvent(new Event('input', {bubbles: true})); t.dispatchEvent(new Event('change', {bubbles: true}));
  }
  for (const t of d.querySelectorAll('input[type=date]')) if (!t.value && !t.disabled) { t.value = t.min || t.max || '2026-11-02'; t.dispatchEvent(new Event('input', {bubbles: true})); t.dispatchEvent(new Event('change', {bubbles: true})); }
  for (const s of d.querySelectorAll('select')) if (!s.value && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', {bubbles: true})); }
  await wait(150);
}
async function act(label) {
  const b = btn(label); if (!b) return {btn: label, result: 'NO BUTTON'};
  b.click(); await wait(400);
  const d = dlg(); if (!d) return {btn: label, result: 'NO DIALOG'};
  const title = (d.querySelector('h2') || {}).textContent;
  await fill(d);
  const ok = [...d.querySelectorAll('.modal-actions button, button[type=submit]')].filter(vis).pop();
  ok.click(); await wait(500);
  const still = dlg();
  const errs = still ? [...still.querySelectorAll('.field-error, .error-text, [role=alert]')].filter(vis).map(e => e.textContent.trim()).filter(Boolean) : [];
  return {btn: label, title, submitted: ok.textContent.trim(), stillOpen: !!still, errs};
}
"""


def discover(url, texts, click=None, role='SUPER', w=1000):
    sep = '&' if '?' in url else '?'
    js = '(async () => {' + LIB + """
const out = {h1: (document.querySelector('h1') || {}).textContent, over: document.documentElement.scrollWidth - innerWidth, has: {}};
for (const t of %s) out.has[t] = txt().includes(t);
out.buttons = [...document.querySelectorAll('main button, main a.btn')].filter(b => vis(b) && !b.disabled).map(b => b.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 25);
const c = %s;
if (c) { const b = btn(c); if (b) { b.click(); await wait(400); const d = dlg(); out.dialog = d ? d.innerText.replace(/\\s+/g, ' ').slice(0, 500) : 'NO DIALOG'; } else out.dialog = 'NO BUTTON'; }
return JSON.stringify(out);
})()""" % (json.dumps(texts, ensure_ascii=False), json.dumps(click, ensure_ascii=False))
    return {"url": url + sep + 'role=' + role, "js": js, "w": w, "h": 1300}


def flow(url, steps, read, role='SUPER', clear=False):
    """steps: 누를 버튼 글자 목록(차례대로, 각 단계 뒤 다시 읽음). read: 끝난 뒤 찾을 글자"""
    sep = '&' if '?' in url else '?'
    js = '(async () => {' + LIB + """
const out = {steps: []};
for (const s of %s) { out.steps.push(await act(s)); await wait(300); }
return JSON.stringify(out);
})()""" % json.dumps(steps, ensure_ascii=False)
    pre = []
    if clear:
        pre.append({"url": "index.html?role=SUPER", "js": "(() => { Object.keys(localStorage).filter(k => k.startsWith('climb.')).forEach(k => localStorage.removeItem(k)); return 'cleared'; })()"})
    after = {"url": url + sep + 'role=' + role, "js": "(() => { const t = document.body.innerText; return JSON.stringify(Object.fromEntries(%s.map(x => [x, t.includes(x)]))); })()" % json.dumps(read, ensure_ascii=False)}
    return pre + [{"url": url + sep + 'role=' + role, "js": js, "w": 1000, "h": 1300}, after]


mode = sys.argv[2] if len(sys.argv) > 2 else 'discover'
spec = []
if mode == 'discover':
    spec += [
        discover('review.html?id=2610CL009', ['영업 임원', '할인율 한도', '이해관계'], click='승인'),
        discover('review.html?id=2610CL010', ['같은 거래처', '나눠'], click='승인'),
        discover('review.html?id=2610CL003', ['반부패', '조달'], click='승인'),
        discover('review.html?id=2609CL002', ['서명본', '체결일'], click='올리'),
        discover('review.html?id=2609CL003', ['체결일', '서명본'], click='확인'),
        discover('review.html?id=2609CL004', ['개통'], click='확인'),
        discover('review.html?id=2609CL001', ['날짜 순서', '앞서'], click='확인'),
        discover('review.html?id=2512CL001-C01', ['재무', '⑩'], click='확인'),
        discover('review.html?id=2606CL001-C02', ['무상 충전 누적', '50건'], click='승인'),
        discover('review.html?id=2610CL003', ['재무 의견'], role='FINANCE', click='재무 의견'),
        discover('contract.html?id=2509CL001', ['만료', '서비스 닫기 전', '유예'], click='만료 처리'),
        discover('contract.html?id=2509CL001', ['유예'], click='유예 확인'),
        discover('contract.html?id=2509CL002', ['유예 중']),
        discover('contract.html?id=2508CL001', ['만료 처리']),
        discover('contract.html?id=2509CL003', ['만료']),
        discover('contract.html?id=2510CL001', ['연장']),
        discover('expiring.html', ['서비스 닫기 전', 'D+', '유예']),
        discover('ops-queue.html', ['만료 처리', '⑩']),
        discover('stats.html', ['기간 마감 점검', '통제 지표', '체결일']),
        discover('stats.html', ['기간 마감 점검'], role='FINANCE', click='확인'),
        discover('new-contract.html', ['견적서', '회계']),
        discover('ops-change.html', ['⑩', '재무']),
        discover('admin-rules.html', ['영업 임원', '위임전결', '알림']),
        discover('admin-users.html', ['유닛']),
        discover('templates.html', ['반부패']),
        discover('index.html', ['내 차례'], role='EXEC'),
        discover('review-queue.html', ['만료 유예', '영업 임원'], role='HEAD'),
        discover('contract-print.html?id=2610CL009', ['영업 임원']),
        discover('obligations.html', ['의무']),
        discover('help.html', ['만료 처리', '유예']),
    ]
    # 휴대폰 폭
    for u in ('review.html?id=2610CL009', 'contract.html?id=2509CL001', 'expiring.html', 'stats.html', 'admin-rules.html', 'ops-queue.html'):
        spec.append(discover(u, [], w=402))
elif mode == 'discover2':
    spec += [
        discover('review.html?id=2609CL002', ['서명본'], click='체결본 등록'),
        discover('review.html?id=2609CL004', ['개통'], click='운영 적용 완료'),
        discover('review.html?id=2610CL003', ['재무 의견'], role='FINANCE', click='의견 남기기'),
        discover('index.html', ['별가람', '영업 임원', '차례'], role='EXEC'),
        discover('ops-change.html?origin=2512CL001', ['⑩', '재무 확인'], role='SUPER'),
        discover('help.html?page=flow', ['만료 처리', '유예', '영업 임원']),
    ]
elif mode == 'act2':
    # 막혀야 하는 경우와 날짜가 있는 창
    neg = '(async () => {' + LIB + """
const b = btn('승인'); b.click(); await wait(400); const d = dlg();
const ok = [...d.querySelectorAll('.modal-actions button')].filter(vis).pop(); ok.click(); await wait(400);
const still = dlg();
return JSON.stringify({stillOpen: !!still, errs: still ? [...still.querySelectorAll('.field-error')].filter(vis).map(e => e.textContent.trim()) : []});
})()"""
    spec.append({"url": "review.html?id=2606CL001-C02&role=SUPER", "js": neg, "w": 1000, "h": 1300})
    future = '(async () => {' + LIB + """
window.W2DATE = '2026-12-31';
const r = await act('체결본 등록');
return JSON.stringify(r);
})()"""
    spec.append({"url": "review.html?id=2609CL002&role=SUPER", "js": future, "w": 1000, "h": 1300})
    spec += flow('review.html?id=2609CL002', ['체결본 등록'], ['영업지원', '⑧'])
    grace = '(async () => {' + LIB + """
window.W2DATE = '2026-11-20';
const r = await act('유예 요청');
return JSON.stringify(r);
})()"""
    spec.append({"url": "contract.html?id=2509CL002&role=SUPER", "js": grace, "w": 1000, "h": 1300})
    spec.append({"url": "contract.html?id=2509CL002&role=SUPER", "js": "(() => JSON.stringify({req: document.body.innerText.includes('2026-11-20'), buttons: [...document.querySelectorAll('main button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).slice(0, 8)}))()"})
    finop = """(async () => {
const t = document.getElementById('fin-op-text'); t.value = '시연: 첫해 무상 2개월은 이연 처리 필요'; t.dispatchEvent(new Event('input', {bubbles: true}));
document.getElementById('fin-op-save').click(); await new Promise(r => setTimeout(r, 600));
return JSON.stringify({shown: document.body.innerText.includes('첫해 무상 2개월은 이연'), err: [...document.querySelectorAll('.field-error')].filter(e => e.offsetParent).map(e => e.textContent)});
})()"""
    spec.append({"url": "review.html?id=2610CL003&role=FINANCE", "js": finop, "w": 1000, "h": 1300})
    spec.append({"url": "review.html?id=2610CL003&role=SUPER", "js": "(() => JSON.stringify({shown: document.body.innerText.includes('첫해 무상 2개월은 이연')}))()"})
else:
    spec += flow('review.html?id=2610CL009', ['승인'], ['④', '법무'], clear=True)
    spec += flow('contract.html?id=2509CL001', ['유예 확인'], ['유예 중'])
    spec += flow('contract.html?id=2509CL003', ['만료 처리'], ['만료 처리', '닫음'])
    spec += flow('review.html?id=2512CL001-C01', ['확인'], ['계약 완료'], role='FIN_LEAD')
    spec += flow('contract.html?id=2509CL002', ['유예'], ['유예'])
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
