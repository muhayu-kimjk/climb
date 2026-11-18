// 모든 AC-*.js를 차례로 돌리고 표로 보임 (2026-11-13 주말 점검 W2)
//   사용: node tools/control_tests/run.js [AC-01 AC-02 ...]
//   각 시험 파일은 module.exports = { ac: 'AC-01', title: '...', tests: [{ name, kind: 'ok'|'deny', run(h) → true | 문자열(실패 까닭) }],
//     serverOnly: ['시안이 막지 않고 서버가 막는 것(시험하지 않음) ...'] } 꼴
'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./harness');
const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => /^AC-\d+\.js$/.test(f) && (!only.length || only.indexOf(f.replace('.js', '')) > -1)).sort();
let pass = 0, fail = 0, server = 0;
const rows = [];
for (const f of files) {
  const m = require(path.join(__dirname, f));
  for (const t of m.tests) {
    let r;
    try { r = t.run(h); } catch (e) { r = '오류: ' + (e && e.message); }
    const ok = r === true;
    if (ok) pass++; else fail++;
    rows.push((ok ? 'OK   ' : 'FAIL ') + m.ac + ' [' + (t.kind === 'deny' ? '안 되는 경우' : '되는 경우') + '] ' + t.name + (ok ? '' : ' → ' + r));
  }
  (m.serverOnly || []).forEach(s => { server++; rows.push('SRV  ' + m.ac + ' ' + s); });
}
rows.forEach(r => console.log(r));
console.log(`시험 ${pass + fail}개: 통과 ${pass}, 실패 ${fail}, 서버 몫(시안은 시험 안 함) ${server}`);
process.exitCode = fail ? 1 : 0;
