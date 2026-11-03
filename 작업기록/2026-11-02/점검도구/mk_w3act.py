"""셋째 묶음 화면의 창을 실제로 채워 처리해 봄(mk_w2flow.py의 LIB를 그대로 씀). 사용: python -I mk_w3act.py <출력 JSON>"""
import json
import os
import re
import sys

here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'mk_w2flow.py'), encoding='utf-8').read()
LIB = re.search(r'LIB = r"""(.*?)"""', src, re.S).group(1)


def act(url, role, label, date=None, pre=''):
    sep = '&' if '?' in url else '?'
    js = '(async () => {' + LIB + (("window.W2DATE = '%s';" % date) if date else '') + pre + """
const r = await act(%s);
return JSON.stringify(r);
})()""" % json.dumps(label, ensure_ascii=False)
    return {"url": url + sep + 'role=' + role, "js": js, "w": 1000, "h": 1300}


def after(url, role, texts):
    sep = '&' if '?' in url else '?'
    return {"url": url + sep + 'role=' + role, "js": "(() => { const t = document.body.innerText; return JSON.stringify(Object.fromEntries(%s.map(x => [x, t.includes(x)]))); })()" % json.dumps(texts, ensure_ascii=False)}


spec = [{"url": "index.html?role=SUPER", "js": "(() => { Object.keys(localStorage).filter(k => k.startsWith('climb.')).forEach(k => localStorage.removeItem(k)); return 'cleared'; })()"}]
spec += [
    act('remediation.html', 'COMPLIANCE', '보류 걸기'), after('remediation.html', 'COMPLIANCE', ['시연 확인']),
    act('remediation.html', 'COMPLIANCE', '개선 과제 기록', date='2026-12-31'), after('remediation.html', 'COMPLIANCE', ['시연 확인']),
    act('discount-review.html', 'FIN_EXEC', '확인 남기기'), after('discount-review.html', 'FIN_EXEC', ['시연 확인']),
    act('opp-recon.html', 'SALES_ADMIN', '예시 파일로 해 보기'), after('opp-recon.html', 'SALES_ADMIN', ['계약이 없는 수주']),
    act('seal-recon.html', 'GA', '다시 대조 남기기'), after('seal-recon.html', 'GA', ['시연 확인']),
    act('config-review.html', 'FIN_LEAD', '확인 남기기'), after('config-review.html', 'FIN_LEAD', ['시연 확인']),
    act('company-settings.html', 'SUPER', '회사 정보 바꾸기'), after('company-settings.html', 'SUPER', ['시연 확인']),
    act('contract.html?id=2609CL010', 'HEAD', '영업대표 바꾸기'), after('contract.html?id=2609CL010', 'HEAD', ['영업대표 바뀜', '시연 확인']),
    act('contract.html?id=2610CL009', 'HEAD', '결재 기록 묶음'),
    act('admin-customers.html', 'COMPLIANCE', '확인 남기기', date='2027-11-03'), after('admin-customers.html', 'COMPLIANCE', ['문제 없음', '문제 있음']),
    act('admin-logs.html', 'PRIVACY', '유닛 리더에게 계정 목록 보내기'),
    act('admin-users.html', 'SUPER', '수정'),
    act('stats.html', 'AUDIT', 'CSV 내려받기', pre="window.__dl = 0; const _c = URL.createObjectURL; URL.createObjectURL = b => { window.__dl++; return _c(b); };"),
]
json.dump(spec, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(spec))
