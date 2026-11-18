// AC-06 서버 다시 계산과 근거 저장 (06 통제 목록 2장, CTL-13, 상태 "문서에만") (2026-11-13 주말 점검 W2)
//   기대 동작: 서버 계산과 화면 값이 같을 때만 기안. 줄마다 쓴 가격 행과 한도를 저장하고, 차수와 보완 순번마다 제품과 답이 남음
//   시안 코드 위치: 없음(시안은 화면에서만 셈). 다만 기획자 결정 2026-11-02 E-4로 계약 등록이 줄마다 그날의 표준 단가와 한도(listPrice, cap)를
//     남기므로(CTL-14), 되는 경우 가운데 "같은 날 새 행이 생겨도 이 계약은 10-01 행의 값을 씀"은 시안에서도 봄. 행 번호 저장은 서버 몫
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState;

module.exports = {
  ac: 'AC-06',
  title: '서버 다시 계산과 근거 저장',
  tests: [
    {
      // 2026-10-01부터 적용 중인 가격 행(카피킬러 캠퍼스 추가 이용자 100명, 1년 1,500,000원, 한도 15%)으로 오늘(2026-10-19) 기안한 뒤
      //   관리자가 같은 날(2026-10-19)부터 적용하는 새 행(1,800,000원, 한도 10%)을 넣어도 이 계약은 10-01 행의 값을 씀
      //   (이 기능은 예시에서 사용 안 함이라, 시험에서만 사용 중으로 둠)
      name: '2026-10-01 가격 행으로 기안한 계약은 같은 날 적용하는 새 가격 행이 생겨도 10-01 행의 값을 쓴다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: function (D) { D.FEATURES.filter(function (f) { return f.id === 'CK_CAMPUS_USER'; })[0].use = true; } });
        const D = env.D, C = env.C;
        const old = D.PRICE_BOOK.filter(function (r) { return r.feature === 'CK_CAMPUS_USER'; })[0];
        if (!old || old.validFrom !== '2026-10-01' || old.listPrice !== 1500000) return '시험 전제: 오늘 가격 행이 10-01 행이 아님 ' + JSON.stringify(old);
        const p = nc(env, ncState({ me: env.U('u_sales1', 'SALES'), lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,500,000' }] }));
        const r = p.submit('2610CL906');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2610CL906');
        const l = c.products[0];
        if (l.listPrice !== 1500000 || l.cap !== 0.15) return '줄에 남은 값이 ' + l.listPrice + '원, 한도 ' + l.cap + '(10-01 행 값이 아님)';
        C.adminSave('PRICE', '카피킬러 캠퍼스 추가 이용자', '표준 단가 1,500,000원 → 1,800,000원', '시험: 같은 날 새 행',
          { k: 'PRICE', row: { feature: 'CK_CAMPUS_USER', product: 'CK_CAMPUS', service: 'CK', unit: '100명, 1년', unitKind: 'PERIOD', listPrice: 1800000, discountCap: 0.1,
            validFrom: D.TODAY, docUrl: 'https://gw.muhayu.com/approval/test-1019', docNo: '시험-1019', reason: '시험: 같은 날 새 행' } });
        if (C.pricesAt(D.TODAY).CK_CAMPUS_USER.listPrice !== 1800000) return '시험 전제: 새 행이 오늘 가격으로 들어가지 않음';
        const s = C.contractStd(c)[0].s;
        if (s.unitPrice !== 1500000 || s.cap !== 0.15) return '기안한 계약이 새 행 값을 씀: ' + s.unitPrice + '원, 한도 ' + s.cap;
        const co = C.capOver(c)[0];
        return co.cap === 0.15 || '③ 영업 임원 승인 셈의 한도가 ' + co.cap;
      },
    },
  ],
  serverOnly: [
    '기안할 때 줄마다 쓴 가격 행 번호(price_row_id)와 그때 한도를 저장: 시안은 표준 단가와 한도 값만 남기고 행 번호는 남기지 않음(CTL-13 문서에만)',
    '금액은 그대로 두고 3번 답만 바꿔 보냄: 서버가 다시 셈해 거절하고 예외로 기록(예외 기록을 둘 곳은 03에 정할 것)',
    '같은 날 바뀐 가격을 날짜로만 찾음: 시안 C.pricesAt은 날짜로만 찾아 같은 날 앞뒤 행을 가리지 못함. 서버는 저장한 가격 행으로 셈',
    '보완으로 금액이 바뀐 뒤 처음 승인자가 본 금액이 덮어써짐: 시안 resubmitRecord는 앞 차수의 금액과 제품을 새 값으로 덮음. 서버가 차수와 보완 순번마다 제품과 답을 남김',
    '한도 값이 결재 문서 응답에 실려 개발자 도구로 보임: 시안은 모든 데이터가 브라우저에 있음. 서버가 볼 수 없는 사람의 응답에서 뺌',
    '제품, 기능 이름을 바꾼 뒤 지난 결재 문서의 이름이 바뀜: 시안은 기능 번호만 저장하고 지금 이름으로 보임. 서버가 기안 당시 이름을 줄에 함께 저장(04 3장 "데이터 저장")',
  ],
};
