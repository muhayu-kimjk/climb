// AC-07 기안한 날의 가격으로 보임 (06 통제 목록 2장, CTL-14) (2026-11-13 주말 점검 W2)
//   기대 동작: 결재 문서와 계약 상세는 기안 때 저장한 가격 값으로 보이고, 날짜로 다시 찾지 않음. 저장한 값이 없으면(예전 기록)
//     기안한 날 적용되던 가격 행, 그날 행이 없으면 그 기능의 첫 행으로 셈. 오늘 가격으로 셈하지 않음(CTL-14, 2026-11-02 기획자 결정 E-4)
//   시안 코드: review.js의 PRICE(C.pricesAt)와 productRows(결재 문서 제품과 금액 표), common.js의 contractStd(계약 상세의 가격 기준 줄,
//     ③ 영업 임원 승인 capOver, 할인 예외 점검, 통계가 같이 씀), pricesAt, refreshPrices
//   결재 문서 표는 review.js에서 PRICE 문장과 productRows, orgText 함수 글을 그대로 꺼내 돌림(lib.js의 꺼내 쓰기 틀)
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState;

// 결재 문서(review.js)의 제품과 금액 표 줄. 함수 몸은 시안 그대로
let RV_BODY = null;
function reviewRows(env, c) {
  if (!RV_BODY) {
    RV_BODY = [
      'const c = CT;',
      'const detail = { method: (c.form && c.form.method) || c.method || "DIRECT" };',
      lib.stmtSrc('review.js', '  const PRICE = C.pricesAt(', ';\n'),
      lib.fnSrc('review.js', 'orgText'),
      lib.fnSrc('review.js', 'productRows'),
      'return productRows();',
    ].join('\n');
  }
  return lib.compile(env, ['D', 'C', 'CT'], RV_BODY, 'review.js(꺼낸 함수)')(env.D, env.C, c);
}
// 시험용 예전 계약(줄에 가격 값을 남기지 않음): 기안일과 기능, 금액만 바꿔 넣음
function oldContract(id, at, feature, amount, extra) {
  return Object.assign({ id: id, counterparty: '시험대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW', amount: amount,
    requesterId: 'u_sales1', requestedAt: at, restricted: false, personalData: false, status: 'IN_REVIEW',
    checklist: { standard: 'YES', price: 'YES', cap: 'YES' }, products: [{ feature: feature, qty: 1, amount: amount }], history: [] }, extra || {});
}
// 관리자가 가격 기준 관리(admin-prices.js saved와 같은 부름)로 오늘부터 적용하는 새 줄을 넣음
function addTodayRow(env, feature, listPrice, cap, unit) {
  const D = env.D, C = env.C;
  const base = D.PRICE_BOOK.filter(function (r) { return r.feature === feature; })[0] || D.PRICE_ROWS.filter(function (r) { return r.feature === feature; })[0];
  const row = { feature: feature, product: base.product, service: base.service, unit: unit || base.unit, unitKind: C.unitKindOf(base),
    listPrice: listPrice, discountCap: cap, validFrom: D.TODAY, docUrl: 'https://gw.muhayu.com/approval/test-' + feature, docNo: '시험-' + feature, reason: '시험: 오늘부터 가격 바꿈' };
  C.adminSave('PRICE', C.featureLabel(row) + ' (' + feature + ')', '시험', row.reason, { k: 'PRICE', row: row });
  const now = D.PRICE_BOOK.filter(function (r) { return r.feature === feature; })[0];
  return now && now.listPrice === listPrice;
}

module.exports = {
  ac: 'AC-07',
  title: '기안한 날의 가격으로 보임',
  tests: [
    {
      // 06의 되는 경우: 2610CL008(2026-10-18 기안, 프리즘 결함검사)은 2026-10-19부터 바뀐 단가(건당 8,000원)가 아니라 그 전 단가(기관, 1년 9,600,000원)
      name: '2610CL008의 결재 문서와 계약 상세 가격 줄은 10-19부터 바뀐 건당 8,000원이 아니라 기관, 1년 9,600,000원으로 보인다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const D = env.D, C = env.C, c = env.contract('2610CL008');
        const today = D.PRICE_BOOK.filter(function (r) { return r.feature === 'HR_PRISM_DEFECT'; })[0];
        if (!today || today.listPrice !== 8000 || today.unit !== '건') return '시험 전제: 오늘 가격이 건당 8,000원이 아님';
        const s = C.contractStd(c)[0].s; // 계약 상세의 가격 기준 줄과 ③ 영업 임원 승인이 쓰는 값
        if (!s || s.unitPrice !== 9600000 || s.row.unit !== '기관, 1년') return '계약 상세 셈의 표준 단가가 ' + (s && s.unitPrice) + '원(' + (s && s.row.unit) + ')';
        if (s.std !== 9600000) return '표준 금액이 ' + s.std + '원(오늘 단가로 셈하면 8,000원)';
        const r = reviewRows(env, c)[0];
        if (r.std !== 9600000 || Math.abs(r.discount) > 1e-12) return '결재 문서 표의 표준 금액이 ' + r.std + '원, 할인율 ' + r.discount;
        return /9,600,000원\(기관, 1년\)/.test(r.price) || '결재 문서 표의 설명 줄이 "' + r.price + '"';
      },
    },
    {
      // 06의 본디 예(시안에 없는 계약이라 시험에서만 넣음): 2026-09-20 기안 계약은 2026-10-01부터 오른 단가(1,500,000원)가 아니라 9월 단가(1,400,000원)
      name: '2026-09-20에 기안한 추가 이용자 계약은 10-01부터 오른 1,500,000원이 아니라 9월 단가 1,400,000원으로 보인다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: function (D) { D.CONTRACTS.push(oldContract('2609CL901', '2026-09-20 10:00', 'CK_CAMPUS_USER', 1400000)); } });
        const c = env.contract('2609CL901');
        const s = env.C.contractStd(c)[0].s;
        if (!s || s.unitPrice !== 1400000) return '계약 상세 셈의 표준 단가가 ' + (s && s.unitPrice) + '원';
        const r = reviewRows(env, c)[0];
        if (r.std !== 1400000 || Math.abs(r.discount) > 1e-12) return '결재 문서 표의 표준 금액이 ' + r.std + '원, 할인율 ' + r.discount;
        return /1,400,000원/.test(r.price) || '결재 문서 표의 설명 줄이 "' + r.price + '"';
      },
    },
    {
      // 오늘(2026-10-19) 관리자가 표절검사 가격을 15,000,000원, 한도 30%로 바꿈. 10-16에 기안한 2610CL006(줄에 남긴 값 없음)은
      //   10-16에 적용되던 줄(12,000,000원, 한도 20%)로 보이고 ③ 영업 임원 승인 셈도 그 한도를 씀
      //   (2026-11-13 시험 다지기) 사흘 전 기안이라 날짜로 찾아도 통과함. 이름에 그 범위를 밝히고, 같은 날 기안은 바로 아래 시험이 봄
      name: '오늘부터 가격을 바꿔도 사흘 전에 기안한 계약(2610CL006, 줄에 남긴 값 없음)은 새 가격으로 보이지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const C = env.C, c = env.contract('2610CL006');
        if (!addTodayRow(env, 'CK_CAMPUS_PLAG', 15000000, 0.3)) return '시험 전제: 새 줄이 오늘 가격으로 들어가지 않음';
        const s = C.contractStd(c)[0].s;
        if (s.unitPrice !== 12000000 || s.cap !== 0.2) return '계약 상세 셈이 ' + s.unitPrice + '원, 한도 ' + s.cap + '(새 가격을 씀)';
        if (s.std !== 24000000) return '표준 금액이 ' + s.std;
        const co = C.capOver(c)[0];
        if (co.cap !== 0.2) return '③ 영업 임원 승인 셈의 한도가 ' + co.cap;
        const r = reviewRows(env, c)[0];
        if (r.std !== 24000000 || r.product.discountCap !== 0.2) return '결재 문서 표가 ' + r.std + '원, 한도 ' + r.product.discountCap;
        return /12,000,000원/.test(r.price) || '결재 문서 표의 설명 줄이 "' + r.price + '"';
      },
    },
    {
      // (2026-11-13 시험 다지기) 06 AC-07의 안 되는 경우 그대로: "오늘부터 가격을 바꾼 날, 그보다 먼저(같은 날) 기안한 계약이 새 가격으로 보임: 안 됨".
      //   오늘 10:00에 이도윤이 계약 등록 화면으로 추가 이용자(10-01 행: 1,500,000원, 한도 15%)를 10% 할인해 기안(2, 3번 아니요, 예, ③ 생략).
      //   10:01에 관리자가 오늘부터 적용하는 새 행(1,800,000원, 한도 10%)을 넣음. 새 행으로 셈하면 25% 할인이라 한도를 넘김.
      //   결재 문서 표, 계약 상세 셈(contractStd), ③ 영업 임원 승인 셈(capOver), 다시 그린 결재란이 모두 기안 때 값이어야 함
      //   (추가 이용자는 예시에서 사용 안 함이라 시험에서만 사용 중으로 둠. 다른 사용 중 기능은 오늘 처음 시작하는 행뿐이라 같은 날 새 행이 겹침)
      name: '오늘부터 가격을 바꾼 날, 그보다 먼저(같은 날) 화면으로 기안한 계약은 결재 문서와 계약 상세에서 새 가격으로 보이지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: function (D) { D.FEATURES.filter(function (f) { return f.id === 'CK_CAMPUS_USER'; })[0].use = true; } });
        const D = env.D, C = env.C;
        lib.fixClock(env, 10); // 기안 10:00, 가격 변경 10:01(시험을 돌리는 시각과 상관없이)
        const old = D.PRICE_BOOK.filter(function (r) { return r.feature === 'CK_CAMPUS_USER'; })[0];
        if (!old || old.validFrom !== '2026-10-01' || old.listPrice !== 1500000 || old.discountCap !== 0.15) return '시험 전제: 오늘 가격이 10-01 행(1,500,000원, 한도 15%)이 아님';
        const p = nc(env, ncState({ me: env.U('u_sales1', 'SALES'), vals: { priceNote: '다년 약정 할인' }, lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,350,000' }] }));
        const r = p.submit('2610CL907');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL907');
        if (String(c.requestedAt).slice(0, 10) !== D.TODAY) return '시험 전제: 오늘 기안이 아님(' + c.requestedAt + ')';
        if (c.checklist.price !== 'NO' || c.checklist.cap !== 'YES') return '시험 전제: 저장된 2, 3번이 ' + c.checklist.price + ', ' + c.checklist.cap;
        if (!addTodayRow(env, 'CK_CAMPUS_USER', 1800000, 0.1)) return '시험 전제: 새 행이 오늘 가격으로 들어가지 않음';
        const ch = D.PRICE_ROWS.filter(function (x) { return x.feature === 'CK_CAMPUS_USER' && x.validFrom === D.TODAY; })[0];
        if (!ch || !(String(ch.at) > String(c.requestedAt))) return '시험 전제: 가격 변경이 기안보다 뒤가 아님(' + (ch && ch.at) + ', 기안 ' + c.requestedAt + ')';
        // 견줌: 바꾼 뒤 새로 셈하면 새 행(1,800,000원, 한도 10%)을 씀(새 행이 실제로 걸렸음)
        const after = nc(env, ncState({ me: env.U('u_sales1', 'SALES'), lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,350,000' }] })).rows()[0];
        if (after.std !== 1800000) return '견줌: 바꾼 뒤 새 기안의 표준 금액이 ' + after.std + '(새 행이 걸리지 않음)';
        const s = C.contractStd(c)[0].s;
        if (!s || s.unitPrice !== 1500000 || s.cap !== 0.15 || s.std !== 1500000) return '계약 상세 셈이 ' + (s && s.unitPrice) + '원, 한도 ' + (s && s.cap) + '(같은 날 새 행 값을 씀)';
        const co = C.capOver(c)[0];
        if (!co || co.cap !== 0.15 || Math.abs(co.discount - 0.1) > 1e-12) return '③ 영업 임원 승인 셈이 할인율 ' + (co && co.discount) + ', 한도 ' + (co && co.cap);
        const rr = reviewRows(env, c)[0];
        if (rr.std !== 1500000 || Math.abs(rr.discount - 0.1) > 1e-12 || rr.product.discountCap !== 0.15) return '결재 문서 표가 ' + rr.std + '원, 할인율 ' + rr.discount + ', 한도 ' + rr.product.discountCap;
        if (!/1,500,000원/.test(rr.price) || /1,800,000원/.test(rr.price)) return '결재 문서 표의 설명 줄이 "' + rr.price + '"';
        C.saveDemoContract(c); // 결재 기록을 다시 읽어 결재란을 다시 그려도
        if (C.reviewRoute(c).S03[0]) return '가격을 바꾼 뒤 결재선에서 ③을 거치게 바뀜';
        const s3 = (c.approvals || []).filter(function (a) { return a.step === 'S03'; })[0];
        return (!!s3 && s3.state === 'SKIPPED') || '다시 그린 결재란의 ③이 ' + (s3 ? s3.state : '없음');
      },
    },
    {
      // 기안 때 줄에 남긴 값(listPrice, cap, 표준 금액)이 있으면 그날 가격 줄이 없어도, 오늘 새 가격이 생겨도 그 값만 씀
      //   시험 계약: 2026-10-18 기안, CK Patent(첫 가격 줄은 10-19부터), 줄에 3,000,000원과 한도 0%를 남김
      name: '기안 때 줄에 남긴 표준 단가와 한도가 있으면 오늘 바뀐 가격으로 다시 찾지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: function (D) {
          D.CONTRACTS.push(oldContract('2610CL902', '2026-10-18 09:00', 'CK_CAMPUS_PATENT', 3000000,
            { products: [{ feature: 'CK_CAMPUS_PATENT', qty: 1, amount: 3000000, listPrice: 3000000, cap: 0, unitKind: 'PERIOD', months: 12, stdAmount: 3000000 }] }));
        } });
        const C = env.C, c = env.contract('2610CL902');
        if (!addTodayRow(env, 'CK_CAMPUS_PATENT', 3600000, 0.1)) return '시험 전제: 새 줄이 오늘 가격으로 들어가지 않음';
        const s = C.contractStd(c)[0].s;
        if (s.unitPrice !== 3000000 || s.cap !== 0 || s.std !== 3000000) return '계약 상세 셈이 ' + s.unitPrice + '원, 한도 ' + s.cap + ', 표준 금액 ' + s.std;
        if (C.capOver(c)[0].cap !== 0) return '③ 영업 임원 승인 셈의 한도가 ' + C.capOver(c)[0].cap;
        const r = reviewRows(env, c)[0];
        if (r.std !== 3000000) return '결재 문서 표의 표준 금액이 ' + r.std;
        return /3,000,000원/.test(r.price) || '결재 문서 표의 설명 줄이 "' + r.price + '"';
      },
    },
    {
      // 그날 가격 행이 없는 지난 계약(2026-08-01 기안. 모든 가격 줄은 09-01부터): 오늘 가격(1,500,000원)이 아니라 그 기능의 첫 줄(1,400,000원)
      name: '그날 가격 행이 없는 지난 계약을 오늘 가격으로 대신 보이지 않는다(그 기능의 첫 행)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: function (D) { D.CONTRACTS.push(oldContract('2608CL901', '2026-08-01 10:00', 'CK_CAMPUS_USER', 1400000)); } });
        const C = env.C, c = env.contract('2608CL901');
        const p = C.pricesAt('2026-08-01').CK_CAMPUS_USER;
        if (!p || p.validFrom !== '2026-09-01') return '그날 가격 줄이 ' + (p && p.validFrom) + '부터 줄(첫 줄 2026-09-01이 아님)';
        const s = C.contractStd(c)[0].s;
        if (!s || s.unitPrice === 1500000) return '오늘 가격(1,500,000원)으로 보임';
        if (s.unitPrice !== 1400000) return '표준 단가가 ' + s.unitPrice;
        const r = reviewRows(env, c)[0];
        if (r.std !== 1400000) return '결재 문서 표의 표준 금액이 ' + r.std + '원';
        return /1,400,000원/.test(r.price) || '결재 문서 표의 설명 줄이 "' + r.price + '"';
      },
    },
    {
      // 보완 후 재기안: 2610CL001(2026-10-06 기안, 그날 표절검사 한도 20%)을 오늘 10% 할인으로 다시 기안하면 화면은 오늘 줄(한도 0%)로 3번 아니요.
      //   저장한 기록의 기안 일시도 오늘이고, 줄에 남긴 한도와 결재선(③)이 화면과 같아야 함(처음 기안일 10-06로 셈하면 3번 예가 되어 ③이 빠짐)
      name: '재기안에서 화면이 쓴 가격 날짜(재기안한 날)와 저장, 결재선이 쓰는 날짜가 같다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const D = env.D, C = env.C, src = env.contract('2610CL001');
        const p = nc(env, ncState({ source: src, vals: { priceNote: '재기안 할인', capNote: '경쟁 대응' }, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,800,000' }] }));
        const pc = p.priceCheck();
        if (pc.q3 !== 'NO') return '화면의 3번이 ' + pc.q3 + '(오늘 한도 0%로 셈하지 않음)';
        const r = p.submit();
        if (r.errors.length) return '재기안이 막힘: ' + r.errors.join(' / ');
        const c = r.rec;
        if (String(c.requestedAt).slice(0, 10) !== D.TODAY) return '저장한 기안 일시가 ' + c.requestedAt + '(재기안한 날이 아님)';
        const l = c.products[0];
        if (l.listPrice !== 12000000 || l.cap !== 0) return '줄에 남긴 값이 ' + l.listPrice + '원, 한도 ' + l.cap;
        const fresh = C.stdLine({ feature: l.feature, qty: l.qty }, { day: String(c.requestedAt).slice(0, 10), customer: C.customerOfContract(c), fresh: true, months: C.periodMonths(c.startDate, c.endDate) || 12 });
        const s = C.contractStd(c)[0].s;
        if (s.std !== fresh.std || s.cap !== fresh.cap) return '저장한 값(' + s.std + ', ' + s.cap + ')과 재기안한 날로 다시 셈한 값(' + fresh.std + ', ' + fresh.cap + ')이 다름';
        if (c.checklist.cap !== 'NO') return '저장한 3번이 ' + c.checklist.cap;
        return C.reviewRoute(c).S03[0] || '결재선에서 ③이 생략됨: ' + C.reviewRoute(c).S03[1];
      },
    },
  ],
  serverOnly: [
    '같은 날(오늘) 가격을 바꾼 경우 그보다 먼저 기안한 계약: 시안 C.pricesAt은 날짜로만 찾아 그날 앞뒤 행을 가리지 못함(줄에 값을 남기지 않은 예시 계약만 해당. 화면으로 기안해 값을 남긴 계약은 위 "같은 날" 시험에서 봄). 서버는 기안 때 저장한 값(쓴 가격 행, 표준 단가, 한도)으로만 그림(AC-06과 같은 일)',
    '재기안 때 쓰는 가격 날짜를 서버가 재기안한 날로 잡아 다시 셈: 서버 코드가 생긴 뒤 위 재기안 예(2610CL001, 한도 20% → 0%)로 다시 시험',
    '기안 때 저장한 값으로만 결재 문서와 계약 상세를 그림: 시안은 값을 남기지 않은 예시 계약(E-4 전에 기안한 기록)을 기안일로 찾아 보임. 실제 시스템은 기안 때 저장한 값만 씀(06 AC-07, 04 3장 "결재선 다시 계산")',
  ],
};
