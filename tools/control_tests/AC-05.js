// AC-05 체크리스트 2, 3번 자동 계산 (06 통제 목록 2장, CTL-12) (2026-11-13 주말 점검 W2)
//   기대 동작: 시스템이 줄마다 표준 금액과 견줘 할인율을 셈하고 2번(표준단가표 적용), 3번(할인율 한도 준수) 답을 정함.
//     영업은 답을 바꿀 수 없고, 아니요면 비고 필수. 3번이 아니요면 ③을 거침(REQ-CHK-04, REQ-REG-06, REQ-CHK-05).
//     서버는 기안, 재기안, 보완 완료 때 기안일 가격 기준으로 다시 셈하고 화면 답과 다르면 받지 않음
//   시안 코드: new-contract.js의 priceCheck, readProducts, buildRoute, formRecord(lib.js의 nc 틀), common.js의 reviewRoute
//   한도 20% 기능: 지금 예시 값은 모든 기능 한도 0%(C-33)라, 표절검사의 오늘 가격 줄(2026-10-19부터, 표준 단가 12,000,000원) 한도를 시험에서만 20%로 둠
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState, hasErr = lib.hasErr;

function cap20(D) {
  const r = D.PRICE_ROWS.filter(function (x) { return x.feature === 'CK_CAMPUS_PLAG' && x.validFrom === '2026-10-19'; })[0];
  r.discountCap = 0.2;
}
function plag(amount) { return [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: amount }]; }
// 화면에서 2, 3번을 셈하고 기안해 저장된 계약까지 봄
function answers(h, amount, vals) {
  const env = h.fresh({ role: 'SALES', hook: cap20 });
  const p = nc(env, ncState({ vals: vals || {}, lines: plag(amount) }));
  return { env: env, p: p, pc: p.priceCheck() };
}
function s3Of(c) { return (c.approvals || []).filter(function (a) { return a.step === 'S03'; })[0] || null; }
function routeItem(route, name) {
  let out = null;
  route.forEach(function (g) { g.items.forEach(function (i) { if (i.no === '③' && i.name === name) out = i; }); });
  return out;
}

module.exports = {
  ac: 'AC-05',
  title: '체크리스트 2, 3번 자동 계산',
  tests: [
    {
      name: '한도 20% 기능을 10% 할인하면 2번 아니요(비고 필수), 3번 예, ③ 생략',
      kind: 'ok',
      run(h) {
        const a = answers(h, '10,800,000');
        if (a.pc.q2 !== 'NO' || a.pc.q3 !== 'YES') return '2, 3번이 ' + a.pc.q2 + ', ' + a.pc.q3;
        const e1 = a.p.errors();
        if (!hasErr(e1, '2번이 "아니요"이면 비고')) return '비고 없이도 2번 비고 오류가 없음';
        const env = a.env;
        const p = nc(env, ncState({ vals: { priceNote: '다년 약정 할인' }, lines: plag('10,800,000') }));
        const item = routeItem(p.route(), '영업 검토');
        if (!item || item.state !== 'skip') return '결재선 미리 보기의 ③이 ' + (item && item.state);
        const r = p.submit('2610CL905');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL905');
        if (c.checklist.price !== 'NO' || c.checklist.cap !== 'YES') return '저장된 2, 3번이 ' + c.checklist.price + ', ' + c.checklist.cap;
        if (env.C.reviewRoute(c).S03[0]) return '결재선에서 ③을 거침';
        const s3 = s3Of(c);
        return (!!s3 && s3.state === 'SKIPPED') || '결재란의 ③이 ' + (s3 ? s3.state : '없음');
      },
    },
    {
      name: '한도 20% 기능을 30% 할인하면 3번 아니요, ③을 거친다',
      kind: 'ok',
      run(h) {
        const a = answers(h, '8,400,000', { priceNote: '경쟁 입찰', capNote: '경쟁사 가격 대응' });
        if (a.pc.q2 !== 'NO' || a.pc.q3 !== 'NO') return '2, 3번이 ' + a.pc.q2 + ', ' + a.pc.q3;
        const r = a.p.submit('2610CL905');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = a.env.contract('2610CL905');
        if (c.checklist.cap !== 'NO') return '저장된 3번이 ' + c.checklist.cap;
        if (!a.env.C.reviewRoute(c).S03[0]) return '결재선에서 ③이 생략됨';
        const s3 = s3Of(c);
        return (!!s3 && s3.state !== 'SKIPPED') || '결재란의 ③이 ' + (s3 ? s3.state : '없음');
      },
    },
    {
      name: '표준보다 5% 높게 받으면 2번 아니요, 3번 예',
      kind: 'ok',
      run(h) {
        const a = answers(h, '12,600,000');
        if (Math.abs(a.p.rows()[0].discount + 0.05) > 1e-12) return '할인율이 ' + a.p.rows()[0].discount + '(-5%가 아님)';
        return (a.pc.q2 === 'NO' && a.pc.q3 === 'YES') || '2, 3번이 ' + a.pc.q2 + ', ' + a.pc.q3;
      },
    },
    {
      // CTL-12: 영업은 2, 3번 답을 바꿀 수 없음. 화면에 그런 칸이 없고, 값을 넣어 보내도 저장은 계산한 답
      //   (2026-11-13 시험 다지기) 화면 값(price, cap)만 넣어 보면 양식에 그 이름이 없어 거의 늘 통과하므로, AC-01 총액 시험처럼
      //   화면(new-contract.html과 화면 스크립트가 그리는 칸)에 2, 3번 답을 적거나 고르는 칸이 없는지를 함께 봄
      name: '2, 3번 답은 적거나 고르는 칸이 없고, 화면 값에 예를 넣어 보내도 계산한 답(아니요)으로 저장된다',
      kind: 'deny',
      run(h) {
        const html = fs.readFileSync(path.join(__dirname, '..', '..', 'prototype', 'new-contract.html'), 'utf8');
        const js = lib.src('new-contract.js');
        for (const id of ['q2-answer', 'q3-answer']) {
          const tag = new RegExp('<[a-z]+[^>]*id="' + id + '"[^>]*>').exec(html);
          if (!tag) return '2, 3번 답 표시(#' + id + ')를 찾지 못함';
          if (/^<(input|textarea|select|button)/.test(tag[0])) return '2, 3번 답이 적거나 고르는 칸임: ' + tag[0];
        }
        // 양식 칸 이름 모음(정적 HTML과 화면 스크립트 글 안의 name="..."). 비고 칸이 잡히는지로 빈 모음이 통과하지 않게 함
        const names = [];
        [html, js].forEach(function (s) { s.replace(/name="([A-Za-z0-9_]+)"/g, function (m, n) { if (names.indexOf(n) < 0) names.push(n); return m; }); });
        if (names.indexOf('priceNote') < 0 || names.indexOf('capNote') < 0 || names.indexOf('standard') < 0) return '양식 칸 이름을 읽지 못함(시험을 고칠 것): ' + names.join(',');
        const bad = names.filter(function (n) { return /^(price|cap|q2|q3|checklist)$/i.test(n) || /answer/i.test(n); });
        if (bad.length) return '2, 3번 답을 보내는 양식 칸이 있음: ' + bad.join(', ');
        const a = answers(h, '8,400,000', { price: 'YES', cap: 'YES', priceNote: '경쟁 입찰', capNote: '경쟁사 가격 대응' });
        const r = a.p.submit('2610CL905');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = a.env.contract('2610CL905');
        return (c.checklist.price === 'NO' && c.checklist.cap === 'NO') || '저장된 2, 3번이 ' + c.checklist.price + ', ' + c.checklist.cap;
      },
    },
    {
      name: '한도와 정확히 같은 할인(20.0%)은 3번 예, 1원 더 할인하면 아니요',
      kind: 'deny',
      run(h) {
        const a = answers(h, '9,600,000');
        if (a.pc.q3 !== 'YES') return '20.0% 할인의 3번이 ' + a.pc.q3;
        const env = a.env;
        const b = nc(env, ncState({ lines: plag('9,599,999') })).priceCheck();
        return b.q3 === 'NO' || '한도보다 1원 더 할인한 3번이 ' + b.q3;
      },
    },
    {
      name: '한도 0% 기능(CK Patent, 표준 금액 3,000,000원)을 1원 할인하면 3번 아니요',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const pc = nc(env, ncState({ lines: [{ feature: 'CK_CAMPUS_PATENT', qty: 1, amount: '2,999,999' }] })).priceCheck();
        return (pc.q2 === 'NO' && pc.q3 === 'NO') || '2, 3번이 ' + pc.q2 + ', ' + pc.q3;
      },
    },
    {
      // 건당 기능(프리즘 결함검사 건당 8,000원, 한도 0%)을 150,000건: 표준 금액 1,200,000,000원. 1원 할인도 할인
      //   06 AC-05: "한도 0%인 기능을 1원이라도 할인: 3번 아니요", "반올림 차이로 답이 바뀌면 안 됨". 시안 priceCheck는 할인율을 소수로 셈하고
      //   1e-9보다 작은 차이를 0으로 보아, 표준 금액 10억 원 이상 줄의 1원 할인은 할인 없음(2번 예, 3번 예)이 됨
      name: '한도 0% 기능을 표준 금액 12억 원 줄에서 1원 할인해도 2번 아니요, 3번 아니요',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ lines: [{ feature: 'HR_PRISM_DEFECT', qty: '150000', amount: '1,199,999,999' }] }));
        const row = p.rows()[0];
        if (row.std !== 1200000000) return '표준 금액이 ' + row.std;
        const pc = p.priceCheck();
        return (pc.q2 === 'NO' && pc.q3 === 'NO') || '1원 할인인데 2, 3번이 ' + pc.q2 + ', ' + pc.q3 + '(할인율 ' + row.discount + ')';
      },
    },
    {
      name: '2번이 아니요인데 비고가 빈칸이면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const a = answers(h, '10,800,000', { priceNote: '' });
        const r = a.p.submit('2610CL905');
        if (r.rec) return '기안되어 저장됨';
        return hasErr(r.errors, '2번이 "아니요"이면 비고') || '비고 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '2번이 아니요인데 비고가 공백만이면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const a = answers(h, '10,800,000', { priceNote: '   ' });
        const r = a.p.submit('2610CL905');
        if (r.rec) return '기안되어 저장됨';
        return hasErr(r.errors, '2번이 "아니요"이면 비고') || '공백 비고를 받음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '3번이 아니요인데 비고가 공백만이면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const a = answers(h, '8,400,000', { priceNote: '경쟁 입찰', capNote: '  \t ' });
        const r = a.p.submit('2610CL905');
        if (r.rec) return '기안되어 저장됨';
        return hasErr(r.errors, '3번이 "아니요"이면 비고') || '공백 비고를 받음: ' + r.errors.join(' / ');
      },
    },
  ],
  serverOnly: [
    '저장되는 2, 3번 답을 브라우저에서 예로 바꿔 기안: 시안의 reviewRoute는 저장된 답을 그대로 믿음. 서버가 기안일 가격 기준으로 다시 셈해 다르면 받지 않고 예외로 남김',
    '재기안과 보완 완료 때 서버가 2, 3번과 결재선을 다시 셈(시안의 보완 완료는 계약 값을 받지 않음)',
    '비고가 빈칸이거나 공백만인 아니요 답을 화면을 거치지 않고 보냄: 서버가 다시 확인해 거절',
    '할인율을 오차 없는 숫자로 셈(원 단위 정수로 견줌): 서버 코드가 생긴 뒤 한도와 같은 할인, 1원 할인 예로 다시 시험',
  ],
};
