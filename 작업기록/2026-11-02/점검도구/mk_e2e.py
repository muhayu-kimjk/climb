"""견적부터 계약 완료까지 끝까지 해 보는 검사 JSON(한 Chrome 실행 안에서 이어감).
사용: python -I mk_e2e.py <출력 JSON> <pc|phone> [steps]
  1) 시연 상태를 지움  2) 영업(SALES)이 견적을 만들고 저장, 견적서 출력  3) 같은 영업기회번호로 계약을 기안
  4) 그다음은 매번 그 계약의 지금 차례를 찾아 그 담당 역할로 결재 문서를 열고 처리(최대 steps번)  5) 끝난 상태를 읽음"""
import json
import os
import re
import sys

here = os.path.dirname(os.path.abspath(__file__))
LIB = re.search(r'LIB = r"""(.*?)"""', open(os.path.join(here, 'mk_w2flow.py'), encoding='utf-8').read(), re.S).group(1)
mode = sys.argv[2]
steps = int(sys.argv[3]) if len(sys.argv) > 3 else 14
W, H = (1000, 1300) if mode == 'pc' else (402, 874)
NAME = '시험대학교' if mode == 'pc' else '시험고등학교'
BIZ = '2148231205' if mode == 'pc' else '3058217402'
OPP = '2610CK901' if mode == 'pc' else '2610CK902'

SET = r"""
const set = (el, v) => { if (!el) return false; el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); return true; };
const pick = el => { if (!el) return ''; const o = [...el.options].find(o => o.value); if (o) set(el, o.value); return o ? o.text : ''; };
const radio = (name, v) => { const r = document.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.click(); return !!r; };
const errs = () => [...document.querySelectorAll('.field-error, .form-error, [role=alert]')].filter(e => e.offsetParent && e.textContent.trim()).map(e => e.textContent.trim()).slice(0, 12);
const file = (el, name, type) => { if (!el) return false; const dt = new DataTransfer(); dt.items.add(new File(['e2e'], name, {type: type || 'application/pdf'})); el.files = dt.files; el.dispatchEvent(new Event('change', {bubbles: true})); return true; };
"""

quote_js = '(async () => { try {' + LIB + SET + """
set(document.getElementById('q-name'), %(name)s); set(document.getElementById('q-bizno'), %(biz)s); set(document.getElementById('q-unit'), '교무처'); set(document.getElementById('q-opp'), %(opp)s);
const sels = [...document.querySelectorAll('main select')].filter(vis);
set(sels[0], 'CK'); await wait(150);
const s2 = [...document.querySelectorAll('main select')].filter(vis); const prod = pick(s2[1]); await wait(150);
const s3 = [...document.querySelectorAll('main select')].filter(vis); const feat = pick(s3[2]); await wait(150);
const row = s3[0].closest('tr, li, .q-line, .line, div');
const ins = [...row.parentElement.querySelectorAll('input[type=text], input:not([type])')].filter(vis);
const info = ins.map(i => (i.getAttribute('aria-label') || i.placeholder || i.id || '') + '=' + i.value);
for (const i of ins) { const l = (i.getAttribute('aria-label') || '') + (i.placeholder || ''); if (/수량/.test(l)) set(i, '1'); else if (/할인/.test(l)) set(i, '20'); else if (!i.value) set(i, '20'); }
await wait(150);
setTimeout(() => document.getElementById('q-save').click(), 0); const r = 'saved';
return JSON.stringify({prod, feat, info, act: r, errs: errs(), url: location.href});
} catch (e) { return 'ERR ' + e.message; } })()""" % {'name': json.dumps(NAME, ensure_ascii=False), 'biz': json.dumps(BIZ), 'opp': json.dumps(OPP)}

contract_js = '(async () => { try {' + LIB + SET + """
radio('kind', 'NEW'); await wait(80);
const cq = document.getElementById('f-customer-q'); cq.focus(); set(cq, %(name)s); await wait(300); const direct = [...document.querySelectorAll('main button')].find(x => vis(x) && x.textContent.trim() === '직접 입력하기'); if (direct) { direct.click(); await wait(200); } set(document.querySelector('[name=counterparty]'), %(name)s); set(document.querySelector('[name=bizNo]'), %(biz)s); set(document.querySelector('[name=unit]'), '교무처');
set(document.querySelector('[name=opportunity]'), %(opp)s);
radio('method', 'DIRECT'); set(document.querySelector('[name=startDate]'), '2026-11-01'); set(document.querySelector('[name=endDate]'), '2027-10-31');
radio('autoRenew', 'NO'); radio('personalData', 'YES'); radio('sla', 'NO');
set(document.getElementById('p-svc-1'), 'CK'); await wait(150); const prod = pick(document.getElementById('p-prod-1')); await wait(150); const feat = pick(document.getElementById('p-feat-1')); await wait(150);
set(document.getElementById('p-qty-1'), '1'); await wait(150);
const infoEl = [...document.querySelectorAll('main *')].find(e => e.children.length === 0 && /^표준 단가 [0-9]/.test(e.textContent.trim()));
const m = infoEl && infoEl.textContent.replace(/,/g, '').match(/=\\s*([0-9]+)(만)?/); const std = m ? +m[1] * (m[2] ? 10000 : 1) : 0;
set(document.getElementById('p-amt-1'), String(Math.round(std * 0.7) || 1000000)); await wait(150);
radio('settlement', 'LUMP'); radio('standard', 'NO'); await wait(150); set(document.querySelector('[name=template]'), 'TPL-CK'); await wait(150);
radio('accounting', 'NO'); await wait(100);
file(document.getElementById('f-draft'), '시험 계약서 초안.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
file(document.getElementById('f-quote'), '최종 견적서 ' + %(opp)s + '.pdf');
for (const f of [...document.querySelectorAll('main input[type=file]')].filter(vis)) { if (!f.files.length) { const lab = (f.closest('.field') || {}).textContent || ''; if (/필수/.test(lab)) file(f, '시험 첨부.pdf'); } }
for (const t of [...document.querySelectorAll('main textarea')].filter(vis)) if (!t.value) set(t, '끝까지 해 보는 시험(' + %(mode)s + ')');
for (const i of [...document.querySelectorAll('main input[type=text]')].filter(vis)) { const lab = ((i.closest('.field') || {}).textContent || ''); if (!i.value && /필수/.test(lab) && !/사용 업체/.test(lab) && i.id !== 'f-customer-q') set(i, '시험 입력'); }
for (const g of new Set([...document.querySelectorAll('main input[type=radio]')].filter(vis).map(r => r.name))) { if (!document.querySelector('input[name="' + g + '"]:checked')) { const first = document.querySelector('input[name="' + g + '"]'); if (first) first.click(); } }
await wait(200);
const before = errs();
const r = await act('기안하기');
return JSON.stringify({prod, feat, std, info: infoEl && infoEl.textContent, before, act: r, errs: errs(), url: location.href});
} catch (e) { return 'ERR ' + e.message; } })()""" % {'name': json.dumps(NAME, ensure_ascii=False), 'biz': json.dumps(BIZ), 'opp': json.dumps(OPP), 'mode': json.dumps(mode)}

FIND = """(() => { const D = window.CLIMB_DATA, C = window.CLIMB; if (!D || !C) return 'index.html?role=SUPER&e2e=noapi';
const c = (D.CONTRACTS || []).filter(x => x.counterparty === %s).sort((a, b) => (a.id < b.id ? 1 : -1))[0];
if (!c) return 'my-contracts.html?role=SALES&e2e=nocontract';
const p = C.pendingSteps(c)[0];
if (!p) return 'contract.html?id=' + c.id + '&role=SUPER&e2e=done-' + c.status;
const roles = Object.keys(D.DEMO_PERSONA).filter(r => D.DEMO_PERSONA[r] === p.userId && r !== 'SUPER');
return 'review.html?id=' + c.id + '&role=' + (roles[0] || 'SUPER') + '&e2e=' + p.step + '-' + (p.userId || ''); })()""" % json.dumps(NAME, ensure_ascii=False)

STEP_JS = '(async () => { try {' + LIB + SET + """
if (/e2e=done|e2e=no/.test(location.href)) return 'SKIP ' + location.search;
window.W2DATE = '2026-10-19';
const labels = ['승인', '확인 완료', '체결본 등록', '날인 완료', '운영 적용 완료', '재무 확인 완료', '완료'];
const btns = [...document.querySelectorAll('main button')].filter(b => vis(b) && !b.disabled).map(b => b.textContent.replace(/\\s+/g, ' ').trim());
const label = labels.find(l => btns.some(b => b === l || b.indexOf(l) === 0));
if (!label) return JSON.stringify({noButton: true, buttons: btns.slice(0, 15), h1: (document.querySelector('h1') || {}).textContent});
const b = btn(label); b.click(); await wait(400);
const d = dlg(); if (!d) return JSON.stringify({label, result: 'NO DIALOG'});
const title = (d.querySelector('h2') || {}).textContent;
const sample = [...d.querySelectorAll('button')].find(x => /예시 파일/.test(x.textContent)); if (sample) { sample.click(); await wait(150); }
await fill(d);
const ok = [...d.querySelectorAll('.modal-actions button, button[type=submit]')].filter(vis).pop();
setTimeout(() => ok.click(), 0);
const over = document.documentElement.scrollWidth - innerWidth; const dOver = Math.round(d.scrollWidth - d.clientWidth); return JSON.stringify({label, title, submit: ok.textContent.trim(), over, dialogOver: dOver, okH: Math.round(ok.getBoundingClientRect().height)});
} catch (e) { return 'ERR ' + e.message; } })()"""

spec = [{"url": "index.html?role=SUPER", "js": "(() => { Object.keys(localStorage).filter(k => k.startsWith('climb.')).forEach(k => localStorage.removeItem(k)); return 'cleared'; })()"},
        {"url": "quote.html?role=SALES", "js": quote_js, "w": W, "h": H},
        {"url": "quote.html?role=SALES", "urlFrom": "location.pathname.split('/').pop() + location.search", "js": "(async () => { const b = [...document.querySelectorAll('main button, main a.btn')].find(x => x.offsetParent && x.textContent.trim() === '견적서 출력'); if (!b) return 'NO PRINT BUTTON ' + location.search; window.print = () => {}; b.click(); await new Promise(r => setTimeout(r, 400)); const d = [...document.querySelectorAll('[role=dialog]')].find(x => x.offsetParent && !x.classList.contains('drawer-panel')); if (d) { const ok = [...d.querySelectorAll('.modal-actions button')].pop(); ok.click(); await new Promise(r => setTimeout(r, 400)); } return 'printed ' + location.search + ' ' + (document.querySelector('h1') || {}).textContent; })()", "w": W, "h": H},
        {"url": "quotes.html?role=SALES", "js": "(() => JSON.stringify([...document.querySelectorAll('main tbody tr')].slice(0, 3).map(tr => tr.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80))))()", "w": W, "h": H},
        {"url": "new-contract.html?role=SALES", "js": contract_js, "w": W, "h": H, "shot": mode + "_02_contract"}]
for i in range(steps):
    spec.append({"url": "index.html?role=SUPER", "urlFrom": FIND, "js": STEP_JS, "w": W, "h": H})  # 처리하면 화면이 다시 열려 그때 사진을 찍으면 멈춤
spec.append({"url": "index.html?role=SUPER", "urlFrom": FIND, "w": W, "h": H, "shot": mode + "_99_done",
             "js": "(() => { const D = window.CLIMB_DATA, C = window.CLIMB; const c = (D.CONTRACTS || []).filter(x => x.counterparty === %s).sort((a, b) => (a.id < b.id ? 1 : -1))[0]; return JSON.stringify(c ? {id: c.id, status: c.status, label: (D.STATUS[c.status] || {}).label, history: (c.history || []).map(h => h.step + ':' + h.action + ':' + h.by).slice(-20)} : null); })()" % json.dumps(NAME, ensure_ascii=False)})
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
