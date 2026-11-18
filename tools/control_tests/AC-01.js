// AC-01 총액은 줄 금액의 합 (06 통제 목록 2장, CTL-08) (2026-11-13 주말 점검 W2)
//   기대 동작: 총액은 제품 줄 금액의 합으로 시스템이 정하고 영업은 적지 않음. 서버는 화면이 보낸 총액을 쓰지 않고 다시 계산
//   시안 코드: new-contract.js의 totalAmount, readProducts, formRecord(기안 단추의 차례대로 돌려 봄)
// 계약 등록 화면 함수를 꺼내 돌리는 틀(nc, ncState, hasErr)은 lib.js에 있음(전에 이 파일의 lib였고 AC-02~AC-09, AC-51~AC-55도 함께 씀)
'use strict';
const fs = require('fs');
const path = require('path');
const { nc, ncState, hasErr } = require('./lib');

/* ---------- AC-01 시험 ---------- */
// 1,200만 원 줄(표절검사 1년 표준 단가 12,000,000원)과 300만 원 줄(CK Patent 1년 표준 단가 3,000,000원): 할인 없음
const TWO_LINES = [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }, { feature: 'CK_CAMPUS_PATENT', qty: 1, amount: '3,000,000' }];
function badAmount(h, amount) {
  const env = h.fresh({ role: 'SALES' });
  const p = nc(env, ncState({ lines: [TWO_LINES[0], { feature: 'CK_CAMPUS_PATENT', qty: 1, amount: amount }] }));
  const row = p.rows()[1];
  if (!row.bad || row.amount !== null) return '"' + amount + '"을 숫자가 아닌 칸으로 보지 않음(bad ' + row.bad + ', 금액 ' + row.amount + ')';
  if (p.total() !== 12000000) return '잘못 넣은 줄이 총액에 들어감: ' + p.total();
  const r = p.submit('2610CL901');
  if (r.rec || env.contract('2610CL901')) return '기안되어 저장됨';
  return hasErr(r.errors, '숫자로만') || '숫자로만 넣으라는 오류가 없음: ' + r.errors.join(' / ');
}

module.exports = {
  ac: 'AC-01',
  title: '총액은 줄 금액의 합',
  tests: [
    {
      name: '1,200만 원 줄과 300만 원 줄이면 총액 1,500만 원으로 저장된다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ lines: TWO_LINES }));
        if (p.total() !== 15000000) return '화면 총액이 ' + p.total() + '원';
        const r = p.submit('2610CL901');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL901');
        if (!c) return '저장된 계약이 없음';
        if (c.amount !== 15000000) return '저장된 총액이 ' + c.amount + '원';
        const sum = c.products.reduce(function (a, l) { return a + l.amount; }, 0);
        if (sum !== c.amount) return '저장된 줄 합계(' + sum + ')와 총액(' + c.amount + ')이 다름';
        return c.products.length === 2 || '저장된 줄이 ' + c.products.length + '개';
      },
    },
    {
      // CTL-08: 영업은 총액을 적지 않음. 화면의 총액은 글자(span)로만 보이고 양식 칸이 없으며, 화면 값에 총액을 넣어 보내도 저장은 줄 합계
      name: '총액은 적는 칸이 없고, 화면 값에 총액 1,000만 원을 넣어 보내도 줄 합계 1,500만 원으로 저장된다',
      kind: 'deny',
      run(h) {
        const html = fs.readFileSync(path.join(__dirname, '..', '..', 'prototype', 'new-contract.html'), 'utf8');
        const tag = /<[a-z]+[^>]*id="amount-total"[^>]*>/.exec(html);
        if (!tag) return '총액 표시(#amount-total)를 찾지 못함';
        if (/^<(input|textarea|select)/.test(tag[0])) return '총액이 적는 칸임: ' + tag[0];
        if (/<(input|textarea|select)[^>]*name="(amount|total|totalAmount)"/.test(html)) return '총액을 적는 양식 칸이 있음';
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: { amount: '10,000,000', total: '10,000,000', totalAmount: '10,000,000' }, lines: TWO_LINES }));
        const r = p.submit('2610CL901');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL901');
        return c.amount === 15000000 || '저장된 총액이 ' + c.amount + '원';
      },
    },
    { name: '줄 금액에 음수(-3,000,000)를 넣으면 기안되지 않는다', kind: 'deny', run(h) { return badAmount(h, '-3,000,000'); } },
    { name: '줄 금액에 소수(3000000.5)를 넣으면 기안되지 않는다', kind: 'deny', run(h) { return badAmount(h, '3000000.5'); } },
    { name: '줄 금액에 숫자 아닌 글자(삼백만)를 넣으면 기안되지 않는다', kind: 'deny', run(h) { return badAmount(h, '삼백만'); } },
  ],
  serverOnly: [
    '기안 요청의 총액을 1,000만 원으로 바꿔 보냄: 시안은 총액 칸이 없고 화면이 줄 합계로 정해 보낼 뿐. 서버가 줄 합계로 다시 계산해 저장하거나 거절',
    '음수, 소수, 글자인 줄 금액을 화면을 거치지 않고 요청에 넣어 보냄: 서버가 줄 금액 꼴을 다시 확인해 거절',
    '보완 완료에서 줄 금액만 바꾸고 총액은 그대로 보냄: 시안의 보완 완료는 고친 내용 글과 "처음부터 다시" 표시만 받고 계약 값을 받지 않음. 서버가 기안, 재기안, 보완 완료 때마다 총액을 다시 계산',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-01'));
