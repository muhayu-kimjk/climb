"""CLIMB 프로토타입 미리보기 서버.

사용법 (Projects/climb 폴더에서):
    python serve.py
그다음 브라우저에서 http://localhost:8730 을 엽니다.

- prototype 폴더의 화면 파일을 내 PC 안에서만(127.0.0.1) 보여줍니다.
- 파일을 고친 뒤 새로고침하면 바로 반영되도록 브라우저 캐시를 끕니다.
- 실제 운영 서버가 아닙니다. 프로토타입 확인용입니다.
"""
import functools
import http.server
import pathlib

PORT = 8730
ROOT = pathlib.Path(__file__).resolve().parent / "prototype"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"CLIMB 프로토타입: http://localhost:{PORT}")
        httpd.serve_forever()
