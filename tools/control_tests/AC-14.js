// AC-14 결재선은 시스템이 정함 (CTL-27) 시험 (2026-11-13 주말 점검 W2)
//   common.js reviewRoute, buildReview(저장할 때 결재선을 다시 만듦), 계약 등록의 미리 보기(new-contract.js buildRoute), 결재선 규칙 화면(admin-rules.js)
//   화면 코드는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn)
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

function fnText(file, marker) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(file + '에서 "' + marker.trim() + '"를 찾지 못함');
  const f = src.indexOf('function', at);
  let i = src.indexOf('{', f), depth = 0, q = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = ''; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(f, i + 1);
  }
  throw new Error(file + ' ' + marker.trim() + '의 끝을 찾지 못함');
}
function pageFn(file, marker, scope) {
  return new Function('__s', 'with (__s) { return (' + fnText(file, marker) + '); }')(scope);
}

// 기안한 계약 기록. 줄에는 기안할 때 남기는 표준 단가와 한도(한도 20%, 1년 12,000,000원)
function line(amount, qty) {
  const n = qty || 1;
  return { feature: 'CK_CAMPUS_PLAG', qty: n, amount: amount, listPrice: 12000000, cap: 0.2, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 * n };
}
function rec(env, id, over) {
  return Object.assign({
    id: id, counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: 9000000, requesterId: 'u_sales1',
    requestedAt: env.D.TODAY + ' 00:00', restricted: false, personalData: true, status: 'IN_REVIEW', round: 1, history: [],
    checklist: { standard: 'NO', standardNote: '조항 수정', price: 'NO', priceNote: '묶음 할인', cap: 'NO', capNote: '25% 할인 요청', accounting: 'NO' },
    products: [line(9000000)],
  }, over || {});
}
const stateOf = function (c, code) { const a = c.approvals.find(x => x.step === code); return a ? a.state : 'NONE'; };

module.exports = {
  ac: 'AC-14',
  title: '결재선은 시스템이 정함',
  tests: [
    {
      name: '1~3번이 모두 아니요이고 처리위탁 있음: ②, ③, ④, ⑤를 모두 거침',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        env.C.saveDemoContract(rec(env, '2610CL015'));
        const c = env.contract('2610CL015');
        const skipped = ['S02', 'S03', 'S04', 'S05'].filter(code => ['NONE', 'SKIPPED'].indexOf(stateOf(c, code)) > -1);
        if (skipped.length) return '생략된 단계: ' + skipped.join(',');
        const c3 = env.contract('2610CL003'); // 예시: 경우 6, 처리위탁 있음
        const sk3 = ['S02', 'S03', 'S04', 'S05'].filter(code => ['NONE', 'SKIPPED'].indexOf(stateOf(c3, code)) > -1);
        return sk3.length ? '예시 2610CL003에서 생략된 단계: ' + sk3.join(',') : true;
      },
    },
    {
      name: '1~3번이 모두 예: ③과 ④가 생략과 까닭(표준단가표를 적용함, 표준계약서를 그대로 씀)으로 보임',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        for (const c of [env.contract('2610CL002'), (function () {
          env.C.saveDemoContract(rec(env, '2610CL015', { amount: 12000000, products: [line(12000000)], personalData: false,
            checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' } }));
          return env.contract('2610CL015');
        })()]) {
          const s3 = c.approvals.find(a => a.step === 'S03'), s4 = c.approvals.find(a => a.step === 'S04');
          if (s3.state !== 'SKIPPED' || s3.reason !== '표준단가표를 적용함') return c.id + ' ③: ' + s3.state + ' ' + s3.reason;
          if (s4.state !== 'SKIPPED' || s4.reason !== '표준계약서를 그대로 씀') return c.id + ' ④: ' + s4.state + ' ' + s4.reason;
          if (stateOf(c, 'S02') === 'SKIPPED') return c.id + ' ②가 생략됨';
        }
        return true;
      },
    },
    {
      name: '화면이 보낸 단계 목록에서 ④를 빼거나 생략으로 보냄: 보낸 결재선을 쓰지 않고 다시 정함',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const r = rec(env, '2610CL015', { approvals: [
          { step: 'S02', state: 'PENDING', userId: 'u_sadmin' }, { step: 'S03', state: 'WAITING', userId: 'u_head' },
          { step: 'S04', state: 'SKIPPED', reason: '표준계약서를 그대로 씀' }, { step: 'S05', state: 'WAITING', userId: 'u_privacy' }] });
        env.C.saveDemoContract(r);
        const c = env.contract('2610CL015');
        if (['NONE', 'SKIPPED'].indexOf(stateOf(c, 'S04')) > -1) return '④가 보낸 대로 빠짐: ' + stateOf(c, 'S04');
        // 이미 저장된 계약의 결재란에서 ④를 빼고 다시 저장해도 규칙대로(buildReview는 내보내지 않아 저장 함수로 다시 그림)
        const c3 = env.contract('2610CL003');
        c3.approvals = c3.approvals.filter(a => a.step !== 'S04');
        env.C.saveDemoContract(c3);
        return stateOf(c3, 'S04') === 'PENDING' ? true : '예시 2610CL003의 ④가 되살아나지 않음: ' + stateOf(c3, 'S04');
      },
    },
    {
      name: '할인율 한도 안이지만 금액이 아주 큰 계약: ③이 생기지 않음(금액 기준 없음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        // 표준 단가 그대로 5,000개(600억 원), 그리고 한도 안 10% 할인(540억 원)
        const big1 = rec(env, '2610CL015', { amount: 60000000000, products: [line(60000000000, 5000)], personalData: false,
          checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' } });
        const big2 = rec(env, '2610CL016', { amount: 54000000000, products: [line(54000000000, 5000)], personalData: false,
          checklist: { standard: 'YES', price: 'NO', priceNote: '대량 할인', cap: 'YES', accounting: 'NO' } });
        env.C.saveDemoContract(big1);
        env.C.saveDemoContract(big2);
        for (const id of ['2610CL015', '2610CL016']) {
          const c = env.contract(id);
          if (stateOf(c, 'S03') !== 'SKIPPED') return id + '(' + env.C.fmtWon(c.amount) + ') ③이 생김: ' + stateOf(c, 'S03');
          if (['NONE', 'SKIPPED'].indexOf(stateOf(c, 'S03C')) < 0) return id + ' ③ 영업 임원 승인이 생김';
        }
        return true;
      },
    },
    {
      name: '관리자가 결재선 규칙 화면에서 단계를 거치는 조건을 바꿀 기능이 없음',
      kind: 'deny',
      run(h) {
        // 결재선 규칙 화면이 저장하는 일: 담당자, 대리 지정, 대리 끝냄, 독촉과 알림 기준, ③ 영업 임원 승인 기준(%p), 위임전결 근거뿐
        const ALLOWED = ['ASSIGNEE', 'DELEGATE', 'DELEGATE_END', 'ALERT_RULE', 'PRICE_RULE', 'RULE_BASIS'];
        const src = fs.readFileSync(path.join(JS, 'admin-rules.js'), 'utf8');
        const ops = (src.match(/k: '([A-Z_]+)'/g) || []).map(s => /'([A-Z_]+)'/.exec(s)[1]);
        if (!ops.length) return 'admin-rules.js에서 저장하는 일을 찾지 못함(시험을 고칠 것)';
        const bad = ops.filter(k => ALLOWED.indexOf(k) < 0);
        if (bad.length) return '결재선 규칙 화면에 다른 저장이 있음: ' + bad.join(',');
        const keys = (src.match(/k: 'PRICE_RULE', key: '([A-Za-z]+)'/g) || []).map(s => /key: '([A-Za-z]+)'/.exec(s)[1]);
        const badKey = keys.filter(k => k !== 'cooOverPp');
        if (badKey.length) return '결재선 규칙 화면이 바꾸는 기준에 ③ 영업 임원 승인 기준 말고 다른 것이 있음: ' + badKey.join(',');
        // 관리자가 할 수 있는 일을 해도 ②~⑤를 거치는지는 그대로
        const env = h.fresh({ role: 'ADMIN' });
        const c = env.contract('2610CL003');
        const before = JSON.stringify(['S02', 'S03', 'S04', 'S05'].map(k => env.C.reviewRoute(c)[k][0]));
        env.C.adminSave('RULE', '② 담당', '② 담당 바꿈', '시험', { k: 'ASSIGNEE', step: 'S02', to: 'u_dain_seok' });
        env.C.adminSave('RULE', '③ 영업 임원 승인 기준', '10 → 50', '시험', { k: 'PRICE_RULE', key: 'cooOverPp', to: 50 });
        const after = JSON.stringify(['S02', 'S03', 'S04', 'S05'].map(k => env.C.reviewRoute(c)[k][0]));
        return before === after ? true : '관리자 저장 뒤 ②~⑤를 거치는지가 바뀜: ' + before + ' → ' + after;
      },
    },
    {
      // (2026-11-13 시험 다지기) 이 시험은 신규만 봄. 변경과 바꿔서 연장은 아래 시험이 봄
      name: '신규 계약: 미리 보기(buildRoute)와 결재선(reviewRoute, 저장한 결재란)이 같은 계약에 같은 답',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { D, C } = env;
        const vals = { kind: 'NEW', signMethod: 'PAPER', personalData: 'NO' };
        let rows = [];
        const scope = { D: D, C: C, me: env.U('u_sales1'), val: function (n) { return vals[n] || ''; }, amendKind: function () { return ''; },
          drafterId: function () { return 'u_sales1'; }, priceKeep: function (r) { return r.keep; }, priceOff: function () { return false; },
          totalAmount: function () { return rows.reduce((a, r) => a + r.amount, 0); } };
        const buildRoute = pageFn('new-contract.js', '  function buildRoute(q1, pc, rows, qi) {', scope);
        // 가격: 표준 그대로, 한도 안 10% 할인, 한도를 5%p 넘김(25%), 한도를 20%p 넘김(40%, ③ 영업 임원 승인)
        const prices = [[12000000, 'YES', 'YES'], [10800000, 'NO', 'YES'], [9000000, 'NO', 'NO'], [7200000, 'NO', 'NO']];
        const codes = ['S02', 'S03', 'S03C', 'S04', 'S05'];
        let n = 15, cooSeen = 0;
        const diffs = [];
        ['YES', 'NO'].forEach(function (q1) {
          ['YES', 'NO'].forEach(function (pd) {
            prices.forEach(function (p) {
              vals.personalData = pd;
              const l = line(p[0]);
              rows = [{ product: { service: 'CK' }, feature: l.feature, qty: 1, amount: p[0], keep: { listPrice: l.listPrice, cap: l.cap, unitKind: l.unitKind, months: l.months, stdAmount: l.stdAmount } }];
              const route = buildRoute(q1, { q2: p[1], q3: p[2] }, rows, false);
              const items = route[0].items; // ②, ③, ③ 영업 임원 승인, ④, ⑤
              const preview = items.map(it => it.state === 'go');
              if (preview[2]) cooSeen++;
              const id = '2610CL0' + (n++);
              C.saveDemoContract(rec(env, id, { amount: p[0], products: [l], personalData: pd === 'YES',
                checklist: { standard: q1, standardNote: q1 === 'NO' ? '조항 수정' : '', price: p[1], cap: p[2], accounting: 'NO' } }));
              const c = env.contract(id);
              const rr = C.reviewRoute(c);
              const saved = codes.map(code => ['NONE', 'SKIPPED'].indexOf(stateOf(c, code)) < 0);
              codes.forEach(function (code, i) {
                if (preview[i] !== rr[code][0] || preview[i] !== saved[i]) {
                  diffs.push('1번 ' + q1 + ', 2·3번 ' + p[1] + '/' + p[2] + ', 처리위탁 ' + pd + ' ' + code + ': 미리 보기 ' + preview[i] + ', reviewRoute ' + rr[code][0] + ', 결재란 ' + saved[i]);
                }
              });
            });
          });
        });
        if (diffs.length) return diffs.slice(0, 3).join(' / ') + (diffs.length > 3 ? ' 외 ' + (diffs.length - 3) + '건' : '');
        return cooSeen ? true : '미리 보기에 ③ 영업 임원 승인을 거치는 경우가 하나도 없음(시험 값을 고칠 것)';
      },
    },
    {
      // (2026-11-13 시험 다지기) 06 AC-14 "미리 보기(buildRoute)와 reviewRoute가 같은 계약에 다른 답을 냄: 안 됨"은 계약종류를 가리지 않음.
      //   계약 등록 화면(lib.js nc 틀, new-contract.js 함수 그대로)으로 변경(추가, 줄임, 조항만)과 바꿔서 연장을 기안해,
      //   미리 보기의 ②, ③, ③ 영업 임원 승인, ④, ⑤와 reviewRoute, 저장한 결재란이 같은지 봄. 생략이면 까닭도 같은 말인지 봄
      //   변경: 한누리대학교 2609CL007(영업대표 김태윤, AC-53과 같은 원계약). 연장: 누리교육재단 2601CL001(영업대표 정하은)
      //   추가와 연장의 금액은 그 계약의 표준 금액, 5% 할인(한도 0%를 넘겨 ③), 20% 할인(한도를 10%p 넘게 넘겨 ③ 영업 임원 승인)
      name: '변경(추가, 줄임, 조항만)과 바꿔서 연장: 미리 보기(buildRoute)와 결재선(reviewRoute, 저장한 결재란)이 같은 계약에 같은 답',
      kind: 'deny',
      run(h) {
        const codes = ['S02', 'S03', 'S03C', 'S04', 'S05'];
        const files = () => ({ draft: [{ name: '계약서 초안.docx', size: 1000 }], diff: [{ name: '조항 대비표.docx', size: 1000 }], annex: [], quote: [] });
        function base(kind, ak, q1, pd) {
          const v = { standard: q1, standardNote: q1 === 'NO' ? '조항 수정' : '', priceNote: '할인 사유', capNote: '한도 넘김 사유', personalData: pd };
          if (kind === 'RENEW') {
            return { me: 'u_sales2', origin: '2601CL001', id: '2601CL001-R', feature: 'CK_CAMPUS_PLAG',
              vals: Object.assign({ kind: 'RENEW', customer: 'C:C-0004', counterparty: '누리교육재단', bizNo: '104-82-55123', opportunity: '2610CK903', startDate: '2027-01-01', endDate: '2027-12-31' }, v) };
          }
          return { me: 'u_taeyun_kim', origin: '2609CL007', id: '2609CL007-A', feature: ak === 'REDUCE' ? 'CK_CAMPUS_PLAG' : 'CK_CAMPUS_GPTK',
            vals: Object.assign({ kind: 'AMEND', amendKind: ak, customer: 'C:C-0029', counterparty: '한누리대학교', bizNo: '134-82-61500', opportunity: '2610CK901', startDate: '2026-11-01', endDate: '2027-09-30' }, v) };
        }
        const page = (env, b, lines) => lib.nc(env, lib.ncState({ me: env.U(b.me), origin: b.origin, files: files(), vals: b.vals, lines: lines }));
        let n = 10, cases = 0;
        const diffs = [], went = {};
        [['AMEND', 'ADD'], ['AMEND', 'REDUCE'], ['AMEND', 'TERMS'], ['RENEW', '']].forEach(function (k) {
          ['YES', 'NO'].forEach(function (q1) {
            ['YES', 'NO'].forEach(function (pd) {
              const b = base(k[0], k[1], q1, pd);
              let amounts;
              if (k[1] === 'TERMS') amounts = [null];
              else if (k[1] === 'REDUCE') amounts = ['7,150,000'];
              else {
                const std = page(h.fresh({ role: 'SALES' }), b, [{ feature: b.feature, qty: 1, amount: '1' }]).rows()[0].std;
                amounts = [std, Math.round(std * 0.95), Math.round(std * 0.8)].map(String);
              }
              amounts.forEach(function (amt) {
                const env = h.fresh({ role: 'SALES' });
                const p = page(env, b, amt == null ? [] : [{ feature: b.feature, qty: 1, amount: amt }]);
                const items = p.route()[0].items; // ②, ③, ③ 영업 임원 승인, ④, ⑤
                const id = b.id + (n++);
                const label = (k[1] ? '변경(' + k[1] + ')' : '연장') + ' 1번 ' + q1 + ', 처리위탁 ' + pd + (amt ? ', ' + amt + '원' : '');
                const r = p.submit(id);
                if (r.errors.length) { diffs.push(label + ': 기안이 막힘(' + r.errors.join(' / ') + ')'); return; }
                cases++;
                const c = env.contract(id), rr = env.C.reviewRoute(c);
                codes.forEach(function (code, i) {
                  const pv = items[i].state === 'go', sv = ['NONE', 'SKIPPED'].indexOf(stateOf(c, code)) < 0;
                  if (pv !== rr[code][0] || pv !== sv) diffs.push(label + ' ' + code + ': 미리 보기 ' + pv + ', reviewRoute ' + rr[code][0] + ', 결재란 ' + sv);
                  else if (!pv && code !== 'S03C' && items[i].reason !== rr[code][1]) diffs.push(label + ' ' + code + ' 생략 까닭: 미리 보기 "' + items[i].reason + '", reviewRoute "' + rr[code][1] + '"');
                  if (pv) went[(k[1] || 'RENEW') + ':' + code] = true;
                });
              });
            });
          });
        });
        if (diffs.length) return diffs.slice(0, 3).join(' / ') + (diffs.length > 3 ? ' 외 ' + (diffs.length - 3) + '건' : '');
        // 빈 반복이 통과하지 않게: 견준 계약 수와, 거치는 경우가 실제로 들었는지 봄
        if (cases !== 32) return '견준 계약이 ' + cases + '건(32건이어야 함, 시험을 고칠 것)';
        const need = ['ADD:S03', 'ADD:S03C', 'RENEW:S03', 'RENEW:S03C', 'REDUCE:S04', 'TERMS:S05'].filter(x => !went[x]);
        if (need.length) return '거치는 경우가 들지 않음(시험 값을 고칠 것): ' + need.join(', ');
        if (went['REDUCE:S03'] || went['TERMS:S03'] || went['REDUCE:S03C'] || went['TERMS:S03C']) return '줄임이나 조항만 변경에서 ③을 거침';
        return true;
      },
    },
  ],
  serverOnly: [
    '2, 3번 답을 예로 바꿔 ③을 건너뛰려 함: 서버가 가격 기준으로 2, 3번을 다시 계산해 받지 않음. 시안 reviewRoute는 저장된 답을 그대로 믿음(06 AC-05에 적힌 그대로)',
    '결재선은 서버의 한 규칙으로만 정하고 미리 보기도 같은 규칙을 씀(04 2.5). 시안은 미리 보기(buildRoute)와 reviewRoute가 따로 있어 위 시험으로 답이 같은지만 봄',
    '관리자 화면 밖에서 결재선 조건을 바꾸는 요청: 그런 서버 기능이 없어야 함(규칙은 프로그램 변경으로만)',
  ],
};
