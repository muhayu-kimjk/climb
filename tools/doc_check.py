"""기획 문서(docs/*.md)와 시안 코드가 서로 맞는지 보는 점검 스크립트.

문서를 고친 뒤 돌려 봅니다. 문제가 없으면 마지막 줄이 "문제 0"입니다.
  1. 표 줄의 칸 수: 표 안의 줄마다 | 개수가 머리글과 같은지(글 안의 | 는 \\| 로 써야 칸이 나뉘지 않음)
  2. 제어 문자: 눈에 보이지 않는 글자가 섞였는지(복사나 스크립트로 고칠 때 생김)
  3. 번호 참조: 문서와 코드가 가리키는 번호가 실제로 정의돼 있는지
     REQ-, C-(01 요구사항 정의서), SCR-(02 화면 목록), CODE-(03 데이터 정의서),
     G-(05 표준 대응표), CTL-, AC-, R-(06 통제 목록), "05 4장 N번"
  4. 화면과 파일: 02 화면 목록의 SCR마다 적힌 HTML 파일이 있는지, 시안의 HTML이 모두 02에 있는지
표준 라이브러리만 씁니다.

사용: python -I doc_check.py <climb 폴더>
"""
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
ROOT = sys.argv[1]
DOCS = os.path.join(ROOT, 'docs')
PROTO = os.path.join(ROOT, 'prototype')
# 일부러 뺀 번호: G-01은 견적서(REQ-QUO)로 해결되어 뺐음(05 3장 처음)
RETIRED = {'G-01'}
# 따로 화면이 없는 SCR: SCR-32는 결재 문서(SCR-23)에서 처리(v0.23)
NO_FILE_SCR = {'SCR-32'}

problems = []


def read(p):
    return open(p, encoding='utf-8', newline='').read()


def doc(name):
    return read(os.path.join(DOCS, name))


# 1, 2. 표 줄의 칸 수와 제어 문자
for name in sorted(os.listdir(DOCS)):
    if not name.endswith('.md'):
        continue
    head = None
    for i, line in enumerate(doc(name).split('\n'), 1):
        s = line.rstrip('\r')
        if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', s):
            problems.append(f'제어 문자: {name} {i}줄')
        if s.startswith('|'):
            n = len(re.findall(r'(?<!\\)\|', s))
            if head is None:
                head = n
            elif n != head:
                problems.append(f'표 칸 수: {name} {i}줄 ({n - 1}칸, 머리글은 {head - 1}칸) {s[:40]}')
        else:
            head = None

# 3. 번호 참조
d01, d02, d03 = doc('01_요구사항정의서.md'), doc('02_화면목록.md'), doc('03_데이터정의서.md')
d05, d06 = doc('05_표준대응표.md'), doc('06_통제목록.md')
code_heads = '\n'.join(l for l in d03.split('\n') if l.startswith('#'))
defined = {
    'REQ': set(re.findall(r'^\| (REQ-[A-Z]+-\d+) \|', d01, re.M)),
    'C': set(re.findall(r'^\| (C-\d+) \|', d01, re.M)),
    'SCR': set(re.findall(r'^\| (SCR-\d+) \|', d02, re.M)),
    'CODE': set(re.findall(r'(CODE-[A-Z][A-Z-]*[A-Z])', code_heads)),
    'G': set(re.findall(r'(?:^\| |^#+ )(G-\d+)\b', d05, re.M)) | RETIRED,
    'CTL': set(re.findall(r'^\| (?:★ )?(CTL-\d+) \|', d06, re.M)),
    'AC': set(re.findall(r'^\| (AC-\d+) \|', d06, re.M)),
    'R': set(re.findall(r'^\| (R-\d+) \|', d06, re.M)),
}
cited = {
    'REQ': re.compile(r'\bREQ-[A-Z]+-\d+\b'),
    'C': re.compile(r'(?<![A-Za-z0-9-])C-\d{2}\b'),
    'SCR': re.compile(r'\bSCR-\d+\b'),
    'CODE': re.compile(r'\bCODE-[A-Z][A-Z-]*[A-Z](?![A-Z-])'),
    'G': re.compile(r'(?<![A-Za-z0-9-])G-\d{2}\b'),
    'CTL': re.compile(r'\bCTL-\d+\b'),
    'AC': re.compile(r'(?<![A-Za-z0-9-])AC-\d{2}\b'),
    'R': re.compile(r'(?<![A-Za-z0-9-])R-\d{2}\b'),
}
# 05 4장(기획자가 정할 것)의 번호: "1. ..." 목록이나 "| 1 |" 표 줄
m = re.search(r'^## 4[.\s].*?$(.*?)(?=^## \d)', d05, re.M | re.S)
ch4_text = m.group(1) if m else ''
ch4 = set(int(x) for x in re.findall(r'^(\d+)\. ', ch4_text, re.M))
ch4 |= set(int(x) for x in re.findall(r'^\| (\d+) \|', ch4_text, re.M))
missing = defaultdict(set)
for base, dirs, names in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d != '.git']
    for n in names:
        if not n.endswith(('.md', '.js', '.html', '.css')):
            continue
        p = os.path.join(base, n)
        t = read(p)
        rel = os.path.relpath(p, ROOT)
        for k, rx in cited.items():
            for x in rx.findall(t):
                if x not in defined[k]:
                    missing[x].add(rel)
        for x in re.findall(r'05 4장 (\d+)번', t):
            if int(x) not in ch4:
                missing[f'05 4장 {x}번'].add(rel)
for x, where in sorted(missing.items()):
    problems.append(f'없는 번호: {x} ← {", ".join(sorted(where))}')

# 4. 화면과 파일
listed = defaultdict(set)
for scr, rest in re.findall(r'^\| (SCR-\d+) \|(.*)$', d02, re.M):
    files = re.findall(r'`([\w-]+\.html)', rest)
    if not files and scr not in NO_FILE_SCR:
        problems.append(f'화면 파일 없음: 02의 {scr}에 HTML 파일 이름이 없음')
    for f in files:
        listed[f].add(scr)
        if not os.path.exists(os.path.join(PROTO, f)):
            problems.append(f'화면 파일 없음: 02의 {scr}가 적은 {f}가 시안에 없음')
for n in sorted(os.listdir(PROTO)):
    if n.endswith('.html') and n not in listed:
        problems.append(f'02에 없는 화면: {n}')

print('정의된 번호:', ', '.join(f'{k} {len(v)}' for k, v in defined.items()), f', 05 4장 {len(ch4)}')
for p in problems:
    print(p)
print('문제', len(problems))
