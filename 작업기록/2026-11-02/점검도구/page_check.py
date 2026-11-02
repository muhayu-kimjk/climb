"""헤드리스 Chrome으로 화면을 열어 오류와 값을 확인 (사용자 브라우저를 건드리지 않음).
사용: python -I page_check.py <tools 폴더> <프로필 폴더> <검사 JSON 파일> [출력 폴더]
검사 JSON: [{"url": "templates.html", "js": "식", "shot": "이름(선택)", "dark": false, "w": 1000, "h": 1300}, ...]
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, sys.argv[1])
import device_shots as ds  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
PROFILE, SPEC = sys.argv[2], sys.argv[3]
OUT = sys.argv[4] if len(sys.argv) > 4 else None


def main():
    with open(SPEC, encoding='utf-8-sig') as f:
        checks = json.load(f)
    proc = subprocess.Popen([ds.CHROME, '--headless=new', f'--remote-debugging-port={ds.PORT}', f'--user-data-dir={PROFILE}',
                             '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(150):
            try:
                pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{ds.PORT}/json/list', timeout=1))
                page = [p for p in pages if p.get('type') == 'page'][0]
                break
            except Exception:
                time.sleep(0.2)
        cdp = ds.CDP(ds.ws_connect(page['webSocketDebuggerUrl']))
        cdp.call('Page.enable')
        cdp.call('Runtime.enable')
        for ck in checks:
            cdp.call('Emulation.setDeviceMetricsOverride', width=ck.get('w', 1000), height=ck.get('h', 1300), deviceScaleFactor=ck.get('dpr', 1), mobile=False)
            feats = [{'name': 'prefers-color-scheme', 'value': 'dark' if ck.get('dark') else 'light'}]
            for name in ('forced-colors', 'prefers-contrast', 'prefers-reduced-motion'):
                feats.append({'name': name, 'value': ck.get('features', {}).get(name, '')})
            cdp.call('Emulation.setEmulatedMedia', media=ck.get('media', 'screen'), features=feats)
            cdp.errors = []
            cdp.call('Page.navigate', url=ds.BASE + ck['url'])
            time.sleep(0.6)
            cdp.js("new Promise(r => { const t = () => document.readyState === 'complete' ? document.fonts.ready.then(() => setTimeout(r, 300)) : setTimeout(t, 100); t(); })")
            if ck.get('click'):  # 실제 마우스 누름(사용자 동작으로 쳐 줌: 선택 목록 펼치기 등)
                pt = cdp.js("(() => { const e = document.querySelector(%s); e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return [b.left + 30, b.top + b.height / 2]; })()" % json.dumps(ck['click']))
                for t in ('mousePressed', 'mouseReleased'):
                    cdp.call('Input.dispatchMouseEvent', type=t, x=pt[0], y=pt[1], button='left', clickCount=1)
                time.sleep(0.4)
            try:
                res = cdp.js(ck['js']) if ck.get('js') else ''
            except RuntimeError as e:  # 처리 뒤 화면이 다시 열리면(성공) 식이 끊김
                if 'navigated' not in str(e):
                    raise
                res = 'NAVIGATED (처리 뒤 화면이 다시 열림)'
                time.sleep(1.0)
            print('##', ck['url'], '| errors=', cdp.errors, '|', res)
            if OUT and ck.get('shot'):
                os.makedirs(OUT, exist_ok=True)
                opts = dict(format='png', captureBeyondViewport=bool(ck.get('full') or ck.get('sel')))
                if ck.get('sel'):  # 요소 하나만 찍기
                    r = cdp.js("(() => { const b = document.querySelector(%s).getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height]; })()" % json.dumps(ck['sel']))
                    opts['clip'] = dict(x=r[0], y=r[1], width=r[2], height=r[3], scale=1)
                shot = cdp.call('Page.captureScreenshot', **opts)
                with open(os.path.join(OUT, ck['shot'] + '.png'), 'wb') as f:
                    f.write(base64.b64decode(shot['data']))
    finally:
        proc.terminate()


if __name__ == '__main__':
    main()
