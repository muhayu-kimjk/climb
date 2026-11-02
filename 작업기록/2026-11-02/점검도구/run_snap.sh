#!/usr/bin/env bash
# 스냅숏(그 시점의 시안 복사본)을 8731 포트로 띄워 전체 점검을 한 번에 하나씩 돌림.
# 작업 중인 시안(8730)과 따로라, 다른 작업이 파일을 고치는 동안에도 점검할 수 있음.
# 사용: bash run_snap.sh <스냅숏 이름> <결과 꼬리표>
S="C:/Users/kimjk/AppData/Local/Temp/claude/C--Users-kimjk-Documents-Claude/a0b99212-4c47-453d-90e5-91e3085fa12a/scratchpad"
SNAP="$S/$1/prototype"
TAG="$2"
T="$S/tools_snap"
mkdir -p "$T"
sed -e 's#^PORT = 9339#PORT = 9340#' -e 's#^BASE = "http://localhost:8730/"#BASE = "http://localhost:8731/"#' \
  "C:/Users/kimjk/Documents/Claude/Projects/climb/tools/device_shots.py" > "$T/device_shots.py"
python -I -m http.server 8731 --bind 127.0.0.1 --directory "$SNAP" > "$S/server_$TAG.log" 2>&1 &
SRV=$!
sleep 2
PROF="$S/chrome-snap"
for k in sweep qa2 gray; do
  python -I "$S/page_check.py" "$T" "$PROF" "$S/check_$k.json" > "$S/${k}_$TAG.txt" 2>&1
done
kill $SRV
python -I "$S/cmp_checks.py" "$S" "$TAG"
