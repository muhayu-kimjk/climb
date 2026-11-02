#!/usr/bin/env bash
# 스냅숏 하나에 검사 JSON 하나를 돌림. 사용: bash run_snap_one.sh <스냅숏 이름> <검사 JSON> <결과 파일>
S="C:/Users/kimjk/AppData/Local/Temp/claude/C--Users-kimjk-Documents-Claude/a0b99212-4c47-453d-90e5-91e3085fa12a/scratchpad"
python -I -m http.server 8731 --bind 127.0.0.1 --directory "$S/$1/prototype" > /dev/null 2>&1 &
SRV=$!
sleep 2
python -I "$S/page_check.py" "$S/tools_snap" "$S/chrome-snap" "$S/$2" > "$S/$3" 2>&1
kill $SRV
cat "$S/$3"
