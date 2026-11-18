// AC-04 사용 중이고 가격이 있는 기능만 (06 통제 목록 2장, CTL-11) (2026-11-13 주말 점검 W2)
//   기대 동작: 줄의 기능은 사용 중이고 기안일(오늘)에 적용 중인 가격 행이 있어야 함. 사용 안 함이 된 기능은 다시 골라야 기안됨.
//     제품과 서비스는 기능에서 정함(REQ-REG-03, REQ-REG-17, REQ-SCOPE-06)
//   시안 코드: new-contract.js의 livePrices, syncPick, readProducts, validate (lib.js의 nc 틀로 돌림)
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState, hasErr = lib.hasErr;

const RETIRED_ERR = '기능은 지금 쓰지 않습니다';
const NOTES = { priceNote: '시험', capNote: '시험' };
const TWO = function (feature) { return [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }, { feature: feature, qty: 1, amount: '1,000,000' }]; };
// 시험 기능(CK_CAMPUS_TEST, 사용 중)과 적용 시작일이 validFrom인 가격 행 하나를 넣는 hook
//   (2026-11-13 시험 다지기) 오늘 가격표(D.PRICE_BOOK)는 mock-data.js가 hook보다 먼저 만들고 common.js는 처음 올릴 때 다시 만들지 않음.
//   그래서 hook에서 넣은 행은 날짜와 상관없이 오늘 가격에 들지 않아, 예전 시험은 "가격이 없는 기능"과 같은 길만 지났음.
//   여기서 common.js refreshPrices와 같은 셈으로 오늘 가격표를 다시 만들어, 넣은 행이 적용 시작일대로 걸리게 함
function testRow(validFrom) {
  return function (D) {
    D.FEATURES.push({ id: 'CK_CAMPUS_TEST', product: 'CK_CAMPUS', name: '시험 기능', use: true });
    D.PRICE_ROWS.push({ feature: 'CK_CAMPUS_TEST', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', unitKind: 'PERIOD', listPrice: 1000000, discountCap: 0,
      validFrom: validFrom, docUrl: 'https://gw.muhayu.com/approval/test', docNo: '시험', reason: '시험', by: 'u_admin', at: '2026-10-19 09:30' });
    const cur = D.currentPrices(D.PRICE_ROWS, D.TODAY);
    D.PRICE_BOOK.length = 0;
    cur.forEach(function (r) { D.PRICE_BOOK.push(r); });
  };
}
// 고를 수 없는 기능을 줄에 넣었을 때: 기안이 막히고, 2, 3번이 "예"로 새지 않아야 함(할인율 계산이 빠지면 안 됨)
function blocked(h, hook, feature) {
  const env = h.fresh({ role: 'SALES', hook: hook });
  const p = nc(env, ncState({ vals: NOTES, lines: TWO(feature) }));
  if (p.live().indexOf(feature) > -1) return feature + '이(가) 고를 수 있는 기능 목록에 있음';
  const row = p.rows()[1];
  if (!row.retired || row.product) return '줄을 고를 수 없는 기능으로 보지 않음(retired ' + row.retired + ')';
  const pc = p.priceCheck();
  if (pc.q2 === 'YES' || pc.q3 === 'YES') return '할인율 계산 없이 2, 3번이 예로 나옴: ' + pc.q2 + ', ' + pc.q3;
  const r = p.submit('2610CL904');
  if (r.rec || env.contract('2610CL904')) return '기안되어 저장됨';
  return hasErr(r.errors, RETIRED_ERR) || '기능 오류가 없음: ' + r.errors.join(' / ');
}

module.exports = {
  ac: 'AC-04',
  title: '사용 중이고 가격이 있는 기능만',
  tests: [
    {
      name: '사용 중이고 오늘 가격이 있는 기능(카피킬러 캠퍼스 표절검사)은 통과한다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] }));
        if (p.live().indexOf('CK_CAMPUS_PLAG') < 0) return '고를 수 있는 기능 목록에 없음';
        const r = p.submit('2610CL904');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL904');
        return JSON.stringify(c.services) === '["CK"]' || '서비스가 ' + JSON.stringify(c.services);
      },
    },
    {
      name: '사용 안 함 기능(카피킬러 캠퍼스 추가 이용자, 가격 행은 있음)을 넣으면 기안되지 않는다',
      kind: 'deny',
      run(h) { return blocked(h, null, 'CK_CAMPUS_USER'); },
    },
    {
      name: '사용 중이지만 가격이 없는 기능을 넣으면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        return blocked(h, function (D) {
          D.FEATURES.push({ id: 'CK_CAMPUS_TEST', product: 'CK_CAMPUS', name: '시험 기능', use: true });
        }, 'CK_CAMPUS_TEST');
      },
    },
    {
      // (2026-11-13 시험 다지기) 견줌을 먼저 둠: 같은 행을 적용 시작일 오늘(2026-10-19)로 넣으면 고를 수 있고 기안됨.
      //   그래야 내일 행이 막히는 까닭이 "날짜"임을 봄(넣은 행이 오늘 가격에 아예 걸리지 않아 막히는 것과 가름)
      name: '적용 시작일이 내일인 예정 가격만 있는 기능을 넣으면 기안되지 않는다(견줌: 같은 행이 오늘부터면 기안됨)',
      kind: 'deny',
      run(h) {
        const env0 = h.fresh({ role: 'SALES', hook: testRow('2026-10-19') });
        if (env0.D.TODAY !== '2026-10-19') return '시험 전제: 오늘이 2026-10-19가 아님(' + env0.D.TODAY + ')';
        const p0 = nc(env0, ncState({ vals: NOTES, lines: TWO('CK_CAMPUS_TEST') }));
        if (p0.live().indexOf('CK_CAMPUS_TEST') < 0) return '견줌: 적용 시작일이 오늘인 행이 있는데 고를 수 있는 기능 목록에 없음(넣은 행이 오늘 가격에 걸리지 않음, 시험을 고칠 것)';
        const r0 = p0.submit('2610CL904');
        if (r0.errors.length || !env0.contract('2610CL904')) return '견줌: 적용 시작일이 오늘인 기능이 기안되지 않음: ' + r0.errors.join(' / ');
        const l0 = env0.contract('2610CL904').products[1];
        if (l0.feature !== 'CK_CAMPUS_TEST' || l0.listPrice !== 1000000) return '견줌: 줄에 남은 가격이 오늘 행 값이 아님: ' + JSON.stringify(l0);
        // 내일(2026-10-20)부터인 행만 있음: 행은 있고 내일 가격으로는 걸리지만 오늘은 고를 수 없어 막혀야 함
        const env1 = h.fresh({ role: 'SALES', hook: testRow('2026-10-20') });
        const t = env1.C.pricesAt('2026-10-20').CK_CAMPUS_TEST;
        if (!t || t.listPrice !== 1000000) return '시험 전제: 넣은 행이 내일(2026-10-20) 가격에 걸리지 않음';
        if (env1.D.PRICE_BOOK.some(function (r) { return r.feature === 'CK_CAMPUS_TEST'; })) return '적용 시작일이 내일인 행이 오늘 가격표에 들어감';
        return blocked(h, testRow('2026-10-20'), 'CK_CAMPUS_TEST');
      },
    },
    {
      name: '줄의 서비스와 제품 칸을 기능과 다르게 넣어도 서비스와 제품은 기능에서 정한다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ lines: [{ service: 'HR', product: 'HR_PRISM', feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] }));
        const rec = p.record();
        if (JSON.stringify(rec.services) !== '["CK"]') return '서비스가 ' + JSON.stringify(rec.services) + '(기능의 서비스는 CK)';
        const l = rec.products[0];
        if ('service' in l || 'product' in l) return '줄에 화면의 서비스나 제품 값이 남음: ' + JSON.stringify(l);
        return l.feature === 'CK_CAMPUS_PLAG' || '줄의 기능이 ' + l.feature;
      },
    },
  ],
  serverOnly: [
    '사용 안 함 기능이나 가격이 없는 기능을 요청에 직접 넣어 보냄: 서버가 기능이 사용 중이고 기안일에 적용 중인 가격 행이 있는지 확인해 거절(할인율 계산이 빠져 2, 3번이 예로 새지 않게)',
    '적용 시작일이 내일인 예정 가격만 있는 기능을 요청에 직접 넣어 보냄: 서버가 기안일 기준으로 거절',
    '줄의 서비스와 제품 값을 기능과 다르게 보냄: 서버가 받은 값을 버리고 기능에서 다시 정함',
  ],
};
