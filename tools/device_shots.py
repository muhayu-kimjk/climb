"""기준 기기(아이폰 18 Pro, 아이패드 프로 11인치) 크기와 터치 화면으로 CLIMB 시안을 찍는 스크립트.

헤드리스 Chrome을 DevTools 프로토콜(CDP)로 움직여, 화면 폭뿐 아니라 '터치 화면'(pointer: coarse, hover: none)도
흉내 냅니다. v0.50부터 스마트폰만 휴대폰 규칙(가로로 눕혀도), 태블릿은 PC 화면입니다.
표준 라이브러리만 씁니다(웹소켓도 직접 구현).

사용: python -I device_shots.py <출력 폴더> <임시 프로필 폴더> [기기 이름들...]
  먼저 serve.py로 미리보기 서버(localhost:8730)를 켜 둡니다. 기기 이름: iphone18pro, iphone18pro-land, ipadpro11, ipadpro11-land
  기준 기기는 요구사항 정의서 REQ-ENV-07(v0.48 기획자 결정)
"""
import base64
import json
import os
import socket
import struct
import subprocess
import sys
import time
import urllib.request

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9339
BASE = "http://localhost:8730/"

# CSS 픽셀 기준. 아이폰 18 Pro: 2622 x 1206 px, 3배 → 402 x 874 / 아이패드 프로 11인치(M5): 2420 x 1668 px, 2배 → 834 x 1210
DEVICES = {
    "iphone18pro": dict(w=402, h=874, label="아이폰 18 Pro (402 x 874)"),
    "iphone18pro-land": dict(w=874, h=402, label="아이폰 18 Pro 가로 (874 x 402)"),
    "ipadpro11": dict(w=834, h=1210, label="아이패드 프로 11인치 세로 (834 x 1210)"),
    "ipadpro11-land": dict(w=1210, h=834, label="아이패드 프로 11인치 가로 (1210 x 834)"),
}
PAGES = [
    ("index.html", "개요"),
    ("new-contract.html", "계약 등록"),
    ("contracts.html", "전체 계약"),
    ("notices.html", "공지사항"),
]


def recv_exact(s, n):
    buf = b""
    while len(buf) < n:
        chunk = s.recv(n - len(buf))
        if not chunk:
            raise EOFError("socket closed")
        buf += chunk
    return buf


def ws_connect(url):
    rest = url[len("ws://"):]
    host_port, path = rest.split("/", 1)
    host, port = host_port.split(":")
    s = socket.create_connection((host, int(port)))
    key = base64.b64encode(os.urandom(16)).decode()
    req = (f"GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
           f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
    s.sendall(req.encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        resp += s.recv(1)
    if b" 101 " not in resp.split(b"\r\n", 1)[0]:
        raise RuntimeError(resp.decode(errors="replace"))
    return s


def ws_send(s, text):
    data = text.encode()
    header = bytearray([0x81])
    n = len(data)
    if n < 126:
        header.append(0x80 | n)
    elif n < 65536:
        header.append(0x80 | 126)
        header += struct.pack(">H", n)
    else:
        header.append(0x80 | 127)
        header += struct.pack(">Q", n)
    mask = os.urandom(4)
    header += mask
    s.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def ws_recv(s):
    msg = b""
    while True:
        b1, b2 = recv_exact(s, 2)
        op = b1 & 0x0F
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", recv_exact(s, 2))[0]
        elif n == 127:
            n = struct.unpack(">Q", recv_exact(s, 8))[0]
        if b2 & 0x80:
            recv_exact(s, 4)
        payload = recv_exact(s, n)
        if op == 8:
            raise EOFError("closed")
        if op in (9, 10):
            continue
        msg += payload
        if b1 & 0x80:
            return msg.decode()


class CDP:
    def __init__(self, s):
        self.s, self.n, self.errors = s, 0, []

    def call(self, method, **params):
        self.n += 1
        mid = self.n
        ws_send(self.s, json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            m = json.loads(ws_recv(self.s))
            if m.get("method") == "Runtime.exceptionThrown":
                d = m["params"]["exceptionDetails"]
                self.errors.append((d.get("exception") or {}).get("description") or d.get("text"))
            if m.get("id") == mid:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})

    def js(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        return (r.get("result") or {}).get("value")


def main():
    out, profile = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(DEVICES)
    os.makedirs(out, exist_ok=True)
    proc = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
                             "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=1))
                page = [p for p in pages if p.get("type") == "page"][0]
                break
            except Exception:
                time.sleep(0.2)
        cdp = CDP(ws_connect(page["webSocketDebuggerUrl"]))
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        report = []
        for name in names:
            d = DEVICES[name]
            cdp.call("Emulation.setDeviceMetricsOverride", width=d["w"], height=d["h"], deviceScaleFactor=2, mobile=True,
                     screenWidth=d["w"], screenHeight=d["h"])
            cdp.call("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
            try:
                cdp.call("Emulation.setEmulatedMedia", media="screen", features=[
                    {"name": "pointer", "value": "coarse"}, {"name": "hover", "value": "none"},
                    {"name": "any-pointer", "value": "coarse"}, {"name": "any-hover", "value": "none"}])
            except RuntimeError as e:
                report.append(f"media override not supported: {e}")
            for path, title in PAGES:
                cdp.errors = []
                cdp.call("Page.navigate", url=BASE + path)
                time.sleep(0.6)
                cdp.js("new Promise(r => { const t = () => document.readyState === 'complete' ? document.fonts.ready.then(() => setTimeout(r, 400)) : setTimeout(t, 100); t(); })")
                info = cdp.js("JSON.stringify({w: innerWidth, h: innerHeight, touch: !!(window.CLIMB && CLIMB.isPhoneLayout()), "
                              "coarse: matchMedia('(pointer: coarse)').matches, docW: document.documentElement.scrollWidth})")
                shot = cdp.call("Page.captureScreenshot", format="png")
                fn = os.path.join(out, f"{name}_{path.split('.')[0]}.png")
                with open(fn, "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                report.append(f"{name} {path} {info} errors={cdp.errors}")
        print("\n".join(report))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
