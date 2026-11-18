// AC-03 0원 계약 막기 (06 통제 목록 2장, CTL-10) (2026-11-13 주말 점검 W2)
//   기대 동작: 제품 줄이 없거나 총액이 0원이면 기안을 막음. 일부 줄만 0원이면 100% 할인으로 계산되어 2, 3번이 아니요가 되고 ③을 거침
//     (변경 종류가 조항만인 변경만 제품 줄 없이 0원, CTL-10 v0.12. 이 시험은 신규 계약)
//   시안 코드: new-contract.js의 validate, priceCheck (lib.js의 nc 틀로 돌림)
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState, hasErr = lib.hasErr;

const ZERO_ERR = '계약 금액 총액이 0원입니다';
const NOTES = { priceNote: '1년 차 무상 제공분 포함', capNote: '전략 고객 첫 계약' };

module.exports = {
  ac: 'AC-03',
  title: '0원 계약 막기',
  tests: [
    {
      name: '1,200만 원 줄과 0원 줄이면 기안되고, 2, 3번이 아니요가 되어 ③을 거친다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: NOTES, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }, { feature: 'CK_CAMPUS_PATENT', qty: 1, amount: '0' }] }));
        const zero = p.rows()[1];
        if (zero.amount !== 0 || zero.discount !== 1) return '0원 줄을 100% 할인으로 셈하지 않음(금액 ' + zero.amount + ', 할인율 ' + zero.discount + ')';
        const pc = p.priceCheck();
        if (pc.q2 !== 'NO' || pc.q3 !== 'NO') return '2, 3번이 ' + pc.q2 + ', ' + pc.q3;
        const r = p.submit('2610CL903');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL903');
        if (c.checklist.price !== 'NO' || c.checklist.cap !== 'NO') return '저장된 2, 3번이 ' + c.checklist.price + ', ' + c.checklist.cap;
        if (!env.C.reviewRoute(c).S03[0]) return '결재선에서 ③이 생략됨: ' + env.C.reviewRoute(c).S03[1];
        const s3 = (c.approvals || []).filter(function (a) { return a.step === 'S03'; })[0];
        return (!!s3 && s3.state !== 'SKIPPED') || '결재란의 ③이 ' + (s3 ? s3.state : '없음');
      },
    },
    {
      name: '모든 줄을 0원으로 넣으면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ vals: NOTES, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '0' }, { feature: 'CK_CAMPUS_PATENT', qty: 1, amount: '0' }] }));
        const r = p.submit('2610CL903');
        if (r.rec || env.contract('2610CL903')) return '기안되어 저장됨';
        return hasErr(r.errors, ZERO_ERR) || '0원 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '제품 줄 없이 기안하면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const p = nc(env, ncState({ lines: [] }));
        const r = p.submit('2610CL903');
        if (r.rec || env.contract('2610CL903')) return '기안되어 저장됨';
        return hasErr(r.errors, '제품을 1개 이상 넣으세요') || '제품 줄 오류가 없음: ' + r.errors.join(' / ');
      },
    },
    {
      name: '재기안에서 모든 줄을 0원으로 바꾸면 기안되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const src = env.contract('2610CL001'); // 반려된 예시 계약(영업대표 u_sales1)
        const p = nc(env, ncState({ source: src, vals: NOTES, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '0' }] }));
        const r = p.submit();
        if (r.rec) return '다시 기안되어 저장됨';
        if (src.status !== 'REJECTED' || (src.round || 1) !== 1) return '원래 기록이 바뀜: ' + src.status + ' ' + src.round + '차';
        return hasErr(r.errors, ZERO_ERR) || '0원 오류가 없음: ' + r.errors.join(' / ');
      },
    },
  ],
  serverOnly: [
    '모든 줄이 0원이거나 줄이 없는 기안 요청을 화면을 거치지 않고 직접 보냄: 서버가 기안 때 줄 수와 총액을 다시 확인해 거절',
    '화면 검사를 지난 뒤 금액만 0으로 바꿔 보냄: 서버가 기안 시점마다 줄 수와 총액을 다시 확인해 거절',
    '보완 완료에서 0원으로 바꿈: 시안의 보완 완료는 계약 값을 받지 않음. 서버가 보완 완료 때 다시 확인해 거절',
  ],
};
