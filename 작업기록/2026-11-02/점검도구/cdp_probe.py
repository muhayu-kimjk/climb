"""멈춘 헤드리스 Chrome 화면을 들여다봄: 브라우저 알림 창이 떠 있으면 내용을 보이고 닫음, 화면 글자 일부를 보임.
사용: python -I cdp_probe.py <tools 폴더> <port>"""
import json
import sys
import urllib.request

sys.path.insert(0, sys.argv[1])
import device_shots as ds  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
port = int(sys.argv[2])
pages = [p for p in json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=3)) if p.get('type') == 'page']
cdp = ds.CDP(ds.ws_connect(pages[0]['webSocketDebuggerUrl']))
try:
    print('dialog:', cdp.call('Page.handleJavaScriptDialog', accept=True))
except Exception as e:
    print('no dialog:', str(e)[:200])
try:
    r = cdp.call('Runtime.evaluate', expression="JSON.stringify({url: location.href, modal: [...document.querySelectorAll('[role=dialog]')].filter(d => d.offsetParent).map(d => d.innerText.slice(0, 300))})", returnByValue=True)
    print(r.get('result', {}).get('value'))
except Exception as e:
    print('eval error:', str(e)[:200])
