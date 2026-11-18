// 2026-11-18 기획자 결정 반영 시험 (작업기록/2026-11-13/결정할것.md 9장 새 결정 N-3). 그 통제의 AC 파일 끝에서 require('./n18')('AC-xx')로 더함
//   N-3(추천): 견적에도 "간접(총판, 리셀러) 거래"(indirect)와 사용 업체(endUser)를 두고, 간접이면 표준 단가를 견적 고객사(리셀러)가 아니라
//   사용 업체의 고객사 티어로 셈(사용 업체를 적지 않았거나 거래처 목록에 없으면 기본 표준 단가). 계약 등록의 간접 계약(W7-4)과 같은 말
//   견적 화면(prototype/assets/js/quote.js)과 견적 목록(quotes.js)을 lib.openPage의 가짜 문서에 올려 칸을 바꾸고 저장한 기록을 봄
'use strict';
const lib = require('./lib');
const { openPage, stripTags } = lib;

const NO = 'QT2611-901';
const FEATURE = 'CK_CAMPUS_PLAG'; // 카피킬러 캠퍼스 표절검사(기관, 1년). 오늘 가격 기준에 티어 단가(티어 1, 티어 2)가 있는 줄
const RESELLER = { id: 'C-0006', name: '가온테크', bizNo: '129-86-40914' }; // 리셀러 계약(2602CL001)의 거래처, 티어 2
const END_T1 = '온새미로대학교'; // 거래처 목록의 티어 1 거래처(C-0005)

// 리셀러(가온테크)의 견적 한 판을 시안 데이터에 더함. over로 간접 표시, 사용 업체, 줄, 출력 기록을 바꿈
function addQuote(D, over) {
  const line = { feature: FEATURE, qty: 1, unitPrice: 11400000, listPrice: 11400000, cap: 0, unit: '기관, 1년', unitKind: 'PERIOD', months: 12, stdAmount: 11400000, tier: 'T2' };
  D.QUOTES.push(Object.assign({
    no: NO, ver: 1, customer: RESELLER.id, name: RESELLER.name, bizNo: RESELLER.bizNo, unit: '', opp: '',
    date: D.TODAY, validUntil: '2027-01-31', months: 12, owner: D.DEMO_PERSONA.SALES, savedAt: D.TODAY + ' 09:00',
    lines: [line], note: '', issues: [],
  }, over || {}));
}
// 오늘 가격 기준의 표준 단가(quote.js의 PRICE와 같게 그 기능의 마지막 가격 줄): 기본, 티어 1, 티어 2
function prices(env) {
  const rows = env.D.PRICE_BOOK.filter(p => p.feature === FEATURE);
  const row = rows[rows.length - 1];
  return { base: row.listPrice, T1: (row.tierPrices || {}).T1, T2: (row.tierPrices || {}).T2 };
}
// 시험 전제: 티어 셋의 단가가 서로 달라야 어느 거래처의 티어로 셌는지 가려짐
function premise(env) {
  const p = prices(env), C = env.C;
  if (!(p.T1 && p.T2) || p.T1 === p.T2 || p.T1 === p.base || p.T2 === p.base) return '시험 전제: ' + FEATURE + '의 티어 단가가 기본 단가와 모두 다르지 않음';
  const cuR = env.D.CUSTOMERS.find(c => c.id === RESELLER.id), cuE = C.customerByName(END_T1);
  if (C.customerTier(cuR) !== 'T2') return '시험 전제: 가온테크가 티어 2가 아님';
  if (!cuE || C.customerTier(cuE) !== 'T1') return '시험 전제: ' + END_T1 + '가 거래처 목록의 티어 1이 아님';
  return '';
}
// 고치기 화면을 열고(작성 중인 내 견적), 칸을 바꾸는 도우미
function openEdit(h, over) {
  const pg = openPage(h, 'quote.js', { role: 'SALES', query: 'no=' + NO + '&ver=1', hook: D => addQuote(D, over) });
  pg.setIndirect = on => { pg.node('#q-indirect').checked = on; pg.fire('#q-indirect', 'change'); };
  pg.setEndUser = v => { pg.node('#q-enduser').value = v; pg.fire('#q-enduser', 'input'); };
  pg.save = () => { pg.fire('#q-save', 'click'); return pg.env.C.findQuote(NO, 1); };
  return pg;
}

const T = {
  // ---------- AC-52 표준 단가의 고객사 티어 (N-3: 간접 견적은 사용 업체의 티어) ----------
  'AC-52': [
    {
      name: '(2026-11-18 결정 N-3) 리셀러(가온테크, 티어 2) 견적에 간접을 켜고 사용 업체를 티어 1 거래처로 적으면 표준 단가가 티어 1 단가가 되고, 저장한 견적에 간접 표시와 사용 업체가 남음',
      kind: 'ok',
      run(h) {
        const pg = openEdit(h);
        const pre = premise(pg.env);
        if (pre) return pre;
        const p = prices(pg.env);
        if (!pg.node('#q-enduser-field').hidden) return '간접을 고르지 않았는데 사용 업체 칸이 보임';
        if (String(pg.node('#q-enduser-names').innerHTML)) return '화면을 열 때 거래처 이름 제안 목록이 미리 채워짐(사용 업체 칸에 들어갈 때 채워야 함)';
        pg.setIndirect(true);
        if (pg.node('#q-enduser-field').hidden) return '간접을 골랐는데 사용 업체 칸이 보이지 않음';
        pg.fire('#q-enduser', 'focus');
        if (String(pg.node('#q-enduser-names').innerHTML).indexOf(END_T1) < 0) return '사용 업체 칸에 들어가도 거래처 이름 제안이 없음';
        pg.setEndUser(END_T1);
        const live = String(pg.node('#q-name-live').textContent);
        if (live.indexOf('사용 업체(' + END_T1 + ')') < 0) return '사용 업체 티어로 다시 셌다는 안내가 없음: ' + live;
        const q = pg.save();
        if (!q || q.savedAt === pg.env.D.TODAY + ' 09:00') return '저장되지 않음';
        const l = q.lines[0];
        if (l.listPrice !== p.T1 || l.tier !== 'T1') return '표준 단가가 사용 업체의 티어 1 단가(' + p.T1 + ')가 아님: ' + l.listPrice + ' ' + (l.tier || '티어 없음');
        if (l.unitPrice !== p.T1) return '표준 단가 그대로 둔 줄의 단가가 함께 바뀌지 않음: ' + l.unitPrice;
        if (q.indirect !== true || q.endUser !== END_T1) return '저장한 견적에 간접 표시(indirect)나 사용 업체(endUser)가 없음: ' + q.indirect + ' ' + q.endUser;
        if (q.customer !== RESELLER.id) return '견적의 거래처(리셀러)가 바뀜: ' + q.customer;
        return true;
      },
    },
    {
      name: '(2026-11-18 결정 N-3) 간접 견적인데 사용 업체를 적지 않았거나 거래처 목록에 없는 이름이면 리셀러의 티어 2 단가가 아니라 기본 표준 단가로 셈',
      kind: 'deny',
      run(h) {
        let pg = openEdit(h);
        const pre = premise(pg.env);
        if (pre) return pre;
        const p = prices(pg.env);
        pg.setIndirect(true);
        let q = pg.save();
        if (q.lines[0].listPrice !== p.base || q.lines[0].tier) return '사용 업체가 없는데 기본 표준 단가(' + p.base + ')가 아님: ' + q.lines[0].listPrice + ' ' + (q.lines[0].tier || '');
        if (q.indirect !== true || q.endUser !== '') return '사용 업체 없는 간접 견적의 저장 값이 맞지 않음: ' + q.indirect + ' "' + q.endUser + '"';
        pg = openEdit(h);
        pg.setIndirect(true);
        pg.setEndUser('없는기관(시험)');
        const live = String(pg.node('#q-name-live').textContent);
        if (live.indexOf('기본 표준 단가') < 0) return '기본 단가로 바꿨다는 안내가 없음: ' + live;
        q = pg.save();
        if (q.lines[0].listPrice !== p.base || q.lines[0].tier) return '거래처 목록에 없는 사용 업체인데 기본 표준 단가가 아님: ' + q.lines[0].listPrice + ' ' + (q.lines[0].tier || '');
        return true;
      },
    },
    {
      name: '(2026-11-18 결정 N-3) 사용 업체 티어로 저장한 간접 견적에서 간접을 끄면 견적 거래처(리셀러, 티어 2) 단가로 돌아가고 사용 업체는 비워 저장',
      kind: 'ok',
      run(h) {
        const pg = openEdit(h, { indirect: true, endUser: END_T1,
          lines: [{ feature: FEATURE, qty: 1, unitPrice: 10800000, listPrice: 10800000, cap: 0, unit: '기관, 1년', unitKind: 'PERIOD', months: 12, stdAmount: 10800000, tier: 'T1' }] });
        const pre = premise(pg.env);
        if (pre) return pre;
        const p = prices(pg.env);
        if (!pg.node('#q-indirect').checked) return '저장한 간접 견적을 열었는데 간접 칸이 고른 상태가 아님';
        if (pg.node('#q-enduser').value !== END_T1) return '저장한 사용 업체가 칸에 없음';
        if (pg.node('#q-enduser-field').hidden) return '간접 견적을 열었는데 사용 업체 칸이 감춰짐';
        pg.setIndirect(false);
        if (!pg.node('#q-enduser-field').hidden) return '간접을 풀었는데 사용 업체 칸이 그대로 보임';
        const live = String(pg.node('#q-name-live').textContent);
        if (live.indexOf('고객사 티어(') < 0) return '고객사 티어로 다시 셌다는 안내가 없음: ' + live;
        const q = pg.save();
        const l = q.lines[0];
        if (l.listPrice !== p.T2 || l.tier !== 'T2') return '간접을 풀었는데 견적 거래처의 티어 2 단가(' + p.T2 + ')가 아님: ' + l.listPrice + ' ' + (l.tier || '티어 없음');
        if (q.indirect !== false || q.endUser !== '') return '간접을 풀었는데 저장 값이 맞지 않음: ' + q.indirect + ' "' + q.endUser + '"';
        return true;
      },
    },
    {
      name: '(2026-11-18 결정 N-3) 출력한 간접 견적: 견적서에 "간접 거래(사용 업체: …)" 한 줄, 새 판도 사용 업체 티어로 표준 단가를 다시 채움, 견적 목록에 간접 표시와 사용 업체로 찾기',
      kind: 'ok',
      run(h) {
        const over = { indirect: true, endUser: END_T1, issues: [{ at: '2026-10-19 10:00', by: 'u_sales1', total: 13200000, sealed: true, sealVer: 1 }],
          // 지난 가격으로 남은 줄(기본 단가): 새 판은 오늘 가격 기준과 사용 업체의 티어로 다시 채워야 함
          lines: [{ feature: FEATURE, qty: 1, unitPrice: 12000000, listPrice: 12000000, cap: 0, unit: '기관, 1년' }] };
        const pg = openPage(h, 'quote.js', { role: 'SALES', query: 'no=' + NO + '&ver=1', hook: D => { addQuote(D, over); D.QUOTES[D.QUOTES.length - 1].issues[0].by = D.DEMO_PERSONA.SALES; } });
        const pre = premise(pg.env);
        if (pre) return pre;
        const p = prices(pg.env);
        const doc = stripTags(pg.node('#quote-doc').innerHTML);
        if (doc.indexOf('간접 거래(사용 업체: ' + END_T1 + ')') < 0) return '견적서에 "간접 거래(사용 업체: …)" 줄이 없음';
        pg.fire('#q-newver', 'click');
        const v2 = pg.env.C.findQuote(NO, 2);
        if (!v2) return '새 판이 만들어지지 않음';
        if (v2.indirect !== true || v2.endUser !== END_T1) return '새 판에 간접 표시와 사용 업체가 이어지지 않음';
        if (v2.lines[0].listPrice !== p.T1 || v2.lines[0].tier !== 'T1') return '새 판의 표준 단가가 사용 업체의 티어 1 단가가 아님: ' + v2.lines[0].listPrice + ' ' + (v2.lines[0].tier || '티어 없음');
        const list = openPage(h, 'quotes.js', { role: 'SALES', hook: D => addQuote(D, { indirect: true, endUser: END_T1 }), values: { 'f-q': '온새미로' } });
        const rows = stripTags(list.node('#rows').innerHTML);
        if (rows.indexOf(NO) < 0) return '견적 목록에서 사용 업체 이름으로 찾지 못함';
        if (rows.indexOf('간접 거래(사용 업체 ' + END_T1 + ')') < 0) return '견적 목록에 간접 거래 표시가 없음';
        return true;
      },
    },
  ],
};

module.exports = function (ac) { return T[ac] || []; };
module.exports.ACS = Object.keys(T);
