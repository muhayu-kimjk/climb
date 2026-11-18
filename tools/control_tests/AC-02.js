// AC-02 연도별 금액 합계 (06 통제 목록 2장, CTL-09) (2026-11-13 주말 점검 W2)
//   기대 동작: 1년 넘는 계약은 1년씩 나눈 연도별 금액 칸이 생기고, 모두 넣고 합계가 총액과 같아야 기안됨(REQ-REG-05).
//     서버는 시작일과 종료일로 연차 구간을 다시 만들고 개수와 합계를 확인
//   시안 코드: new-contract.js의 contractYears, renderYearly, updateYearSum, validate (lib.js의 nc 틀로 돌림)
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState, hasErr = lib.hasErr;

// 2026-11-01~2028-10-31(24개월), 표절검사 1개 표준 금액 24,000,000원 그대로
const TWO_YEARS = { startDate: '2026-11-01', endDate: '2028-10-31' };
const LINE_24M = [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '24,000,000' }];
const SUM_ERR = '연도별 금액을 모두 넣고, 합계를 총액';
// 공통 날짜 셈(common.js monthsLater: 말일로 시작하면 말일 기준, REQ-CHG-07과 04 "가격 셈" 4)의 세는 법)으로 나눈 연차 구간
//   n번째 해 = [시작일 + (n-1)년, 시작일 + n년). 계약 연도(C.contractYearOf, contractYearWindow)와 같은 나눔
//   주의: 03 year_no는 "시작일부터 1년씩 나눔"만 적고 2월 29일과 말일 시작의 나눔은 정하지 않음. 서버가 따를 시안의 "1년 뒤" 셈이
//     둘(new-contract.js contractYears의 날짜 넘김, common.js monthsLater의 말일 기준)이라 06 AC-02의 "화면과 서버가 다르게 나눔: 안 됨"을
//     지킬 수 없어 실패로 둠. 예: 2028-02-29~2029-02-28은 화면이 1년(연도별 금액 칸 없음)인데 달 수(C.periodMonths)는 13개월
function commonYears(C, s, e) {
  const out = [];
  for (let n = 0; n < 60; n++) {
    const from = C.monthsLater(s, 12 * n);
    if (from > e) break;
    const last = C.addDays(C.monthsLater(s, 12 * (n + 1)), -1);
    out.push({ from: from, to: last < e ? last : e });
  }
  return out;
}
function sameSplit(h, start, end) {
  const env = h.fresh({ role: 'SALES' });
  const p = nc(env, ncState({ vals: { startDate: start, endDate: end }, lines: LINE_24M }));
  const got = JSON.stringify(p.years()), want = JSON.stringify(commonYears(env.C, start, end));
  return got === want || '계약 등록 화면의 연차 구간 ' + got + ' 이 공통 셈(말일 기준) ' + want + ' 과 다름';
}

module.exports = {
  ac: 'AC-02',
  title: '연도별 금액 합계',
  tests: [
    {
      name: '2026-11-01~2028-10-31, 총액 2,400만 원에 1년 차 1,200만 원, 2년 차 1,200만 원이면 통과한다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: TWO_YEARS, lines: LINE_24M, years: ['12,000,000', '12,000,000'] }));
        const ys = JSON.stringify(p.years());
        if (ys !== JSON.stringify([{ from: '2026-11-01', to: '2027-10-31' }, { from: '2027-11-01', to: '2028-10-31' }])) return '연차 구간이 ' + ys;
        if (p.total() !== 24000000) return '총액이 ' + p.total();
        const r = p.submit('2610CL902');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL902');
        const y = JSON.stringify(c && c.form && c.form.yearly);
        return y === JSON.stringify([12000000, 12000000]) || '저장된 연도별 금액이 ' + y;
      },
    },
    {
      name: '연도별 합계가 총액과 1원 다르면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: TWO_YEARS, lines: LINE_24M, years: ['12,000,000', '11,999,999'] }));
        const r = p.submit('2610CL902');
        if (r.rec || env.contract('2610CL902')) return '기안되어 저장됨';
        return hasErr(r.errors, SUM_ERR) || '합계 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '2년 계약에 1년 차만 넣고 2년 차를 비우면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: TWO_YEARS, lines: LINE_24M, years: ['24,000,000', ''] }));
        const r = p.submit('2610CL902');
        if (r.rec || env.contract('2610CL902')) return '기안되어 저장됨';
        return hasErr(r.errors, SUM_ERR) || '빈 해가 있는데 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      // 보완 후 재기안(같은 계약 등록 화면)에서 기간을 3년으로 늘리면 칸이 셋이 되고 앞의 두 값은 남음(renderYearly). 셋째가 비어 막혀야 함
      name: '재기안에서 기간만 3년으로 늘리고 연도별 금액은 2년 그대로 두면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const src = env.contract('2610CL001'); // 반려된 예시 계약(영업대표 u_sales1)
        const p = nc(env, ncState({ source: src, vals: { startDate: '2026-11-01', endDate: '2029-10-31', priceNote: '3년 약정', capNote: '3년 약정' },
          lines: LINE_24M, years: ['12,000,000', '12,000,000', ''] }));
        if (p.years().length !== 3) return '연차 구간이 ' + p.years().length + '개';
        const r = p.submit();
        if (r.rec) return '다시 기안되어 저장됨';
        if (src.status !== 'REJECTED') return '원래 기록의 상태가 ' + src.status;
        return hasErr(r.errors, SUM_ERR) || '연도별 금액 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '2월 29일에 시작한 계약(2028-02-29~2030-02-27)의 연차 구간을 화면과 공통 셈이 같게 나눈다',
      kind: 'deny',
      run(h) { return sameSplit(h, '2028-02-29', '2030-02-27'); },
    },
    {
      name: '2월 말일(평년)에 시작한 계약(2027-02-28~2029-02-27)의 연차 구간을 화면과 공통 셈이 같게 나눈다',
      kind: 'deny',
      run(h) { return sameSplit(h, '2027-02-28', '2029-02-27'); },
    },
  ],
  serverOnly: [
    '2년 계약에 1년 차만 든 요청(연도별 금액 개수가 연차 구간 수와 다름)을 직접 보냄: 시안은 화면이 칸 수를 정해 그런 요청을 만들 수 없음. 서버가 시작일과 종료일로 연차 구간을 다시 만들어 개수와 합계를 견줘 거절',
    '합계가 총액과 다른 요청을 화면을 거치지 않고 보냄: 서버가 합계를 다시 확인해 거절',
    '보완 완료에서 기간이나 총액만 바꾸고 연도별 금액은 그대로: 시안의 보완 완료는 계약 값을 받지 않음. 서버가 보완 완료 때 연차 구간과 합계를 다시 확인',
    '서버가 연차 구간을 만들 때 화면과 같은 세는 법(2월 29일, 말일 시작)을 씀: 서버 코드가 생긴 뒤 같은 예로 다시 시험',
  ],
};
