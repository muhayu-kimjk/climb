// AC-11 빠짐없는 계약번호 (CTL-22) 시험 (2026-11-13 주말 점검 W2)
//   번호를 매기는 곳은 화면 코드(new-contract.js newNumber, bundleNumber, originBlock, done)와 common.js(nextChildId, resubmitRecord)
//   화면 코드는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn)
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

// 화면 코드에서 marker 뒤 첫 function의 글을 { } 짝으로 잘라 냄(따옴표와 주석 안의 괄호는 셈하지 않음)
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

function draftRec(over) {
  return Object.assign({
    counterparty: '시험대학교', services: ['CK'], kind: 'NEW', parentId: null, amount: 12000000, requesterId: 'u_sales1',
    restricted: false, personalData: false,
    checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' },
    products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 12000000, listPrice: 12000000, cap: 0, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 }],
  }, over || {});
}
// 계약 등록 화면의 번호 매기기와 기안. kind와 origin은 화면에서 고른 계약종류와 원계약
function page(env, opt) {
  opt = opt || {};
  const vals = { kind: opt.kind || 'NEW' };
  const scope = {
    D: env.D, C: env.C, me: env.U(opt.me || 'u_sales1'), source: opt.source || null,
    val: function (n) { return vals[n] || ''; },
    $: function (sel) { return sel === '#f-origin' ? { value: opt.origin || '' } : { value: '' }; },
    formRecord: function () { return opt.rec || draftRec(); }, registerCustomer: function () {},
    round: opt.source ? (opt.source.round || 1) + 1 : 1, location: {},
  };
  scope.bundleNumber = pageFn('new-contract.js', '  function bundleNumber() {', scope);
  scope.originBlock = pageFn('new-contract.js', '  function originBlock() {', scope);
  scope.newNumber = pageFn('new-contract.js', '  function newNumber() {', scope);
  scope.done = pageFn('new-contract.js', '  function done() {', scope);
  return scope;
}

module.exports = {
  ac: 'AC-11',
  title: '빠짐없는 계약번호',
  tests: [
    {
      name: '10월 첫 기안 번호는 지금 가장 큰 번호 다음(시안 2610CL015), 그다음은 2610CL016',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = page(env);
        const n1 = p.newNumber();
        if (n1 !== '2610CL015') return '처음 기안 번호가 2610CL015가 아님: ' + n1;
        p.done();
        if (!env.contract('2610CL015')) return '2610CL015로 저장되지 않음';
        const n2 = page(env).newNumber();
        if (n2 !== '2610CL016') return '다음 번호가 2610CL016이 아님: ' + n2;
        return true;
      },
    },
    {
      name: '2601CL001의 두 번째 변경은 -A02, -C01이 끝난 묶음의 운영 변경은 -C02',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const a = page(env, { me: 'u_sales2', kind: 'AMEND', origin: '2601CL001' }).newNumber();
        if (a !== '2601CL001-A02') return '2601CL001 변경 번호: ' + a;
        const c01 = env.contract('2606CL002-C01');
        if (!c01 || c01.status !== 'ACTIVE') return '예시 2606CL002-C01이 끝난(계약 완료) 상태가 아님: ' + (c01 && c01.status);
        const c = env.C.nextChildId('2606CL002', 'CHANGE'); // 운영 변경 화면(ops-change.js newId)이 쓰는 함수
        if (c !== '2606CL002-C02') return '2606CL002 운영 변경 번호: ' + c;
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 예전에는 newNumber를 저장 없이 두 번 불러 같은 값인지만 봤음("지금 가장 큰 번호 + 1"이라 늘 같음).
      //   실제로 실패하는 기안을 거치게 바꿈: 계약 등록 화면의 기안 검사(validate, lib.js nc 틀)에 걸린 기안은 저장되지 않고 다음 기안이 그 번호를 받음.
      //   견줌으로 기안이 저장되면 다음 번호가 하나 늘어나는지도 봄(번호가 저장된 기록을 보고 매겨짐)
      name: '기안 검사에 걸려 실패한 기안은 저장되지 않아 번호가 쓰이지 않고, 다음 기안이 그 번호를 받음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const a = page(env).newNumber();
        if (a !== '2610CL015') return '시험 전제: 처음 번호가 2610CL015가 아님: ' + a;
        const before = env.D.CONTRACTS.length;
        // 10% 할인인데 2, 3번 비고가 비어 기안 검사에 걸림
        const bad = lib.nc(env, lib.ncState({ lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,800,000' }] })).submit(a);
        if (bad.rec || !bad.errors.length) return '시험 전제: 비고 없는 할인 기안이 기안 검사에 걸리지 않음';
        if (env.contract(a) || env.D.CONTRACTS.length !== before) return '실패한 기안이 ' + a + '로 저장됨';
        const b = page(env).newNumber();
        if (b !== a) return '실패한 기안 뒤 번호가 건너뜀: ' + a + ' → ' + b;
        // 견줌: 같은 번호로 맞게 기안하면 저장되고, 그다음 번호는 하나 늘어남
        const ok = lib.nc(env, lib.ncState({ vals: { priceNote: '다년 약정 할인', capNote: '경쟁 대응' }, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,800,000' }] })).submit(b);
        if (ok.errors.length || !env.contract(b)) return '견줌: 맞게 넣은 기안이 ' + b + '로 저장되지 않음: ' + ok.errors.join(' / ');
        const c = page(env).newNumber();
        return c === '2610CL016' || '견줌: 저장한 뒤 다음 번호가 2610CL016이 아님: ' + c;
      },
    },
    {
      // (2026-11-13 시험 다지기) v0.63에서 고친 "임시 저장 때문에 후속 번호가 건너뛰던 것"(06 AC-11 "빠진 번호가 생기면 안 됨")을 지킴.
      //   원계약(2601CL001)을 고른 변경 임시 저장(번호 없음)은 계약 등록 화면의 임시 저장 단추와 같은 꼴로 저장(formRecord + id 없음 + 임시 키).
      //   지금 2601CL001-A01이 있어 다음 변경 번호는 -A02이고, 임시 저장이 있어도 그대로여야 함
      name: '원계약을 고른 변경 임시 저장(번호 없음)이 있어도 다음 변경 번호는 건너뛰지 않음(2601CL001-A02 그대로)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { D, C } = env;
        const amendNo = () => page(env, { me: 'u_sales2', kind: 'AMEND', origin: '2601CL001' }).newNumber();
        if (amendNo() !== '2601CL001-A02' || C.nextChildId('2601CL001', 'AMEND') !== '2601CL001-A02') return '시험 전제: 임시 저장 전 다음 변경 번호가 -A02가 아님: ' + amendNo();
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales2'), origin: '2601CL001', vals: { kind: 'AMEND', amendKind: 'ADD', customer: 'C:C-0004', counterparty: '누리교육재단', bizNo: '104-82-55123' },
          lines: [{ feature: 'CK_CAMPUS_GPTK', qty: 1, amount: '2,400,000' }] }));
        const key = C.newDraftKey();
        C.saveDemoContract(Object.assign(p.record(), { id: null, draftKey: key, status: 'DRAFT', savedAt: C.nowStamp().slice(0, 16), history: [] }));
        const d = D.CONTRACTS.filter(c => c.draftKey === key)[0];
        if (!d || d.id || d.parentId !== '2601CL001' || d.kind !== 'AMEND') return '시험 전제: 원계약을 고른 변경 임시 저장이 남지 않음: ' + JSON.stringify(d && { id: d.id, parentId: d.parentId, kind: d.kind });
        if (C.nextChildId('2601CL001', 'AMEND') !== '2601CL001-A02') return '임시 저장 때문에 다음 변경 번호가 ' + C.nextChildId('2601CL001', 'AMEND') + '로 건너뜀';
        if (amendNo() !== '2601CL001-A02') return '계약 등록 화면의 다음 변경 번호가 ' + amendNo() + '로 건너뜀';
        return true;
      },
    },
    {
      name: '재기안은 새 번호를 받지 않고 같은 번호의 다음 차수',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const src = env.contract('2610CL001');
        if (!src || src.status !== 'REJECTED') return '예시 반려 계약 2610CL001이 없음';
        const p = page(env, { source: src, rec: draftRec({ checklist: { standard: 'NO', standardNote: '조항 고침', price: 'YES', cap: 'YES', accounting: 'NO' } }) });
        if (p.newNumber() !== '2610CL001') return '재기안 번호가 같은 번호가 아님: ' + p.newNumber();
        const before = env.D.CONTRACTS.filter(c => c.id).length;
        p.done();
        const same = env.D.CONTRACTS.filter(c => c.id === '2610CL001');
        if (same.length !== 1) return '같은 번호 기록이 ' + same.length + '개';
        if ((same[0].round || 1) !== 2) return '차수가 2가 아님: ' + same[0].round;
        if (env.D.CONTRACTS.filter(c => c.id).length !== before) return '재기안으로 새 번호 기록이 생김';
        const r = env.C.resubmitRecord(env.contract('2610CL001'), {});
        if (r.id !== '2610CL001' || r.round !== 3) return 'resubmitRecord: ' + r.id + ' ' + r.round + '차';
        return true;
      },
    },
    {
      name: '반려된 후속 기안(-R01, -A01)이 있는데 같은 종류를 새로 기안: 다음 번호(-R02)가 생기지 않고 막힘',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        // 진행 중인 연장 2510CL001-R01을 반려시킴(지금 차례인 사람이 반려)
        const r01 = env.contract('2510CL001-R01');
        const s = C.pendingSteps(r01)[0];
        if (!s) return '2510CL001-R01에 지금 차례가 없음';
        if (!C.recordAction(r01, s, 'REJECT', '시험 반려', env.U(s.userId))) return '반려를 남기지 못함';
        if (r01.status !== 'REJECTED') return '2510CL001-R01이 반려 상태가 아님: ' + r01.status;
        const p = page(env, { me: 'u_sales2', kind: 'RENEW', origin: '2510CL001' });
        const b = p.originBlock();
        if (!b || b.msg.indexOf('2510CL001-R01') < 0) return '반려된 -R01이 있는데 새 연장이 막히지 않음(다음 번호 ' + p.newNumber() + ')';
        // 예시 반려 변경 2606CL001-A01도 같은 규칙
        const p2 = page(env, { me: 'u_sales2', kind: 'AMEND', origin: '2606CL001' });
        const b2 = p2.originBlock();
        if (!b2 || b2.msg.indexOf('2606CL001-A01') < 0) return '반려된 -A01이 있는데 새 변경이 막히지 않음(다음 번호 ' + p2.newNumber() + ')';
        return true;
      },
    },
    {
      name: '기안 요청 안의 번호는 쓰지 않고 시스템이 매김',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = page(env, { rec: draftRec({ id: '2610CL001' }) }); // 남의 반려 계약 번호를 넣어 보냄
        p.done();
        if (!env.contract('2610CL015')) return '시스템 번호(2610CL015)로 저장되지 않음';
        const old = env.D.CONTRACTS.filter(c => c.id === '2610CL001');
        if (old.length !== 1 || old[0].status !== 'REJECTED') return '요청에 넣은 번호의 기존 계약이 덮어써짐';
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 예전에는 11월 1일 하루만 보아 "11월 첫 번호가 2611CL001"인지 말고는 하는 일이 없었음.
      //   자정 앞뒤를 둘 다 봄: 10-31 23:59:59 기안은 10월 번호와 10-31 기안 일시, 날이 바뀐 11-01 00:00:00 기안은 11월 첫 번호(001)와 11-01 기안 일시.
      //   시계는 시험 안에서 고정(시험을 돌리는 시각과 상관없이). 시안은 번호의 연월과 기안 일시를 같은 D.TODAY로 셈하므로,
      //   실제 시계 하나로 두 값을 같은 순간에 정하는 것은 서버 몫(serverOnly)
      name: '자정 앞뒤 기안(10-31 23:59:59, 11-01 00:00:00): 번호의 연월은 기안 일시의 연월이고 11월 번호는 001부터',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => { D.TODAY = '2026-10-31'; } });
        const at = function (y, mo, d, hh, mm, ss) { const Base = Date; env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(y, mo - 1, d, hh, mm, ss); } }; };
        at(2026, 10, 31, 23, 59, 59);
        const p1 = page(env);
        const n1 = p1.newNumber();
        p1.done();
        const c1 = env.contract(n1);
        if (!c1) return '10-31 기안이 저장되지 않음: ' + n1;
        if (c1.requestedAt !== '2026-10-31 23:59') return '10-31 23:59:59 기안의 기안 일시가 ' + c1.requestedAt;
        if (n1 !== '2610CL015') return '10-31 기안 번호가 10월 다음 번호(2610CL015)가 아님: ' + n1;
        // 날이 바뀜
        env.D.TODAY = '2026-11-01';
        at(2026, 11, 1, 0, 0, 0);
        const p2 = page(env);
        const n2 = p2.newNumber();
        p2.done();
        const c2 = env.contract(n2);
        if (!c2) return '11-01 기안이 저장되지 않음: ' + n2;
        if (c2.requestedAt !== '2026-11-01 00:00') return '11-01 00:00:00 기안의 기안 일시가 ' + c2.requestedAt;
        for (const x of [[n1, c1], [n2, c2]]) {
          const ym = x[1].requestedAt.slice(2, 4) + x[1].requestedAt.slice(5, 7);
          if (x[0].slice(0, 4) !== ym) return '번호 ' + x[0] + '와 기안 일시 ' + x[1].requestedAt + '의 연월이 다름';
        }
        if (n2 !== '2611CL001') return '11월 첫 번호가 2611CL001이 아님(10월 일련번호를 이어 씀?): ' + n2;
        if (!env.contract('2610CL015') || env.contract('2610CL015').requestedAt.slice(0, 10) !== '2026-10-31') return '10월 마지막 기안이 바뀜';
        return true;
      },
    },
  ],
  serverOnly: [
    '두 영업이 같은 순간 기안: 같은 번호가 둘 생기면 안 됨. 시안은 화면에서 "지금 가장 큰 번호 + 1"이라 동시 기안을 막지 못함(서버가 유일 조건과 같은 처리 안에서 매김)',
    '기안 저장과 번호 매기기를 한 처리(트랜잭션)로 묶어, 저장이 실패하면 번호도 쓰지 않음: 서버 몫(시안은 저장할 때 바로 셈해 빠짐이 생기지 않을 뿐. 기안 검사에 걸린 기안이 번호를 쓰지 않는 것은 위 시험에서 봄)',
    '요청 본문에 번호를 직접 넣어 저장 함수(saveDemoContract)를 부름: 시안 저장 함수는 받은 번호를 그대로 씀(서버가 무시하고 매김)',
    '반려된 -R01이 있는데 연장 기안 요청을 직접 보냄: 시안은 화면(originBlock)과 계약 상세 단추에서만 막고 C.nextChildId는 -R02를 돌려줌(서버가 막음)',
    '자정 경계: 실제 시계로 번호의 연월과 기안 일시를 같은 시각에서 정함(시안은 날짜를 D.TODAY 하나로 씀)',
  ],
};
