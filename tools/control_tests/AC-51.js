// AC-51 기간제 표준 금액(달 수 비례) (CTL-139, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 기간제 줄의 표준 금액은 표준 단가 x 수량 x 계약 기간의 달 수 / 12이고, 건당과 1회는 표준 단가 x 수량이다.
//     할인율, 체크리스트 2, 3번, ③과 ③ 영업 임원 승인이 이 값으로 정해지고, 기안 때 줄에 단위 종류, 달 수, 표준 금액이 남는다.
//     견적은 이용 기간(개월)으로 같은 셈을 한다.
//   시안 코드: common.js unitKindOf, periodMonths, stdLine, stdKeep, contractStd, capOver, quoteMonths, quoteLineAmount.
//     기안은 계약 등록 화면(new-contract.js)의 함수를 그대로 꺼내 쓰는 lib.js의 nc로 봄
'use strict';
const lib = require('./lib');
const { fixClock } = lib;

const lineOf = (c, f) => (c.products || []).find(l => l.feature === f);
const stdOf = (env, c, f) => env.C.contractStd(c).find(x => x.line.feature === f);

module.exports = {
  ac: 'AC-51',
  title: '기간제 표준 금액(달 수 비례)',
  tests: [
    {
      name: '달 수: 2026-03-01~2028-02-29는 24, 2026-01-31~2026-02-27은 1, 2026-11-01~2027-06-30은 8, 2026-11-15~2027-11-30은 13',
      kind: 'ok',
      run(h) {
        const C = h.fresh({ role: 'SALES' }).C;
        const cases = [['2026-03-01', '2028-02-29', 24], ['2026-01-31', '2026-02-27', 1], ['2026-11-01', '2027-06-30', 8], ['2026-11-15', '2027-11-30', 13]];
        const bad = cases.filter(x => C.periodMonths(x[0], x[1]) !== x[2]);
        return bad.length ? bad.map(x => x[0] + '~' + x[1] + '이 ' + C.periodMonths(x[0], x[1]) + '개월(기대 ' + x[2] + ')').join(', ') : true;
      },
    },
    {
      name: '2602CL001(2026-03-01~2028-02-29, 24개월)의 표절검사 5개는 표준 금액이 12,000,000원 x 5 x 24 / 12이고, 할인율과 ③ 여부가 수량 10개로 적던 예전 예시와 같음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const c = env.contract('2602CL001');
        const x = stdOf(env, c, 'CK_CAMPUS_PLAG');
        if (!x || !x.s) return '표절검사 줄의 표준 금액을 셈하지 못함';
        if (x.line.qty !== 5) return '예시 수량이 5가 아님(시험 전제): ' + x.line.qty;
        const want = 12000000 * 5 * 24 / 12;
        if (x.s.months !== 24 || x.s.kind !== 'PERIOD') return '달 수나 단위 종류가 다름: ' + x.s.months + ', ' + x.s.kind;
        if (x.s.std !== want) return '표준 금액이 ' + x.s.std + '원(기대 ' + want + '원)';
        // 예전 예시: 수량 10개, 표준 단가 x 수량(12개월)
        const oldStd = 12000000 * 10, oldDisc = (oldStd - x.amount) / oldStd;
        if (Math.abs(x.discount - oldDisc) > 1e-9) return '할인율이 예전 예시와 다름: ' + x.discount + ' / ' + oldDisc;
        const ov = C.capOver(c).find(l => l.feature === 'CK_CAMPUS_PLAG');
        if (!ov || ov.overPp !== 10) return '할인율 한도를 넘은 폭이 예전 예시(10%p)와 다름: ' + (ov && ov.overPp);
        const r = C.reviewRoute(c);
        if (!r.S03[0]) return '③ 영업 검토를 거치지 않음(예전 예시는 거침)';
        if (r.S03C[0]) return '③ 영업 임원 승인을 거침(예전 예시는 한도 넘은 폭 10%p라 거치지 않음)';
        return true;
      },
    },
    {
      name: '2606CL001-A01(8개월)의 추가 이용자 3은 3 x 1,500,000원 x 8 / 12 = 3,000,000원',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const c = env.contract('2606CL001-A01');
        const x = stdOf(env, c, 'CK_CAMPUS_USER');
        if (!x || !x.s) return '추가 이용자 줄의 표준 금액을 셈하지 못함';
        if (x.s.months !== 8) return '달 수가 ' + x.s.months;
        if (x.s.std !== 3000000) return '표준 금액이 ' + x.s.std + '원(기대 3,000,000원)';
        return true;
      },
    },
    {
      name: '기안하면 줄에 단위 종류, 달 수, 표준 금액이 남고 2, 3번이 그 값으로 정해짐(2년 계약, 표절검사 1개 24,000,000원)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        fixClock(env);
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { startDate: '2026-11-01', endDate: '2028-10-31' },
          lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '24,000,000' }], years: ['12,000,000', '12,000,000'] }));
        const r = p.submit('2610CL951');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const l = lineOf(r.rec, 'CK_CAMPUS_PLAG');
        if (!l) return '저장된 줄이 없음';
        if (l.unitKind !== 'PERIOD') return '줄에 단위 종류가 남지 않음: ' + l.unitKind;
        if (l.months !== 24) return '줄에 달 수가 남지 않음: ' + l.months;
        if (l.stdAmount !== 24000000) return '줄에 표준 금액이 남지 않음: ' + l.stdAmount;
        if (r.rec.checklist.price !== 'YES' || r.rec.checklist.cap !== 'YES') return '2, 3번이 달 수로 셈한 표준 금액과 맞지 않음: ' + r.rec.checklist.price + ', ' + r.rec.checklist.cap;
        return true;
      },
    },
    {
      name: '견적은 이용 기간(개월)으로 같은 셈: 기간제 12,000,000원 x 1 x 6 / 12 = 6,000,000원, 건당은 개월과 상관없음, 칸이 없으면 12개월',
      kind: 'ok',
      run(h) {
        const C = h.fresh({ role: 'SALES' }).C;
        const per = C.quoteLineAmount({ unitPrice: 12000000, qty: 1, unitKind: 'PERIOD' }, 6);
        if (per !== 6000000) return '기간제 6개월이 ' + per + '원';
        const unit = C.quoteLineAmount({ unitPrice: 8000, qty: 100, unit: '건' }, 24);
        if (unit !== 800000) return '건당 100건이 ' + unit + '원(개월을 곱하면 안 됨)';
        if (C.quoteMonths({}) !== 12) return '이용 기간이 없으면 12개월로 보지 않음: ' + C.quoteMonths({});
        return true;
      },
    },
    {
      name: '남는 날이 있는 기간(2026-11-15~2027-11-30)을 12개월로 내리지 않음(13개월로 셈)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const m = C.periodMonths('2026-11-15', '2027-11-30');
        if (m !== 13) return '달 수가 ' + m + '(13이어야 함)';
        const s = C.stdLine({ feature: 'CK_CAMPUS_GPTK', qty: 2 }, { months: m, fresh: true });
        if (s.std !== Math.round(2400000 * 2 * 13 / 12)) return '13개월 표준 금액이 ' + s.std + '원(기대 5,200,000원)';
        // 계약 등록에서 이 기간으로 기안해도 13개월
        fixClock(env);
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { startDate: '2026-11-15', endDate: '2027-11-30' },
          lines: [{ feature: 'CK_CAMPUS_GPTK', qty: 2, amount: '5,200,000' }], years: ['4,800,000', '400,000'] }));
        const r = p.submit('2610CL952');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const l = lineOf(r.rec, 'CK_CAMPUS_GPTK');
        if (l.stdAmount !== 5200000) return '기안한 줄의 표준 금액이 ' + l.stdAmount + '원(기대 5,200,000원)';
        if (l.months !== 13) return '기안한 줄의 달 수가 ' + l.months + '(13이어야 함)';
        return true;
      },
    },
    {
      name: '건당이나 1회 기능에는 달 수를 곱하지 않음(2년 계약이어도 표준 단가 x 수량)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const per = C.stdLine({ feature: 'HR_PRISM_DEFECT', qty: 1000 }, { months: 24, fresh: true });
        if (!per || per.kind !== 'PER_UNIT') return '건당 기능의 단위 종류가 PER_UNIT이 아님: ' + (per && per.kind);
        if (per.std !== 8000 * 1000 || per.months) return '건당 표준 금액이 ' + per.std + '원, 달 수 ' + per.months;
        const once = C.stdLine({ feature: 'X_ONCE', qty: 2 }, { row: { feature: 'X_ONCE', listPrice: 5000000, unit: '1식', unitKind: 'ONCE', discountCap: 0 }, months: 24, fresh: true });
        if (once.kind !== 'ONCE' || once.std !== 10000000 || once.months) return '1회 표준 금액이 ' + once.std + '원, 달 수 ' + once.months;
        // 계약의 줄로도: 2년 계약의 건당 줄
        const c = { id: 'T', kind: 'NEW', requestedAt: '2026-10-19 10:00', startDate: '2026-11-01', endDate: '2028-10-31', products: [{ feature: 'HR_PRISM_DEFECT', qty: 1000, amount: 8000000 }] };
        const x = C.contractStd(c)[0];
        if (!x.s || x.s.std !== 8000000) return '2년 계약의 건당 줄 표준 금액이 ' + (x.s && x.s.std) + '원';
        return true;
      },
    },
    {
      name: '기안한 뒤 가격 줄의 단가나 단위 종류가 바뀌어도 그 계약의 표준 금액, 할인율, 결재선은 그대로(CTL-14)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        fixClock(env);
        const { C } = env;
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { startDate: '2026-11-01', endDate: '2028-10-31', price: 'NO', priceNote: '할인', cap: 'NO', capNote: '할인' },
          lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '18,000,000' }], years: ['9,000,000', '9,000,000'] }));
        const r = p.submit('2610CL953');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL953');
        const ex = env.contract('2602CL001');
        const before = JSON.stringify([C.contractStd(c).map(x => [x.s.std, x.s.kind, x.s.months, x.discount]), C.capOver(c), C.reviewRoute(c),
          C.contractStd(ex).map(x => [x.s.std, x.s.kind, x.s.months, x.discount]), C.capOver(ex)]);
        // 관리자가 오늘부터 표절검사 가격 줄을 1회 20,000,000원으로 바꿈
        C.adminSave('PRICE', '카피킬러 캠퍼스 표절검사 (CK_CAMPUS_PLAG)', '표준 단가 12,000,000원 → 20,000,000원, 1회', '시험', { k: 'PRICE',
          row: { feature: 'CK_CAMPUS_PLAG', product: 'CK_CAMPUS', service: 'CK', unit: '1식', unitKind: 'ONCE', listPrice: 20000000, discountCap: 0, validFrom: env.D.TODAY,
            docUrl: 'https://gw.muhayu.com/approval/T51', docNo: '', reason: '시험' } });
        if (C.stdLine({ feature: 'CK_CAMPUS_PLAG', qty: 1 }, { day: env.D.TODAY, fresh: true }).unitPrice !== 20000000) return '가격 줄 바꾸기가 반영되지 않음(시험 전제)';
        const after = JSON.stringify([C.contractStd(c).map(x => [x.s.std, x.s.kind, x.s.months, x.discount]), C.capOver(c), C.reviewRoute(c),
          C.contractStd(ex).map(x => [x.s.std, x.s.kind, x.s.months, x.discount]), C.capOver(ex)]);
        if (after !== before) return '가격 줄을 바꾸자 이미 기안한 계약의 표준 금액이나 결재선이 바뀜';
        return true;
      },
    },
  ],
  serverOnly: [
    '2년 계약에 수량을 2배로 적고 달 수를 12로 보냄: 서버가 계약 기간으로 달 수를 다시 셈해 거절(시안은 화면이 계약 기간으로 셈해 보낼 뿐이고 저장된 줄의 달 수와 표준 금액을 그대로 믿음)',
    '화면이 보낸 표준 금액이나 달 수만 바꿔 보냄: 서버 값과 다르면 거절과 예외 기록(CTL-13)',
    '달 수와 표준 금액은 서버 함수 하나로 계산하고 화면 값을 믿지 않음. 오차 없는 숫자로 셈하고 원 단위에서 반올림 [가정](04 3장 "가격 셈")',
  ],
};
