// AC-19 ③ 가격 예외 승인 (CTL-32) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-19의 기대 동작: ③ 화면에 줄마다 표준 금액, 계약 금액, 할인율, 3번 비고가 보이고, 승인 기록에 처리한 사람과 일시가 남는다.
//   ③ 화면(review.js renderAmount)은 줄마다 C.contractStd로 표준 금액과 할인율을 셈하므로 그 셈을 직접 보고,
//   결재 문서를 가짜 문서에 그려(lib.js의 review 도우미) 화면에 보이는 글도 봄
//   계약 등록 화면의 3번 비고 필수(new-contract.js validate)는 그 검사 줄만 글자 그대로 떼어 와 값을 넣어 돌림(시안 코드는 고치지 않음)
//   (2026-11-14 주말 점검, 코드 다시 보기 common-05, review-01) ③을 거치지 않는 줄임 변경의 참고 금액(control-checks.js shrinkRef)도 여기서 봄:
//     남은 달 수를 자르지 않는지, 결재 문서 "변경 전과 후"와 할인 예외 점검 셋째 참고 표가 같은 셈(기능마다 합친 값)과 같은 기준인지
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const NEW_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'new-contract.js');

// 결재 기록의 일시를 정해 둠(시안은 시연 날짜 + 지금 시각으로 남겨, 시험을 돌리는 시각에 따라 순서가 바뀌지 않게)
function fixClock(env) {
  const Base = env.ctx.Date;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 23, 30, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
// 결재 문서 도우미(lib.js). 불러오지 못하면 null
function reviewHelper() { try { return require('./lib').review; } catch (e) { return null; } }
const text = s => String(s || '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// 결재 문서를 그 사람으로 열어 제품과 금액 표(#amount)와 체크리스트(#checklist)의 글
function screenOf(env, id, who) {
  const review = reviewHelper();
  if (!review) return { why: '결재 문서 도우미(lib.js review)를 불러오지 못함' };
  const rv = review(env, id, who);
  if (rv.error) return { why: id + ' 결재 문서를 그리지 못함: ' + rv.error.message };
  return { amount: text(rv.dom.q('#amount').innerHTML), checklist: text(rv.dom.q('#checklist').innerHTML), bar: rv.bar() };
}
// 계약 등록 화면 validate에서 이름(names)의 칸을 검사하는 줄만 떼어 와, 넣은 값(vals)으로 돌려 오류 난 칸 이름을 돌려줌
function validateRun(env, names, vals, kinds) {
  const L = fs.readFileSync(NEW_JS, 'utf8').split(/\r?\n/);
  const i = L.findIndex(l => l.startsWith('  function validate() {'));
  if (i < 0) return null;
  const j = L.findIndex((l, k) => k > i && l === '  }');
  const lines = L.slice(i, j).filter(l => l.indexOf('need(') > -1 && names.some(n => l.indexOf("'" + n + "', '") > -1)).map(l => l.trim());
  if (lines.length < names.length) return null;
  const src = '(function (vals, kinds) {\nconst errors = [];\nfunction need(cond, name) { if (!cond) errors.push(name); }\n' +
    'function val(n) { return String(vals[n] == null ? \'\' : vals[n]).trim(); }\nfunction acctKinds() { return kinds || []; }\n' +
    'const current = { pc: { q3: vals.q3 } };\n' + lines.join('\n') + '\nreturn errors;\n})';
  return vm.runInContext(src, env.ctx, { filename: 'new-contract.js validate(떼어 옴)' })(vals, kinds);
}

module.exports = {
  ac: 'AC-19',
  title: '③ 가격 예외 승인',
  tests: [
    {
      name: '기안 뒤 가격 기준이 바뀌어도 ③의 표준 금액과 할인율은 기안한 날 값(2610CL006)',
      kind: 'ok',
      run(h) {
        // 기안(2026-10-16) 뒤 2026-10-17부터 단가를 올리고 한도를 30%로 바꾼 새 가격 줄을 더함(관리자가 바꾼 것과 같음).
        //   예시 데이터에는 이미 2026-10-19부터 한도 0%인 줄도 있음
        const env = h.fresh({
          role: 'HEAD',
          hook: D => D.PRICE_ROWS.push({ feature: 'CK_CAMPUS_PLAG', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', unitKind: 'PERIOD',
            listPrice: 15000000, discountCap: 0.3, validFrom: '2026-10-17', reason: '시험: 기안 뒤 단가 올림', by: 'u_super', at: '2026-10-16 18:00' }),
        });
        const { C } = env;
        const c = env.contract('2610CL006');
        const s3 = step(c, 'S03');
        if (!s3 || s3.state !== 'PENDING' || s3.userId !== 'u_head') return '2610CL006의 ③이 리더 최민준 차례가 아님: ' + (s3 && s3.state + ' ' + s3.userId);
        const rows = C.contractStd(c);
        if (rows.length !== 1) return '제품 줄 수가 1이 아님: ' + rows.length;
        const x = rows[0];
        if (!x.s) return '표준 금액을 셈하지 못함';
        if (x.s.row.validFrom !== '2026-09-01') return '기안한 날(2026-10-16)의 가격 줄이 아니라 ' + x.s.row.validFrom + ' 줄을 씀';
        if (x.s.std !== 24000000) return '표준 금액이 기안한 날 값 24,000,000원이 아님: ' + x.s.std;
        if (Math.abs(x.discount - 0.25) > 1e-9) return '할인율이 25%가 아님: ' + x.discount;
        if (Math.abs(x.s.cap - 0.2) > 1e-9) return '한도가 기안한 날 20%가 아님: ' + x.s.cap;
        const over = C.capOver(c)[0];
        if (!over || over.overPp !== 5) return '한도를 넘은 폭이 5%p가 아님: ' + (over && over.overPp);
        if (!C.reviewRoute(c).S03[0]) return '③을 거치지 않게 바뀜';
        // ③ 화면에 보이는 값도 기안한 날 값(새 단가면 표준 금액 30,000,000원, 40% 할인)
        const sc = screenOf(env, '2610CL006', 'u_head');
        if (sc.why) return sc.why;
        if (sc.amount.indexOf('24,000,000원') < 0 || sc.amount.indexOf('25% 할인') < 0) return '③ 화면의 표준 금액이나 할인율이 기안한 날 값이 아님: ' + sc.amount.slice(0, 300);
        if (sc.amount.indexOf('30,000,000원') > -1 || sc.amount.indexOf('40% 할인') > -1) return '③ 화면이 기안 뒤 바뀐 가격 기준으로 셈함';
        return true;
      },
    },
    {
      name: '③ 화면의 줄마다 표준 금액, 계약 금액, 할인율이 보이고 3번 비고가 보임(2610CL006)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        const c = env.contract('2610CL006');
        const rows = env.C.contractStd(c);
        const bad = rows.filter(x => !x.s || !(x.s.std > 0) || typeof x.amount !== 'number' || typeof x.discount !== 'number');
        if (!rows.length || bad.length) return '표준 금액, 계약 금액, 할인율 가운데 빠진 줄이 있음: ' + bad.length + '/' + rows.length;
        const ck = c.checklist || {};
        if (ck.cap !== 'NO') return '3번 답이 아니요가 아님: ' + ck.cap;
        if (!String(ck.capNote || '').trim()) return '3번 비고가 비어 있음';
        const sc = screenOf(env, '2610CL006', 'u_head');
        if (sc.why) return sc.why;
        for (const w of ['표준 금액', '계약 금액', '할인율', '24,000,000원', '18,000,000원', '25% 할인']) {
          if (sc.amount.indexOf(w) < 0) return '③ 화면의 제품과 금액 표에 "' + w + '"이 보이지 않음';
        }
        if (sc.checklist.indexOf('3. 할인율 한도') < 0 || sc.checklist.indexOf('비고: ' + ck.capNote) < 0) return '③ 화면 체크리스트에 3번 비고가 보이지 않음';
        if (sc.bar.indexOf('data-open="APPROVE" data-step="S03"') < 0) return '리더 최민준에게 ③ 승인 단추가 없음';
        return true;
      },
    },
    {
      name: '③ 승인 기록에 처리한 사람과 일시가 남음(2610CL006, 리더 최민준)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const head = U('u_head');
        if (!C.canAct(c, step(c, 'S03'), head)) return '리더 최민준이 ③을 처리할 수 없음';
        const e = C.recordAction(c, step(c, 'S03'), 'APPROVE', '묶음 계약 할인 승인', head);
        if (!e) return '승인 기록이 남지 않음';
        if (e.actorId !== 'u_head') return '처리한 사람이 최민준이 아님: ' + e.actorId;
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(e.at || '')) return '처리 일시가 없음: ' + e.at;
        if (e.onBehalfOf) return '본인 처리인데 누구 대신이 남음: ' + e.onBehalfOf;
        const s3 = step(c, 'S03');
        if (s3.state !== 'DONE' || s3.decidedBy !== 'u_head' || s3.decidedAt !== e.at) return '결재란 ③이 승인과 처리한 사람, 일시를 보이지 않음: ' + s3.state + ' ' + s3.decidedBy + ' ' + s3.decidedAt;
        if (!c.history.some(x => x === e || (x.step === 'S03' && x.action === 'APPROVE' && x.actorId === 'u_head' && x.at === e.at))) return '결재 기록에 승인 줄이 없음';
        return true;
      },
    },
    {
      name: '할인 폭이 기준 %p를 넘으면 유닛 리더 한 사람 승인으로 끝나지 않고 영업 임원도 승인(2610CL009)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        const { C, U } = env;
        const c = env.contract('2610CL009');
        if (!(C.capOverPp(c) > C.cooOverPp(c.requestedAt))) return '시험 계약이 기준 %p를 넘지 않음: ' + C.capOverPp(c) + ' / ' + C.cooOverPp(c.requestedAt);
        if (!C.reviewRoute(c).S03C[0]) return '③ 영업 임원 승인을 거치지 않음';
        const s3 = step(c, 'S03'), s3c = step(c, 'S03C');
        if (!s3 || s3.state !== 'DONE' || s3.decidedBy !== 'u_head') return '③이 리더 승인으로 끝난 상태가 아님';
        if (!s3c || s3c.state !== 'PENDING' || s3c.userId !== 'u_exec') return '③ 영업 임원 승인이 영업 임원 차례가 아님: ' + (s3c && s3c.state + ' ' + s3c.userId);
        if (c.status !== 'IN_REVIEW') return '리더 승인만으로 계약 검토가 끝남: ' + c.status;
        if (C.canAct(c, s3c, U('u_head'))) return '③을 승인한 리더가 ③ 영업 임원 승인도 처리할 수 있음';
        return true;
      },
    },
    {
      name: '계약 등록 화면은 3번 아니요인데 비고가 비거나 공백만이면 기안하지 않음(new-contract.js validate)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const run = v => validateRun(env, ['capNote'], v);
        const empty = run({ q3: 'NO', capNote: '' });
        if (!empty) return '계약 등록 화면 validate에서 3번 비고 검사 줄을 찾지 못함';
        if (empty.indexOf('capNote') < 0) return '3번 아니요인데 비고 빈칸으로 기안 검사를 통과함';
        if (run({ q3: 'NO', capNote: '   ' }).indexOf('capNote') < 0) return '3번 아니요인데 비고가 공백만이어도 기안 검사를 통과함';
        if (run({ q3: 'NO', capNote: '두 기관 묶음 계약이라 25% 할인' }).length) return '견줌: 비고를 적어도 오류가 남';
        if (run({ q3: 'YES', capNote: '' }).length) return '견줌: 3번 예인데도 비고를 요구함';
        return true;
      },
    },
    {
      name: '③ 화면의 제품과 금액 표와 체크리스트에 할인율 한도 값은 보이지 않음(CTL-32, 2610CL006 리더 ③, 2610CL009 영업 임원 승인, 두 계약 모두 한도 20%)',
      kind: 'deny',
      run(h) {
        // 2026-11-13 보강(점검 지적): 없는지만 보면 표가 빈 글로 그려져도 통과하므로, 같은 화면에 표준 금액, 계약 금액, 할인율이
        //   먼저 보이는지 확인(견줌)한 뒤 한도 값이 없는지 봄. 영업 임원 승인(③ 다음 S03C) 건인 2610CL009도 함께 봄
        const cases = [
          { id: '2610CL006', who: 'u_head', step: 'S03', want: ['24,000,000원', '18,000,000원', '25% 할인'] },
          { id: '2610CL009', who: 'u_exec', step: 'S03C', want: ['48,000,000원', '31,200,000원', '35% 할인'] },
        ];
        for (const k of cases) {
          const env = h.fresh({ role: 'HEAD' });
          const c = env.contract(k.id);
          // 시험 전제: 두 계약 모두 한도가 20%인 줄 하나(화면에 "20%"가 없어야 하는 까닭)
          const caps = env.C.contractStd(c).map(x => x.s && Math.round(x.s.cap * 100));
          if (caps.join(',') !== '20') return '시험 전제: ' + k.id + '의 줄 한도가 20% 하나가 아님: ' + caps.join(',');
          const sc = screenOf(env, k.id, k.who);
          if (sc.why) return sc.why;
          if (sc.bar.indexOf('data-open="APPROVE" data-step="' + k.step + '"') < 0) return '견줌: ' + k.id + '을(를) ' + k.who + '가 열었는데 ' + k.step + ' 승인 단추가 없음(그 사람의 ③ 화면이 아님)';
          for (const w of k.want) {
            if (sc.amount.indexOf(w) < 0) return '견줌: ' + k.id + ' ③ 화면의 제품과 금액 표에 "' + w + '"이 보이지 않음(표가 비어 있으면 한도 값이 없는지 볼 수 없음)';
          }
          if (sc.checklist.indexOf('3. 할인율 한도') < 0) return '견줌: ' + k.id + ' ③ 화면 체크리스트에 3번 문항이 보이지 않음';
          if (/20(\.0)?\s?%/.test(sc.amount) || /20(\.0)?\s?%/.test(sc.checklist)) return k.id + ' ③ 화면에 할인율 한도 값(20%)이 보임';
          if (/한도/.test(sc.amount)) return k.id + ' ③ 화면의 제품과 금액 표에 한도가 보임: ' + sc.amount.slice(0, 200);
        }
        return true;
      },
    },
    /* (2026-11-14 주말 점검, 코드 다시 보기 common-05, review-01) ③을 거치지 않는 줄임 변경의 참고 금액(control-checks.js X.shrinkRef, CTL-141)
     *   참고 금액 = 그 기능의 계약 단가 x 줄이는 수량 x 남은 달 수 / 그 기간의 달 수. 결재 문서 "변경 전과 후"(review.js)와 할인 예외 점검 셋째 참고 표(discount-review.js)가 같은 값 */
    {
      // common-05: 남은 달 수는 변경 시작일부터 변경 전 조건의 종료일까지(03 문서). 예전에는 바탕 계약 달 수(12)로 잘라 맞게 줄인 금액도 "많이 줄임"으로 떴음
      //   다온컨설팅 LG-0001(표절검사 3곳 32,400,000원)의 그대로 연장 LG-0001-R01(2027-01-01~2027-12-31)을 계약 완료로 두고,
      //   2026-12-01부터 1곳을 줄이는 LG-0001-A01을 더함. 남은 달 수 13, 참고 금액 10,800,000원 x 1 x 13/12 = 11,700,000원
      name: '줄임의 참고 금액은 남은 달 수를 자르지 않음: 그대로 연장으로 종료일이 2027-12-31이 된 묶음에서 11,700,000원(남은 13/12개월)까지 줄이면 "참고보다 많이 줄임"이 아님(12,000,000원이면 많이 줄임)',
      kind: 'ok',
      run(h) {
        const mk = reduced => {
          const env = h.fresh({ role: 'SUPER', hook: D => {
            const lg = D.CONTRACTS.find(c => c.id === 'LG-0001');
            lg.products = [{ feature: 'CK_CAMPUS_PLAG', qty: 3, amount: 32400000 }]; lg.amount = 32400000;
            const r1 = D.CONTRACTS.find(c => c.id === 'LG-0001-R01');
            r1.amount = 32400000; r1.status = 'ACTIVE'; r1.autoHistory = true; r1.approvedAt = '2026-10-16 15:00'; r1.history = [];
            D.CONTRACTS.push({ id: 'LG-0001-A01', parentId: 'LG-0001', counterparty: '다온컨설팅', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'REDUCE',
              amount: -reduced, requesterId: 'u_sales1', requestedAt: '2026-11-02 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
              startDate: '2026-12-01', endDate: '2027-12-31', checklist: { standard: 'NO', standardNote: '시험', price: 'NA', cap: 'NA' },
              form: { bizNo: '120-88-63011', method: 'DIRECT', settlement: 'LUMP' }, products: [{ feature: 'CK_CAMPUS_PLAG', qty: -1, amount: -reduced }], history: [] });
          } });
          require('./lib').fixClock(env);
          return env;
        };
        const env = mk(11700000);
        const t = env.C.currentTerms('LG-0001', { before: '2026-11-02 10:00', skip: 'LG-0001-A01' });
        if (!t || t.end !== '2027-12-31') return '시험 전제: 변경 전 조건의 종료일이 2027-12-31이 아님: ' + (t && t.end);
        const s = env.X.shrinkRef(env.contract('LG-0001-A01'));
        if (!s || s.why) return '참고 금액을 셈하지 못함: ' + (s && s.why);
        if (s.lines[0].remaining !== 13 || s.ref !== 11700000) return '남은 달 수나 참고 금액이 문서의 셈과 다름: 남은 ' + s.lines[0].remaining + '개월, 참고 ' + s.ref + '원';
        if (s.over || s.flag) return '맞게 줄인 11,700,000원이 "참고보다 많이 줄임"으로 셈됨';
        const rv = require('./lib').review(env, 'LG-0001-A01', 'u_super');
        if (rv.error) return '결재 문서를 열지 못함: ' + rv.error.message;
        const am = text(rv.dom.q('#amount').innerHTML);
        if (am.indexOf('남은 13/12개월') < 0) return '결재 문서의 셈 줄에 남은 13/12개월이 없음: ' + (am.match(/참고 금액.{0,80}/) || [am.slice(0, 160)])[0];
        if (am.indexOf('참고보다 많이 줄임') > -1) return '결재 문서에 맞게 줄인 변경인데 "참고보다 많이 줄임"이 보임';
        // 견줌: 참고 금액보다 300,000원 더 줄이면 많이 줄임
        const env2 = mk(12000000);
        const s2 = env2.X.shrinkRef(env2.contract('LG-0001-A01'));
        if (!s2.over || s2.gap !== 300000) return '견줌: 12,000,000원 줄임이 참고보다 많이 줄임(300,000원)으로 셈되지 않음: ' + JSON.stringify({ over: s2.over, gap: s2.gap });
        return true;
      },
    },
    {
      // review-01 (가): 같은 기능 줄이 둘(01 REQ-REG-30 "같은 기능 줄은 모두 더함")이면 결재 문서도 그 기능의 줄을 모두 더해 보임.
      //   예전에는 첫 줄 하나(x 1, 7,150,000원)만 보이고 배지가 없어, 할인 예외 점검(합계로 "많이 줄임")과 달랐음
      name: '줄임 변경에 같은 기능 줄이 둘이면 결재 문서의 참고 금액은 두 줄을 더한 14,300,000원(계약 단가 x 2)이고 "참고보다 많이 줄임", 할인 예외 점검 셋째 표와 같은 값(2609CL007-A01)',
      kind: 'deny',
      run(h) {
        const lib = require('./lib');
        const hook = D => {
          const c = D.CONTRACTS.find(x => x.id === '2609CL007-A01');
          c.products = [{ feature: 'CK_CAMPUS_PLAG', qty: -1, amount: -1000000, org: '의학전문대학원' }, { feature: 'CK_CAMPUS_PLAG', qty: -1, amount: -14000000, org: '간호대학' }];
          c.amount = -15000000;
        };
        const env = h.fresh({ role: 'SUPER', hook }); lib.fixClock(env);
        const calc = '계약 단가 7,800,000원 x 2 x 남은 11/12개월';
        const rv = lib.review(env, '2609CL007-A01', 'u_super');
        if (rv.error) return '결재 문서를 열지 못함: ' + rv.error.message;
        const row = text(String(rv.dom.q('#amount').innerHTML).split('<tr').find(r => r.indexOf('표절검사') > -1 && r.indexOf('참고 금액') > -1) || '');
        if (!row) return '결재 문서의 표절검사 줄에 참고 금액이 없음';
        if (row.indexOf('참고 금액 14,300,000원(' + calc + ')') < 0) return '결재 문서의 참고 금액이 두 줄을 더한 값이 아님: ' + row;
        if (row.indexOf('참고보다 많이 줄임') < 0) return '결재 문서에 "참고보다 많이 줄임"이 없음(할인 예외 점검과 다름)';
        const pg = lib.openPage(h, 'discount-review.js', { role: 'FIN_EXEC', hook, query: 'month=2026-10' });
        const sr = text(String(pg.node('#shrink-rows').innerHTML).split('<tr').find(r => r.indexOf('2609CL007-A01') > -1) || '');
        if (!sr) return '할인 예외 점검 셋째 표에 2609CL007-A01이 없음';
        for (const w of ['15,000,000원', '14,300,000원', calc, '700,000원', '참고 금액의 4.9% 더']) if (sr.indexOf(w) < 0) return '할인 예외 점검 셋째 표에 "' + w + '"이 없음: ' + sr;
        return true;
      },
    },
    {
      // review-01 (나) [가정, 기획자 확인 필요]: 기능이 다른 두 줄 가운데 한 기능만 참고보다 많이 줄이면, 결재 문서는 그 기능 줄에만 배지,
      //   할인 예외 점검도 그 변경을 셋째 표에 올림(계약 전체 합으로는 참고 금액 안이어도). 차이는 더 줄인 기능의 몫 350,000원(7,500,000 - 7,150,000)
      name: '[가정] 한 기능만 참고보다 많이 줄이면(표절검사 -7,500,000원, 추가 이용자 -100,000원) 결재 문서는 표절검사 줄에만 배지, 할인 예외 점검 셋째 표도 올림(차이 350,000원). 둘 다 안이면 어디에도 없음',
      kind: 'deny',
      run(h) {
        const lib = require('./lib');
        const hookOf = (a, b) => D => {
          const c = D.CONTRACTS.find(x => x.id === '2609CL007-A01');
          c.products = [{ feature: 'CK_CAMPUS_PLAG', qty: -1, amount: -a }, { feature: 'CK_CAMPUS_USER', qty: -1, amount: -b }];
          c.amount = -(a + b);
        };
        const rowsOf = (env, hook) => {
          const rv = lib.review(env, '2609CL007-A01', 'u_super');
          const trs = String(rv.dom.q('#amount').innerHTML).split('<tr').map(text);
          const pg = lib.openPage(h, 'discount-review.js', { role: 'FIN_EXEC', hook, query: 'month=2026-10' });
          return { plag: trs.find(r => r.indexOf('표절검사') > -1 && r.indexOf('참고 금액') > -1) || '', user: trs.find(r => r.indexOf('추가 이용자') > -1 && r.indexOf('참고 금액') > -1) || '',
            dr: text(String(pg.node('#shrink-rows').innerHTML).split('<tr').find(r => r.indexOf('2609CL007-A01') > -1) || '') };
        };
        const hook = hookOf(7500000, 100000);
        const env = h.fresh({ role: 'SUPER', hook }); lib.fixClock(env);
        const s = env.X.shrinkRef(env.contract('2609CL007-A01'));
        if (s.over) return '시험 전제: 계약 전체로 참고보다 많이 줄임이 됨';
        const r = rowsOf(env, hook);
        if (!r.plag || !r.user) return '결재 문서의 줄에 참고 금액이 없음';
        if (r.plag.indexOf('참고보다 많이 줄임') < 0) return '결재 문서의 표절검사 줄에 배지가 없음';
        if (r.user.indexOf('참고보다 많이 줄임') > -1) return '결재 문서의 추가 이용자 줄(참고 안)에 배지가 있음';
        if (!r.dr) return '할인 예외 점검 셋째 표에 올라가지 않음(결재 문서의 배지와 다름)';
        if (r.dr.indexOf('350,000원') < 0 || r.dr.indexOf('참고 금액의 4.9% 더') < 0) return '할인 예외 점검의 차이가 더 줄인 기능의 몫(350,000원, 4.9%)이 아님: ' + r.dr;
        // 견줌: 두 기능 모두 참고 안이면 결재 문서에도 할인 예외 점검에도 없음
        const hook2 = hookOf(7000000, 100000);
        const env2 = h.fresh({ role: 'SUPER', hook: hook2 }); lib.fixClock(env2);
        const r2 = rowsOf(env2, hook2);
        if ((r2.plag + r2.user).indexOf('참고보다 많이 줄임') > -1 || r2.dr) return '견줌: 둘 다 참고 안인데 배지나 셋째 표 줄이 생김';
        return true;
      },
    },
  ],
  serverOnly: [
    '3번 아니요인데 비고 없이 화면을 우회해 기안 요청을 보냄: 서버 거부(시안은 계약 등록 화면 validate에서만 막음. 화면 검사는 위 안 되는 경우 시험으로 봄)',
    '기준 %p 아래의 큰 할인을 유닛 리더 한 사람이 승인: 남는 위험(R-05)이라 시스템이 막지 않음. 시험할 동작 없음',
    '리더 승인을 다른 사람이 사후 점검하지 않음: 남는 빈 곳(G-14, CTL-130). 시험할 동작 없음',
    '결재 문서의 줄과 할인율을 저장값과 기안한 날 가격 행으로 만들고 3번 비고 필수를 다시 검사: 서버 몫(시안은 화면에서 C.contractStd로 셈)',
  ],
};
