"""셋째 묶음(2026-11-02 C, E 결정과 2026-11-03 답) 화면을 역할마다 열어 버튼, 글자, 넘침, 메뉴 줄을 봄.
사용: python -I mk_w3disc.py <출력 JSON>"""
import json
import sys

JS = r"""(async () => {
const vis = e => e && e.offsetParent !== null;
const txt = document.body.innerText;
const gl = document.querySelector('.gnb-list');
const tops = gl ? [...gl.children].filter(vis).map(li => li.querySelector('.gnb-link') ? li.querySelector('.gnb-link').textContent.trim() : '') : [];
const out = {h1: (document.querySelector('h1') || {}).textContent, over: document.documentElement.scrollWidth - innerWidth,
  menu: tops.join('|'), gnbOver: gl ? gl.scrollWidth - gl.clientWidth : null,
  denied: /볼 수 없|권한이 없/.test((document.querySelector('main') || document.body).innerText.slice(0, 400)),
  has: {}};
for (const t of %s) out.has[t] = txt.includes(t);
out.buttons = [...document.querySelectorAll('main button, main a.btn')].filter(b => vis(b) && !b.disabled).map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 18);
return JSON.stringify(out);
})()"""


def d(url, role, texts=(), w=1000):
    sep = '&' if '?' in url else '?'
    return {"url": url + sep + 'role=' + role, "js": JS % json.dumps(list(texts), ensure_ascii=False), "w": w, "h": 1300}


spec = []
NEW = ['discount-review.html', 'opp-recon.html', 'seal-recon.html', 'remediation.html', 'config-review.html', 'company-settings.html']
for p in NEW:
    for r in ('SUPER', 'AUDIT'):
        spec.append(d(p, r))
spec += [
    d('discount-review.html', 'FIN_EXEC', ['한계값', '점검 마침']),
    d('opp-recon.html', 'SALES_ADMIN', ['수주', '예시 파일']),
    d('seal-recon.html', 'GA', ['인장']),
    d('remediation.html', 'COMPLIANCE', ['보류', '개선 과제']),
    d('config-review.html', 'FIN_LEAD', ['품의']),
    d('config-review.html', 'LEGAL', ['표준계약서']),
    d('company-settings.html', 'GA', ['인장']),
    d('admin-customers.html', 'COMPLIANCE', ['확인', '위험 등급']),
    d('admin-logs.html', 'SUPER', ['최고관리자 작업', '역할 충돌', '설정 변경']),
    d('admin-logs.html', 'PRIVACY', ['최고관리자 작업']),
    d('admin-logs.html', 'AUDIT', []),
    d('admin-users.html', 'SUPER', ['감사 열람', '역할 겹침']),
    d('stats.html', 'AUDIT', ['통제 지표', '통제 증빙 내보내기']),
    d('stats.html', 'HEAD', ['통제 지표']),
    d('stats.html', 'SALES', ['통제 지표']),
    d('contract.html?id=2610CL009', 'HEAD', ['담당 영업', '결재 기록 묶음']),
    d('contract.html?id=2610CL009', 'AUDIT', []),
    d('review.html?id=2610CL009', 'AUDIT', []),
    d('review.html?id=2610CL009', 'OBSERVER', []),
    d('quote.html?no=QT2610-001&ver=2', 'SUPER', ['견적서 출력']),
    d('new-contract.html', 'SALES', ['영업기회번호']),
    d('index.html', 'FIN_EXEC', ['점검할 일', '할인 예외']),
    d('index.html', 'COMPLIANCE', ['점검할 일']),
    d('index.html', 'GA', ['점검할 일', '인장']),
    d('index.html', 'AUDIT', []),
    d('notices.html', 'SUPER', ['바뀐 점']),
    d('account.html', 'SUPER', ['보류', '바뀐 점']),
    d('help.html', 'SUPER', ['점검', '감사 열람', '컴플라이언스']),
]
# 메뉴 줄: 역할마다 1000px(큰 글자), 노트북(1.25배), 큰 창
for r in ('SUPER', 'FIN_EXEC', 'COMPLIANCE', 'AUDIT', 'SALES', 'GA'):
    spec.append(d('index.html', r, [], w=1000))
spec.append({**d('index.html', 'SUPER', [], w=1100), "dpr": 1.25})
spec.append(d('index.html', 'SUPER', [], w=1478))
spec.append(d('index.html', 'SUPER', [], w=402))
spec.append(d('discount-review.html', 'SUPER', [], w=402))
spec.append(d('remediation.html', 'SUPER', [], w=402))
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
